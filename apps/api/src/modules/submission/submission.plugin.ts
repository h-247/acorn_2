import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { authenticate, requireRole, assertLearnerAccess, AuthContext } from '../../infrastructure/auth/auth.js';
import {
  SubmissionStatus,
  EvaluatorType,
  EvidenceType,
  ConfidenceLevel,
  SaveResponseRequestSchema,
  SubmitAssessmentRequestSchema,
  EvaluateSubmissionRequestSchema,
  UserRole,
  AssessmentStatus,
  QuestionType,
} from '@acorn/contracts';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors.js';
import { storage } from '../../infrastructure/object-storage/storage.js';
import { recomputeLearnerSkillState } from '../learner-state/learner-state.service.js';

async function assertTeacherSubmissionAccess(user: AuthContext, sub: typeof schema.submissions.$inferSelect) {
  if (user.role !== UserRole.TEACHER) return;

  if (!sub.assignmentId) {
    throw new ForbiddenError('You do not have permission to access this submission');
  }

  const [assignment] = await db
    .select()
    .from(schema.assignments)
    .where(eq(schema.assignments.id, sub.assignmentId));

  if (!assignment) {
    throw new ForbiddenError('Assignment for this submission was not found');
  }

  if (assignment.classId) {
    const [cls] = await db
      .select()
      .from(schema.classes)
      .where(eq(schema.classes.id, assignment.classId));

    if (!cls || cls.teacherId !== user.id) {
      throw new ForbiddenError('You are not the teacher of the class for this submission');
    }
  } else {
    const [ass] = await db
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.id, assignment.assessmentId));

    if (!ass || ass.createdBy !== user.id) {
      throw new ForbiddenError('You do not have permission to access this submission');
    }
  }
}

export const submissionPlugin: FastifyPluginAsync = async (fastify) => {
  // 1. Submission Inbox / List
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { status, learnerId, classId } = request.query as {
      status?: string;
      learnerId?: string;
      classId?: string;
    };
    const user = request.user!;

    let query = db
      .select()
      .from(schema.submissions)
      .orderBy(desc(schema.submissions.startedAt));

    let subs = await query;

    // RBAC: Students can only view their own submissions
    if (user.role === UserRole.STUDENT) {
      subs = subs.filter((s) => s.learnerId === user.id);
    } else if (user.role === UserRole.TEACHER) {
      // Teachers only view submissions belonging to classes they teach
      const teacherClasses = await db
        .select({ id: schema.classes.id })
        .from(schema.classes)
        .where(eq(schema.classes.teacherId, user.id));
      const teacherClassIds = new Set(teacherClasses.map((c) => c.id));

      const allAssignments = await db.select().from(schema.assignments);
      const teacherAssessments = await db
        .select({ id: schema.assessments.id })
        .from(schema.assessments)
        .where(eq(schema.assessments.createdBy, user.id));
      const teacherAssessmentIds = new Set(teacherAssessments.map((a) => a.id));

      const allowedAssignmentIds = new Set(
        allAssignments
          .filter(
            (a) =>
              (a.classId && teacherClassIds.has(a.classId)) ||
              (!a.classId && teacherAssessmentIds.has(a.assessmentId))
          )
          .map((a) => a.id)
      );

      subs = subs.filter((s) => s.assignmentId && allowedAssignmentIds.has(s.assignmentId));
    }

    if (status) {
      if (status === 'LATE') {
        subs = subs.filter((s) => s.isLate);
      } else {
        subs = subs.filter((s) => s.status === status);
      }
    }
    if (learnerId) {
      subs = subs.filter((s) => s.learnerId === learnerId);
    }

    const allAssessments = await db.select().from(schema.assessments);
    const allAssignments = await db.select().from(schema.assignments);
    const allUsers = await db.select().from(schema.users);
    const allResponses = await db.select().from(schema.submissionResponses);
    const allClasses = await db.select().from(schema.classes);

    if (classId) {
      const classAssignmentIds = new Set(
        allAssignments.filter((a) => a.classId === classId).map((a) => a.id)
      );
      subs = subs.filter((s) => s.assignmentId && classAssignmentIds.has(s.assignmentId));
    }

    return subs.map((sub) => {
      const assessment = allAssessments.find((a) => a.id === sub.assessmentId);
      const assignment = allAssignments.find((a) => a.id === sub.assignmentId);
      const learner = allUsers.find((u) => u.id === sub.learnerId);
      const responses = allResponses.filter((sr) => sr.submissionId === sub.id);
      const cls = assignment?.classId ? allClasses.find((c) => c.id === assignment.classId) : null;

      return {
        ...sub,
        classId: assignment?.classId || null,
        className: cls?.name || null,
        isLate: sub.isLate,
        lateMinutes: sub.lateMinutes,
        startedAt: sub.startedAt.toISOString(),
        submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
        evaluatedAt: sub.evaluatedAt ? sub.evaluatedAt.toISOString() : null,
        dueAt: assignment?.dueAt ? assignment.dueAt.toISOString() : null,
        timeLimitMinutes: assessment?.timeLimitMinutes ?? null,
        assessmentTitle: assessment?.title || 'Assessment',
        assessmentInstructions: assessment?.instructions || null,
        learnerName: learner?.name || 'Student',
        learnerLevel: assessment?.level || 'B1',
        responses: responses.map((r) => ({
          ...r,
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    });
  });

  // 2. Submission Detail
  fastify.get('/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    let [sub] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id));
    if (!sub && user.role === UserRole.STUDENT) {
      // Check if id is an assessmentId for this learner
      const [existingForAss] = await db
        .select()
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.assessmentId, id),
            eq(schema.submissions.learnerId, user.id)
          )
        );

      if (existingForAss) {
        sub = existingForAss;
      } else {
        const [ass] = await db.select().from(schema.assessments).where(eq(schema.assessments.id, id));
        if (!ass || ass.status !== AssessmentStatus.PUBLISHED) {
          throw new NotFoundError('Assessment not found or not available');
        }

        const studentClasses = await db
          .select({ classId: schema.classEnrollments.classId })
          .from(schema.classEnrollments)
          .where(eq(schema.classEnrollments.learnerId, user.id));
        const classIds = studentClasses.map((c) => c.classId);

        const openAssignments = await db
          .select()
          .from(schema.assignments)
          .where(
            and(
              eq(schema.assignments.assessmentId, id),
              eq(schema.assignments.status, 'OPEN')
            )
          );

        const validAssignment = openAssignments.find(
          (a) => a.learnerId === user.id || (a.classId && classIds.includes(a.classId))
        );

        if (!validAssignment) {
          throw new ForbiddenError('This assessment is not assigned to you');
        }

        const [newSub] = await db
          .insert(schema.submissions)
          .values({
            assignmentId: validAssignment.id,
            assessmentId: ass.id,
            learnerId: user.id,
            status: SubmissionStatus.STARTED,
            maxPossibleScore: 100,
          })
          .returning();
        sub = newSub;
      }
    }

    if (!sub) throw new NotFoundError('Submission not found');

    if (user.role === UserRole.STUDENT && sub.learnerId !== user.id) {
      throw new ForbiddenError('You cannot view submissions belonging to another student');
    }

    if (user.role === UserRole.TEACHER) {
      await assertTeacherSubmissionAccess(user, sub);
    }

    const [assessment] = await db.select().from(schema.assessments).where(eq(schema.assessments.id, sub.assessmentId));
    const [assignment] = sub.assignmentId
      ? await db.select().from(schema.assignments).where(eq(schema.assignments.id, sub.assignmentId))
      : [null];
    const [learner] = await db.select().from(schema.users).where(eq(schema.users.id, sub.learnerId));
    const responses = await db
      .select()
      .from(schema.submissionResponses)
      .where(eq(schema.submissionResponses.submissionId, sub.id));

    // Also get full question data for review/player
    const assessmentItems = await db
      .select()
      .from(schema.assessmentItems)
      .where(eq(schema.assessmentItems.assessmentId, sub.assessmentId));

    const questionIds = assessmentItems.map((ai) => ai.questionId);
    let questions: any[] = [];
    if (questionIds.length > 0) {
      questions = await db.select().from(schema.questions).where(inArray(schema.questions.id, questionIds));
    }

    const isEvaluated = sub.status === SubmissionStatus.EVALUATED;
    const isTeacherOrAdmin = user.role !== UserRole.STUDENT;

    return {
      ...sub,
      startedAt: sub.startedAt.toISOString(),
      submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
      evaluatedAt: sub.evaluatedAt ? sub.evaluatedAt.toISOString() : null,
      dueAt: assignment?.dueAt ? assignment.dueAt.toISOString() : null,
      timeLimitMinutes: assessment?.timeLimitMinutes ?? null,
      assessmentTitle: assessment?.title || 'Assessment',
      assessmentInstructions: assessment?.instructions || null,
      learnerName: learner?.name || 'Student',
      learnerLevel: assessment?.level || 'B1',
      items: assessmentItems
        .sort((x, y) => x.sequenceOrder - y.sequenceOrder)
        .map((ai) => {
          const rawQ = questions.find((quest) => quest.id === ai.questionId);
          const r = responses.find((resp) => resp.questionId === ai.questionId);
          const q = rawQ
            ? {
                ...rawQ,
                correctAnswer: isEvaluated || isTeacherOrAdmin ? rawQ.correctAnswer : null,
              }
            : null;
          return {
            ...ai,
            question: q,
            response: r
              ? {
                  ...r,
                  updatedAt: r.updatedAt.toISOString(),
                }
              : null,
          };
        }),
      responses: responses.map((r) => ({
        ...r,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  });

  // 3. Student Autosave
  fastify.post('/:id/autosave', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = SaveResponseRequestSchema.parse(request.body);
    const user = request.user!;

    const [sub] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id));
    if (!sub) throw new NotFoundError('Submission not found');

    if (user.role === UserRole.STUDENT && sub.learnerId !== user.id) {
      throw new ForbiddenError('You can only autosave your own submission');
    }

    if (sub.status === SubmissionStatus.SUBMITTED || sub.status === SubmissionStatus.EVALUATED) {
      throw new BadRequestError('Cannot autosave a submitted or evaluated assessment');
    }

    // Validate questionId belongs to assessment
    const [item] = await db
      .select({ id: schema.assessmentItems.id })
      .from(schema.assessmentItems)
      .where(
        and(
          eq(schema.assessmentItems.assessmentId, sub.assessmentId),
          eq(schema.assessmentItems.questionId, body.questionId)
        )
      );
    if (!item) {
      throw new BadRequestError('Question does not belong to this assessment');
    }

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .insert(schema.submissionResponses)
        .values({
          submissionId: id,
          questionId: body.questionId,
          responsePayload: body.responsePayload,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.submissionResponses.submissionId, schema.submissionResponses.questionId],
          set: {
            responsePayload: body.responsePayload,
            updatedAt: now,
          },
        });

      if (sub.status === SubmissionStatus.STARTED) {
        await tx
          .update(schema.submissions)
          .set({ status: SubmissionStatus.IN_PROGRESS })
          .where(eq(schema.submissions.id, id));
      }
    });

    return { success: true, savedAt: now.toISOString() };
  });

  // 3b. Student Audio Upload for SPEAKING questions
  fastify.post('/:id/audio', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const [sub] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id));
    if (!sub) throw new NotFoundError('Submission not found');

    if (user.role === UserRole.STUDENT && sub.learnerId !== user.id) {
      throw new ForbiddenError('You can only upload audio for your own submission');
    }

    if (sub.status === SubmissionStatus.SUBMITTED || sub.status === SubmissionStatus.EVALUATED) {
      throw new BadRequestError('Cannot modify a submitted or evaluated assessment');
    }

    const data = await request.file();
    if (!data) throw new BadRequestError('Audio file is required');

    const fields = data.fields as Record<string, any>;
    const questionIdField = fields['questionId'];
    const questionId =
      questionIdField?.value || (typeof questionIdField === 'string' ? questionIdField : null);

    if (!questionId) {
      throw new BadRequestError('questionId is required in form fields');
    }

    // Validate questionId belongs to assessment and is of type SPEAKING
    const [item] = await db
      .select({ id: schema.assessmentItems.id })
      .from(schema.assessmentItems)
      .where(
        and(
          eq(schema.assessmentItems.assessmentId, sub.assessmentId),
          eq(schema.assessmentItems.questionId, questionId)
        )
      );
    if (!item) {
      throw new BadRequestError('Question does not belong to this assessment');
    }

    const [question] = await db
      .select({ id: schema.questions.id, type: schema.questions.type })
      .from(schema.questions)
      .where(eq(schema.questions.id, questionId));
    if (!question || question.type !== QuestionType.SPEAKING) {
      throw new BadRequestError('Audio uploads are only permitted for SPEAKING questions');
    }

    // Validate audio mimetype with strict whitelist
    const validMimes = new Set([
      'audio/webm',
      'audio/mp4',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/ogg',
      'audio/mpeg',
      'audio/mp3',
      'audio/x-m4a',
      'audio/m4a',
      'audio/aac',
    ]);
    const rawMime = (data.mimetype || 'audio/webm').toLowerCase().split(';')[0].trim();
    if (!validMimes.has(rawMime)) {
      throw new BadRequestError('Invalid audio file type');
    }

    const buf = await data.toBuffer();
    if (buf.length > 25 * 1024 * 1024) {
      throw new BadRequestError('Audio file exceeds maximum 25MB limit');
    }

    const safeFilename = (data.filename || 'recording.webm').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = safeFilename.includes('.') ? safeFilename.split('.').pop() || 'webm' : 'webm';
    const fileKey = `submissions/${id}/${questionId}-${Date.now()}.${ext}`;

    const uploadedUrl = await storage.putObject(fileKey, buf, rawMime);
    const now = new Date();

    const responsePayload = {
      type: 'AUDIO',
      audioUrl: uploadedUrl,
      fileKey,
      mimeType: rawMime,
      filename: safeFilename,
      uploadedAt: now.toISOString(),
    };

    try {
      await db.transaction(async (tx) => {
        await tx
          .insert(schema.submissionResponses)
          .values({
            submissionId: id,
            questionId,
            responsePayload,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.submissionResponses.submissionId, schema.submissionResponses.questionId],
            set: {
              responsePayload,
              updatedAt: now,
            },
          });

        if (sub.status === SubmissionStatus.STARTED) {
          await tx
            .update(schema.submissions)
            .set({ status: SubmissionStatus.IN_PROGRESS })
            .where(eq(schema.submissions.id, id));
        }
      });
    } catch (dbErr) {
      try {
        await storage.deleteObject(fileKey);
      } catch (cleanupErr) {
        fastify.log.error(cleanupErr, 'Failed to clean up orphaned S3 object');
      }
      throw dbErr;
    }

    return reply.status(200).send({
      success: true,
      audioUrl: uploadedUrl,
      questionId,
      savedAt: now.toISOString(),
    });
  });

  // 3c. Secure Audio Playback URL
  fastify.get('/:id/audio/:questionId', { preHandler: [authenticate] }, async (request) => {
    const { id, questionId } = request.params as { id: string; questionId: string };
    const user = request.user!;

    const [sub] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id));
    if (!sub) throw new NotFoundError('Submission not found');

    if (user.role === UserRole.STUDENT && sub.learnerId !== user.id) {
      throw new ForbiddenError('You can only access audio for your own submission');
    }

    if (user.role === UserRole.TEACHER) {
      await assertTeacherSubmissionAccess(user, sub);
    }

    const [resp] = await db
      .select()
      .from(schema.submissionResponses)
      .where(
        and(
          eq(schema.submissionResponses.submissionId, id),
          eq(schema.submissionResponses.questionId, questionId)
        )
      );

    if (!resp || !resp.responsePayload) {
      throw new NotFoundError('No audio response found for this question');
    }

    const payload = resp.responsePayload as Record<string, any>;
    if (!payload.fileKey) {
      return { audioUrl: payload.audioUrl || '' };
    }

    const signedUrl = await storage.getSignedUrl(payload.fileKey, 3600);
    return { audioUrl: signedUrl };
  });

  // 4. Submit Assessment
  fastify.post('/:id/submit', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const [sub] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id));
    if (!sub) throw new NotFoundError('Submission not found');

    if (user.role === UserRole.STUDENT && sub.learnerId !== user.id) {
      throw new ForbiddenError('You can only submit your own assessment');
    }

    if (sub.status === SubmissionStatus.SUBMITTED || sub.status === SubmissionStatus.EVALUATED) {
      // Idempotent: return existing submission
      return reply.status(200).send({
        ...sub,
        startedAt: sub.startedAt.toISOString(),
        submittedAt: sub.submittedAt?.toISOString(),
        evaluatedAt: sub.evaluatedAt?.toISOString(),
      });
    }

    const body = SubmitAssessmentRequestSchema.parse({
      ...((request.body as any) || {}),
      submissionId: id,
    });

    const now = new Date();

    // Check assignment status & late submission policy
    const [assignment] = sub.assignmentId
      ? await db.select().from(schema.assignments).where(eq(schema.assignments.id, sub.assignmentId))
      : [null];

    if (assignment && assignment.status === 'CLOSED') {
      throw new BadRequestError('Assignment is closed and cannot accept submissions');
    }

    const [assessment] = await db
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.id, sub.assessmentId));

    let isLate = false;
    let lateMinutes = 0;
    const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes grace period

    if (assignment?.dueAt) {
      const dueTime = new Date(assignment.dueAt).getTime();
      const diff = now.getTime() - dueTime;
      if (diff > GRACE_PERIOD_MS) {
        isLate = true;
        lateMinutes = Math.max(lateMinutes, Math.ceil(diff / (60 * 1000)));
      }
    }

    if (assessment?.timeLimitMinutes) {
      const maxDurationMs = assessment.timeLimitMinutes * 60 * 1000;
      const elapsedMs = now.getTime() - new Date(sub.startedAt).getTime();
      const diff = elapsedMs - maxDurationMs;
      if (diff > GRACE_PERIOD_MS) {
        isLate = true;
        lateMinutes = Math.max(lateMinutes, Math.ceil(diff / (60 * 1000)));
      }
    }

    // Verify all answer questionIds belong to this assessment
    const items = await db
      .select()
      .from(schema.assessmentItems)
      .where(eq(schema.assessmentItems.assessmentId, sub.assessmentId));

    const validQuestionIds = new Set(items.map((i) => i.questionId));
    const seenAnswerQIds = new Set<string>();
    for (const ans of body.answers) {
      if (seenAnswerQIds.has(ans.questionId)) {
        throw new BadRequestError(`Duplicate questionId ${ans.questionId} in submission answers`);
      }
      seenAnswerQIds.add(ans.questionId);
      if (!validQuestionIds.has(ans.questionId)) {
        throw new BadRequestError(`Question ${ans.questionId} does not belong to this assessment`);
      }
    }

    const result = await db.transaction(async (tx) => {
      const questionIds = items.map((i) => i.questionId);
      const questions = await tx
        .select()
        .from(schema.questions)
        .where(inArray(schema.questions.id, questionIds));

      const qSkills = await tx
        .select()
        .from(schema.questionSkills)
        .where(inArray(schema.questionSkills.questionId, questionIds));

      let totalEarnedPoints = 0;
      let totalMaxPoints = items.reduce((sum, it) => sum + (it.points || 1.0), 0);
      let autoGradableCount = 0;

      // Process and save answers
      for (const ans of body.answers) {
        const question = questions.find((q) => q.id === ans.questionId);
        const item = items.find((i) => i.questionId === ans.questionId);
        const itemPoints = item?.points || 1.0;

        let isCorrect: boolean | null = null;
        let normalizedScore: number | null = null;
        let rawScore: number | null = null;

        if (question?.type === 'MCQ' && question.correctAnswer) {
          autoGradableCount++;
          isCorrect = String(ans.responsePayload).trim() === question.correctAnswer.trim();
          normalizedScore = isCorrect ? 1.0 : 0.0;
          rawScore = isCorrect ? itemPoints : 0;
          totalEarnedPoints += rawScore;
        }

        await tx
          .insert(schema.submissionResponses)
          .values({
            submissionId: id,
            questionId: ans.questionId,
            responsePayload: ans.responsePayload,
            isCorrect,
            rawScore,
            normalizedScore,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.submissionResponses.submissionId, schema.submissionResponses.questionId],
            set: {
              responsePayload: ans.responsePayload,
              isCorrect,
              rawScore,
              normalizedScore,
              updatedAt: now,
            },
          });
      }

      const isFullyAutoGraded = autoGradableCount === items.length && items.length > 0;
      const overallScore = isFullyAutoGraded
        ? Math.round((totalEarnedPoints / totalMaxPoints) * 100)
        : null;

      const newStatus = isFullyAutoGraded ? SubmissionStatus.EVALUATED : SubmissionStatus.SUBMITTED;

      const [updatedSub] = await tx
        .update(schema.submissions)
        .set({
          status: newStatus,
          submittedAt: now,
          evaluatedAt: isFullyAutoGraded ? now : null,
          evaluatorType: isFullyAutoGraded ? EvaluatorType.AUTO : sub.evaluatorType,
          overallScore,
          maxPossibleScore: 100,
          isLate,
          lateMinutes,
        })
        .where(eq(schema.submissions.id, id))
        .returning();

      // Ingest evidence for auto-graded questions with idempotency
      if (isFullyAutoGraded) {
        const affectedSkillIds = new Set<string>();

        for (const ans of body.answers) {
          const question = questions.find((q) => q.id === ans.questionId);
          const skillsForQ = qSkills.filter((qs) => qs.questionId === ans.questionId);
          const isCorrect = String(ans.responsePayload).trim() === question?.correctAnswer?.trim();
          const normScore = isCorrect ? 1.0 : 0.0;

          for (const qs of skillsForQ) {
            affectedSkillIds.add(qs.skillId);
            await tx
              .insert(schema.learningEvidence)
              .values({
                learnerId: sub.learnerId,
                skillId: qs.skillId,
                questionId: ans.questionId,
                assessmentId: sub.assessmentId,
                submissionId: sub.id,
                evidenceType: EvidenceType.QUESTION_RESULT,
                evaluatorType: EvaluatorType.AUTO,
                observedValue: String(ans.responsePayload),
                normalizedScore: normScore,
                difficulty: question?.difficulty || 'MEDIUM',
                weight: qs.weight ?? 1.0,
                observedAt: now,
                sourceMaterialId: question?.sourceMaterialId || null,
              })
              .onConflictDoUpdate({
                target: [
                  schema.learningEvidence.submissionId,
                  schema.learningEvidence.questionId,
                  schema.learningEvidence.skillId,
                  schema.learningEvidence.evidenceType,
                ],
                set: {
                  normalizedScore: normScore,
                  observedValue: String(ans.responsePayload),
                  observedAt: now,
                },
              });
          }
        }

        // Recompute affected learner skill states
        for (const skillId of affectedSkillIds) {
          await recomputeLearnerSkillState(tx, sub.learnerId, skillId);
        }

        // Mark pending recommendations stale
        await tx
          .update(schema.recommendations)
          .set({ decisionStatus: 'STALE' })
          .where(
            and(
              eq(schema.recommendations.learnerId, sub.learnerId),
              eq(schema.recommendations.decisionStatus, 'PENDING')
            )
          );
      }

      await tx.insert(schema.auditEvents).values({
        actorId: user.id,
        actorRole: user.role,
        action: 'SUBMISSION_SUBMITTED',
        entityType: 'SUBMISSION',
        entityId: id,
        metadata: { overallScore, isAutoGraded: isFullyAutoGraded, isLate, lateMinutes },
      });

      return updatedSub;
    });

    return reply.status(200).send({
      ...result,
      startedAt: result.startedAt.toISOString(),
      submittedAt: result.submittedAt?.toISOString(),
      evaluatedAt: result.evaluatedAt?.toISOString(),
    });
  });

  // 5. Evaluate Submission (Teacher rubric grading)
  fastify.post('/:id/evaluate', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const [sub] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, id));
    if (!sub) throw new NotFoundError('Submission not found');

    if (sub.status !== SubmissionStatus.SUBMITTED && sub.status !== SubmissionStatus.EVALUATED) {
      throw new BadRequestError('Cannot evaluate a submission that has not been submitted');
    }

    if (user.role === UserRole.TEACHER) {
      await assertTeacherSubmissionAccess(user, sub);
    }

    const body = EvaluateSubmissionRequestSchema.parse({
      ...((request.body as any) || {}),
      submissionId: id,
    });

    if (!body.responses || body.responses.length === 0) {
      throw new BadRequestError('Evaluation responses cannot be empty');
    }

    // Validate that all response questionIds belong to assessment, no duplicates, and valid score bounds
    const items = await db
      .select()
      .from(schema.assessmentItems)
      .where(eq(schema.assessmentItems.assessmentId, sub.assessmentId));
    const validQuestionIds = new Set(items.map((i) => i.questionId));
    const itemMap = new Map(items.map((i) => [i.questionId, i]));
    const seenResponseQIds = new Set<string>();

    for (const r of body.responses) {
      if (seenResponseQIds.has(r.questionId)) {
        throw new BadRequestError(`Duplicate questionId ${r.questionId} in evaluation responses`);
      }
      seenResponseQIds.add(r.questionId);

      if (!validQuestionIds.has(r.questionId)) {
        throw new BadRequestError(`Question ${r.questionId} does not belong to this assessment`);
      }

      const item = itemMap.get(r.questionId);
      const expectedMax = item?.points ?? 1.0;
      if (Math.abs(r.maxScore - expectedMax) > 0.001) {
        throw new BadRequestError(
          `Invalid maxScore for question ${r.questionId}: expected ${expectedMax}, got ${r.maxScore}`
        );
      }

      if (r.maxScore <= 0) {
        throw new BadRequestError(`Invalid maxScore for question ${r.questionId}: must be greater than 0`);
      }

      if (r.rawScore < 0 || r.rawScore > r.maxScore) {
        throw new BadRequestError(
          `Invalid rawScore for question ${r.questionId}: must be between 0 and maxScore (${r.maxScore})`
        );
      }
    }

    if (body.responses.length !== items.length || items.some((it) => !seenResponseQIds.has(it.questionId))) {
      throw new BadRequestError('Evaluation payload must contain responses for all assessment items');
    }

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      let totalRaw = 0;
      let totalMax = 0;

      const questions = await tx.select().from(schema.questions);
      const qSkills = await tx.select().from(schema.questionSkills);
      const affectedSkillIds = new Set<string>();

      for (const r of body.responses) {
        const normScore = Math.min(1.0, Math.max(0, r.rawScore / r.maxScore));
        totalRaw += r.rawScore;
        totalMax += r.maxScore;
        const isCorrect = r.isCorrect ?? normScore >= 0.7;

        await tx
          .insert(schema.submissionResponses)
          .values({
            submissionId: id,
            questionId: r.questionId,
            isCorrect,
            rawScore: r.rawScore,
            normalizedScore: normScore,
            teacherFeedback: r.teacherFeedback || null,
            rubricScores: r.rubricScores || null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.submissionResponses.submissionId, schema.submissionResponses.questionId],
            set: {
              isCorrect,
              rawScore: r.rawScore,
              normalizedScore: normScore,
              teacherFeedback: r.teacherFeedback || null,
              rubricScores: r.rubricScores || null,
              updatedAt: now,
            },
          });

        // Insert/update evidence with idempotency
        const question = questions.find((q) => q.id === r.questionId);
        const skillsForQ = qSkills.filter((qs) => qs.questionId === r.questionId);

        for (const qs of skillsForQ) {
          affectedSkillIds.add(qs.skillId);
          await tx
            .insert(schema.learningEvidence)
            .values({
              learnerId: sub.learnerId,
              skillId: qs.skillId,
              questionId: r.questionId,
              assessmentId: sub.assessmentId,
              submissionId: sub.id,
              evidenceType: EvidenceType.RUBRIC_RESULT,
              evaluatorType: EvaluatorType.TEACHER,
              observedValue: JSON.stringify(r.rubricScores || r.rawScore),
              normalizedScore: normScore,
              difficulty: question?.difficulty || 'MEDIUM',
              weight: qs.weight ?? 1.0,
              observedAt: now,
              sourceMaterialId: question?.sourceMaterialId || null,
            })
            .onConflictDoUpdate({
              target: [
                schema.learningEvidence.submissionId,
                schema.learningEvidence.questionId,
                schema.learningEvidence.skillId,
                schema.learningEvidence.evidenceType,
              ],
              set: {
                normalizedScore: normScore,
                observedValue: JSON.stringify(r.rubricScores || r.rawScore),
                observedAt: now,
              },
            });
        }
      }

      // Recompute learner skill states
      for (const skillId of affectedSkillIds) {
        await recomputeLearnerSkillState(tx, sub.learnerId, skillId);
      }

      // Mark pending recommendations stale
      await tx
        .update(schema.recommendations)
        .set({ decisionStatus: 'STALE' })
        .where(
          and(
            eq(schema.recommendations.learnerId, sub.learnerId),
            eq(schema.recommendations.decisionStatus, 'PENDING')
          )
        );

      const rawOverall = totalMax > 0 ? Math.round((totalRaw / totalMax) * 100) : 0;
      const overallScore = Math.min(100, Math.max(0, rawOverall));

      const [updatedSub] = await tx
        .update(schema.submissions)
        .set({
          status: SubmissionStatus.EVALUATED,
          evaluatedAt: now,
          evaluatorId: user.id,
          evaluatorType: EvaluatorType.TEACHER,
          overallScore,
          teacherFeedback: body.overallTeacherFeedback || null,
        })
        .where(eq(schema.submissions.id, id))
        .returning();

      await tx.insert(schema.auditEvents).values({
        actorId: user.id,
        actorRole: user.role,
        action: 'SUBMISSION_EVALUATED',
        entityType: 'SUBMISSION',
        entityId: id,
        metadata: { overallScore, evaluatorId: user.id },
      });

      return updatedSub;
    });

    return reply.status(200).send({
      ...result,
      startedAt: result.startedAt.toISOString(),
      submittedAt: result.submittedAt?.toISOString(),
      evaluatedAt: result.evaluatedAt?.toISOString(),
    });
  });
};
