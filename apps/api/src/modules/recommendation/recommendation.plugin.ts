import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import { authenticate, requireRole, assertLearnerAccess, assertClassAccess } from '../../infrastructure/auth/auth.js';
import {
  TeacherDecisionRequestSchema,
  TeacherDecisionStatus,
  RecommendationAction,
  ConfidenceLevel,
  CEFRLevel,
  UserRole,
  AssignNextActivityRequestSchema,
  AssessmentStatus,
  SubmissionStatus,
  MaterialStatus,
} from '@acorn/contracts';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../shared/errors.js';
import { computeSkillState } from '../learner-state/learner-state.service.js';

export const recommendationPlugin: FastifyPluginAsync = async (fastify) => {
  // Get recommendation for a learner
  fastify.get('/learner/:learnerId', { preHandler: [authenticate] }, async (request, reply) => {
    const { learnerId } = request.params as { learnerId: string };
    const user = request.user!;

    await assertLearnerAccess(user, learnerId);

    const [learner] = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.users)
      .where(eq(schema.users.id, learnerId));

    if (!learner) throw new NotFoundError('Learner not found');

    // Pick by what the reader can act on, not by whichever row is newest.
    //
    // Ordering by created_at alone meant a recommendation that had already been
    // accepted or rejected kept its place at the top - milliseconds ahead of a
    // sibling - so the workspace reopened a finished decision while the one
    // actually waiting was never shown, and the count on the teacher's home
    // screen pointed at a card nobody could reach.
    const learnerRecs = await db
      .select()
      .from(schema.recommendations)
      .where(eq(schema.recommendations.learnerId, learnerId))
      .orderBy(desc(schema.recommendations.createdAt));

    // A learner sees a suggestion only once a teacher has accepted it.
    let rec =
      user.role === UserRole.STUDENT
        ? learnerRecs.find(
            (r) => r.decisionStatus === TeacherDecisionStatus.ACCEPT && !r.isStale
          )
        : learnerRecs.find(
            (r) => r.decisionStatus === TeacherDecisionStatus.PENDING && !r.isStale
          );

    if (user.role === UserRole.STUDENT && !rec) {
      return reply.status(200).send(null);
    }

    // Nothing waiting on a decision, so fall back to the last one accepted.
    // Accepting is not the end of the job - the teacher still has to assign the
    // activity - so the card has to survive the decision that approved it.
    // Rejected and modified ones never come back this way, which is what makes
    // "no, something else" actually move on.
    if (!rec && user.role !== UserRole.STUDENT) {
      const accepted = await db
        .select({ recommendation: schema.recommendations })
        .from(schema.recommendations)
        .innerJoin(
          schema.teacherDecisions,
          eq(schema.teacherDecisions.recommendationId, schema.recommendations.id)
        )
        .where(
          and(
            eq(schema.recommendations.learnerId, learnerId),
            eq(schema.recommendations.isStale, false),
            eq(schema.recommendations.decisionStatus, TeacherDecisionStatus.ACCEPT)
          )
        )
        .orderBy(desc(schema.teacherDecisions.decidedAt))
        .limit(1);

      rec = accepted[0]?.recommendation;
    }

    // Nothing outstanding, so work out what to suggest next. Rejecting reaches
    // here on the next load, which is what makes "no, something else" a usable
    // answer rather than a dead end (staff only).
    if (!rec) {
      if (user.role === UserRole.STUDENT) {
        return reply.status(200).send(null);
      }
      // 1. Fetch learner's evidence
      const learnerEvidence = await db
        .select()
        .from(schema.learningEvidence)
        .where(eq(schema.learningEvidence.learnerId, learnerId))
        .orderBy(desc(schema.learningEvidence.observedAt));

      // 2. Fetch all skills
      const allSkills = await db.select().from(schema.skills).orderBy(asc(schema.skills.code));

      // Determine the learner's target skill needing practice:
      // Lowest scoring skill with evidence, or if no evidence, the first skill
      let targetSkill = allSkills[0];
      let lowestScore = Infinity;
      let targetEvidenceCount = 0;
      let targetEvidenceIds: string[] = [];
      let targetState = computeSkillState([]);

      for (const skill of allSkills) {
        const evs = learnerEvidence.filter((e) => e.skillId === skill.id && !e.isSuperseded);
        if (evs.length > 0) {
          const st = computeSkillState(evs);
          if (st.score !== null && st.score < lowestScore) {
            lowestScore = st.score;
            targetSkill = skill;
            targetEvidenceCount = evs.length;
            targetEvidenceIds = evs.map((e) => e.id);
            targetState = st;
          }
        }
      }

      // If no skills had evidence, target the first skill
      if (lowestScore === Infinity && allSkills.length > 0) {
        targetSkill = allSkills[0];
        targetEvidenceCount = 0;
        targetEvidenceIds = [];
        targetState = computeSkillState([]);
      }

      // 3. Find candidate materials from PostgreSQL
      // G05: Materials are approved after review (APPROVED status).
      // The original code looked for 'ACTIVE' which is not a valid material status.
      // Fetch learner's classes
      const enrollments = await db
        .select({ classId: schema.classEnrollments.classId })
        .from(schema.classEnrollments)
        .where(eq(schema.classEnrollments.learnerId, learnerId));
      const learnerClassIds = enrollments.map((e) => e.classId);

      // Fetch materials released to those classes
      let releasedMaterialIds = new Set<string>();
      if (learnerClassIds.length > 0) {
        const classMaterials = await db
          .select({ materialId: schema.classMaterials.materialId })
          .from(schema.classMaterials)
          .where(inArray(schema.classMaterials.classId, learnerClassIds));
        releasedMaterialIds = new Set(classMaterials.map((cm) => cm.materialId));
      }

      const allMaterialsQuery = await db
        .select()
        .from(schema.materials)
        .where(eq(schema.materials.status, MaterialStatus.APPROVED))
        .orderBy(desc(schema.materials.usageCount));

      const allMaterials = allMaterialsQuery.filter((m) => releasedMaterialIds.has(m.id));


      const matchingMaterials = allMaterials.filter((m) => m.primarySkillId === targetSkill.id);

      const candidatePlans: Array<{
        materialId: string;
        action: RecommendationAction;
        matchReason: string;
      }> = [];

      if (matchingMaterials.length > 0) {
        // Direct reuse candidate
        const exactMatch = matchingMaterials.find((m) => m.level === (targetSkill.level as CEFRLevel)) || matchingMaterials[0];
        candidatePlans.push({
          materialId: exactMatch.id,
          action: RecommendationAction.REUSE,
          matchReason: `Direct skill match for ${targetSkill.name} from teacher library.`,
        });

        // Adapt candidate if another material is available
        const adaptMatch = matchingMaterials.find((m) => m.id !== exactMatch.id);
        if (adaptMatch) {
          candidatePlans.push({
            materialId: adaptMatch.id,
            action: RecommendationAction.ADAPT,
            matchReason: `Adaptable passage for targeted ${targetSkill.level || 'B1'} skill practice.`,
          });
        }
      } else if (allMaterials.length > 0) {
        // No direct skill match: offer general material with NO_MATCH
        candidatePlans.push({
          materialId: allMaterials[0].id,
          action: RecommendationAction.NO_MATCH,
          matchReason: `No existing materials currently match ${targetSkill.name}. Author new material in library.`,
        });
      }

      const recId = randomUUID();
      const now = new Date();

      const rationale = {
        texts: [
          targetEvidenceCount > 0
            ? `Performance in ${targetSkill.name} is lower than target mastery.`
            : `Foundational practice in ${targetSkill.name} to establish baseline evidence.`,
          `Aligned with CEFR ${targetSkill.level || 'B1'} curriculum objectives.`,
          `Grounded in ${targetEvidenceCount} recorded learning evidence observation(s).`,
        ],
        grounding: {
          timestamp: now.toISOString(),
          effectiveEvidenceCount: targetEvidenceCount,
          evidenceIds: targetEvidenceIds,
          targetSkillId: targetSkill.id,
          targetSkillName: targetSkill.name,
          score: targetState.score,
          confidence: targetState.confidence,
        }
      };

      rec = await db.transaction(async (tx) => {
        const [newRec] = await tx
          .insert(schema.recommendations)
          .values({
            id: recId,
            learnerId,
            targetSkillId: targetSkill.id,
            targetLevel: (targetSkill.level as CEFRLevel) || CEFRLevel.B1,
            priority: (targetState.scorePercentage ?? 100) < 60 ? 'HIGH' : 'MEDIUM',
            recommendedActionText: `Focus on ${targetSkill.name}`,
            rationale,
            evidenceBasisCount: targetEvidenceCount,
            learnerCurrentScore: targetState.score,
            learnerConfidence: targetState.confidence,
            decisionStatus: TeacherDecisionStatus.PENDING,
            createdAt: now,
          })
          .returning();

        for (const cp of candidatePlans) {
          await tx.insert(schema.recommendationCandidates).values({
            id: randomUUID(),
            recommendationId: recId,
            materialId: cp.materialId,
            action: cp.action,
            matchReason: cp.matchReason,
          });
        }

        return newRec;
      });
    }

    // Load candidates from PostgreSQL
    const candidateRows = await db
      .select()
      .from(schema.recommendationCandidates)
      .where(eq(schema.recommendationCandidates.recommendationId, rec.id));

    const materialIds = candidateRows.map((c) => c.materialId);
    const materials = materialIds.length > 0
      ? await db.select().from(schema.materials).where(inArray(schema.materials.id, materialIds))
      : [];

    const matMap = new Map(materials.map((m) => [m.id, m]));

    const candidates = candidateRows.map((rc) => {
      const mat = matMap.get(rc.materialId);
      return {
        materialId: rc.materialId,
        title: mat?.title || 'Target Practice Material',
        type: (mat?.type as any) || 'ARTICLE',
        level: (mat?.level as CEFRLevel) || CEFRLevel.B1,
        estimatedMinutes: mat?.estimatedMinutes || 10,
        action: rc.action as RecommendationAction,
        matchReason: rc.matchReason,
        tags: ['ielts', 'reading'],
        previouslyUsedCount: mat?.usageCount || 0,
      };
    });

    const [targetSkill] = await db
      .select()
      .from(schema.skills)
      .where(eq(schema.skills.id, rec.targetSkillId));

    const [decision] = await db
      .select()
      .from(schema.teacherDecisions)
      .where(eq(schema.teacherDecisions.recommendationId, rec.id))
      .orderBy(desc(schema.teacherDecisions.decidedAt))
      .limit(1);

    return {
      id: rec.id,
      learnerId: rec.learnerId,
      learnerName: learner.name,
      targetSkillId: rec.targetSkillId,
      targetSkillName: targetSkill?.name || 'Skill',
      targetLevel: rec.targetLevel as CEFRLevel,
      priority: rec.priority as 'HIGH' | 'MEDIUM' | 'LOW',
      recommendedActionText: rec.recommendedActionText,
      rationale: rec.rationale,
      evidenceBasisCount: rec.evidenceBasisCount,
      learnerCurrentScore: rec.learnerCurrentScore,
      learnerConfidence: rec.learnerConfidence as ConfidenceLevel,
      decisionStatus: rec.decisionStatus as TeacherDecisionStatus,
      createdAt: rec.createdAt.toISOString(),
      candidates,
      teacherDecision: decision
        ? {
            id: decision.id,
            decision: decision.decision as TeacherDecisionStatus,
            teacherNotes: decision.teacherNotes || undefined,
            selectedMaterialId: decision.selectedMaterialId || undefined,
            decidedAt: decision.decidedAt.toISOString(),
          }
        : null,
    };
  });

  // Record teacher decision (ACCEPT, MODIFY, REJECT)
  fastify.post('/:id/decision', {
    preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const [rec] = await db
      .select()
      .from(schema.recommendations)
      .where(eq(schema.recommendations.id, id));

    if (!rec) throw new NotFoundError('Recommendation not found');

    if (rec.isStale) {
      throw new BadRequestError('Cannot make a decision on a STALE recommendation. Refresh to get a new one.');
    }

    // One decision per recommendation. Without this a teacher could record
    // ACCEPT and then REJECT on the same card, leaving several rows against one
    // recommendation - which is how the acceptance rate came to exceed 100%,
    // and why a rejected card still offered its three buttons.
    if (rec.decisionStatus !== TeacherDecisionStatus.PENDING) {
      throw new BadRequestError(
        `This recommendation was already decided (${rec.decisionStatus}). Refresh to get the next one.`
      );
    }

    await assertLearnerAccess(user, rec.learnerId);

    const body = TeacherDecisionRequestSchema.parse({
      ...((request.body as any) || {}),
      recommendationId: id,
    });

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // Update recommendation status
      await tx
        .update(schema.recommendations)
        .set({
          decisionStatus: body.decision,
          recommendedActionText: body.modifiedActionText || rec.recommendedActionText,
        })
        .where(eq(schema.recommendations.id, id));

      const [decisionRow] = await tx
        .insert(schema.teacherDecisions)
        .values({
          id: randomUUID(),
          recommendationId: id,
          decision: body.decision,
          teacherNotes: body.teacherNotes || null,
          selectedMaterialId: body.selectedMaterialId || null,
          decidedAt: now,
          teacherId: user.id,
        })
        .returning();

      await tx.insert(schema.auditEvents).values({
        actorId: user.id,
        actorRole: user.role,
        action: 'TEACHER_DECISION_RECORDED',
        entityType: 'RECOMMENDATION',
        entityId: id,
        metadata: {
          decision: body.decision,
          selectedMaterialId: body.selectedMaterialId,
          teacherNotes: body.teacherNotes,
        },
      });

      return decisionRow;
    });

    return {
      ...result,
      decidedAt: result.decidedAt.toISOString(),
    };
  });

  // Assign Next Activity from Recommendation
  fastify.post('/:id/assign-next-activity', {
    preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;
    const rawBody = (request.body as any) || {};

    const result = await db.transaction(async (tx) => {
      // 1. Lock recommendation row to serialize concurrent transitions
      const [rec] = await tx
        .select()
        .from(schema.recommendations)
        .where(eq(schema.recommendations.id, id))
        .for('update');

      if (!rec) throw new NotFoundError('Recommendation not found');

      // Reject stale or rejected recommendations
      if (rec.isStale) {
        throw new BadRequestError('Cannot act on a STALE recommendation');
      }
      if (
        rec.decisionStatus === 'REJECT' ||
        rec.decisionStatus === TeacherDecisionStatus.REJECT
      ) {
        throw new BadRequestError(`Cannot act on a ${rec.decisionStatus} recommendation`);
      }

      if (rawBody.learnerId && rawBody.learnerId !== rec.learnerId) {
        throw new BadRequestError('Learner ID does not match recommendation');
      }

      const body = AssignNextActivityRequestSchema.parse({
        learnerId: rec.learnerId,
        ...rawBody,
      });

      // G07: Require valid activity content (materialId or assessmentId) so we don't return an empty 200 success
      if (!body.assessmentId && !body.materialId) {
        throw new BadRequestError('Must specify either a materialId or an assessmentId to assign a next activity');
      }

      await assertLearnerAccess(user, rec.learnerId);

      // 2. Idempotency check: If already assigned, verify payload consistency and return existing assignment
      const [audit] = await tx
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.action, 'NEXT_ACTIVITY_ASSIGNED'),
            eq(schema.auditEvents.entityType, 'RECOMMENDATION'),
            eq(schema.auditEvents.entityId, id)
          )
        )
        .orderBy(desc(schema.auditEvents.timestamp))
        .limit(1);

      if (rec.decisionStatus === TeacherDecisionStatus.ACCEPT && audit) {
        const [existingDecision] = await tx
          .select()
          .from(schema.teacherDecisions)
          .where(eq(schema.teacherDecisions.recommendationId, id))
          .orderBy(desc(schema.teacherDecisions.decidedAt))
          .limit(1);

        const meta = (audit?.metadata as any) || {};

        // A retry must still be authorized for the class that received the activity.
        // Learner access alone can come from a different class taught by this teacher.
        const assignedClassId = meta.classId ?? meta.requestedClassId ?? body.classId;
        if (assignedClassId) {
          await assertClassAccess(user, assignedClassId);
        }

        // Verify full payload consistency: reject if any meaningful field differs
        const prevMaterialId = meta.materialId ?? null;
        const reqMaterialId = body.materialId ?? null;
        if (reqMaterialId !== prevMaterialId) {
          throw new BadRequestError('Recommendation already accepted with different parameters (materialId mismatch)');
        }

        const prevAssessmentId = meta.assessmentId ?? null;
        const reqAssessmentId = body.assessmentId ?? null;
        if (reqAssessmentId !== prevAssessmentId) {
          throw new BadRequestError('Recommendation already accepted with different parameters (assessmentId mismatch)');
        }

        const prevRequestedClassId = meta.requestedClassId ?? meta.classId ?? null;
        const reqClassId = body.classId ?? null;
        if (reqClassId !== prevRequestedClassId) {
          throw new BadRequestError('Recommendation already accepted with different parameters (classId mismatch)');
        }

        const prevInstructions = meta.instructions ?? null;
        const reqInstructions = body.instructions ?? null;
        if (reqInstructions !== prevInstructions) {
          throw new BadRequestError('Recommendation already accepted with different parameters (instructions mismatch)');
        }

        let prevDueAt = meta.dueAt ?? null;
        if (!prevDueAt && meta.assignmentId) {
          const [assign] = await tx
            .select({ dueAt: schema.assignments.dueAt })
            .from(schema.assignments)
            .where(eq(schema.assignments.id, meta.assignmentId));
          if (assign?.dueAt) {
            prevDueAt = assign.dueAt.toISOString();
          }
        }
        const prevDueAtNormalized = prevDueAt ? new Date(prevDueAt).toISOString() : null;
        const reqDueAtNormalized = body.dueAt ? new Date(body.dueAt).toISOString() : null;
        if (reqDueAtNormalized !== prevDueAtNormalized) {
          throw new BadRequestError('Recommendation already accepted with different parameters (dueAt mismatch)');
        }

        const prevActivityTitle = meta.activityTitle ?? null;
        const reqActivityTitle = body.activityTitle ?? null;
        if (reqActivityTitle !== prevActivityTitle) {
          throw new BadRequestError('Recommendation already accepted with different parameters (activityTitle mismatch)');
        }

        const prevNotes = meta.notes ?? null;
        const reqNotes = body.notes ?? null;
        if (reqNotes !== prevNotes) {
          throw new BadRequestError('Recommendation already accepted with different parameters (notes mismatch)');
        }

        return {
          success: true,
          recommendationId: id,
          decisionId: existingDecision?.id,
          assignmentId: meta.assignmentId ?? null,
          materialId: existingDecision?.selectedMaterialId ?? meta.materialId ?? null,
        };
      }

      // Class resolution logic
      let targetClassId: string | null = null;

      if (body.classId) {
        await assertClassAccess(user, body.classId);

        const [enrollment] = await tx
          .select({ id: schema.classEnrollments.id })
          .from(schema.classEnrollments)
          .where(
            and(
              eq(schema.classEnrollments.classId, body.classId),
              eq(schema.classEnrollments.learnerId, rec.learnerId)
            )
          );

        if (!enrollment) {
          throw new BadRequestError(`Learner ${rec.learnerId} is not enrolled in class ${body.classId}`);
        }
        targetClassId = body.classId;
      } else if (body.materialId) {
        // When classId is omitted but a material release is needed:
        // Check teacher ownership and learner enrollment without selecting arbitrary classes
        let authorizedClasses: { id: string }[] = [];
        if (user.role === UserRole.ADMIN) {
          authorizedClasses = await tx
            .select({ id: schema.classEnrollments.classId })
            .from(schema.classEnrollments)
            .where(eq(schema.classEnrollments.learnerId, rec.learnerId));
        } else {
          authorizedClasses = await tx
            .select({ id: schema.classes.id })
            .from(schema.classes)
            .innerJoin(
              schema.classEnrollments,
              eq(schema.classes.id, schema.classEnrollments.classId)
            )
            .where(
              and(
                eq(schema.classes.teacherId, user.id),
                eq(schema.classEnrollments.learnerId, rec.learnerId)
              )
            );
        }

        if (authorizedClasses.length === 0) {
          throw new ForbiddenError('Teacher does not teach any class this learner is enrolled in');
        }
        if (authorizedClasses.length > 1) {
          throw new BadRequestError('Learner is enrolled in multiple classes; please specify classId explicitly');
        }
        targetClassId = authorizedClasses[0].id;
      }

      const now = new Date();
      let createdAssignmentId: string | null = null;
      let releasedMaterialId: string | null = null;

      // 3. If assessmentId is specified, create an assignment for the learner or class
      if (body.assessmentId) {
        const [ass] = await tx
          .select()
          .from(schema.assessments)
          .where(eq(schema.assessments.id, body.assessmentId));

        if (!ass) throw new NotFoundError('Assessment not found');
        if (ass.status !== AssessmentStatus.PUBLISHED) {
          throw new BadRequestError('Cannot assign an assessment that is not published');
        }

        const existingAssignments = await tx
          .select()
          .from(schema.assignments)
          .where(
            and(
              eq(schema.assignments.assessmentId, body.assessmentId),
              targetClassId ? eq(schema.assignments.classId, targetClassId) : eq(schema.assignments.learnerId, rec.learnerId),
              eq(schema.assignments.status, 'OPEN')
            )
          );

        let assignment = existingAssignments[0];
        if (!assignment) {
          const [newAssign] = await tx
            .insert(schema.assignments)
            .values({
              assessmentId: body.assessmentId,
              classId: targetClassId || null,
              learnerId: targetClassId ? null : rec.learnerId,
              dueAt: body.dueAt ? new Date(body.dueAt) : null,
              status: 'OPEN',
            })
            .returning();
          assignment = newAssign;
        }

        createdAssignmentId = assignment.id;

        // Create initial submission for the learner(s)
        const targetLearnerIds = [rec.learnerId];
        if (targetClassId) {
          const enrollments = await tx
            .select({ learnerId: schema.classEnrollments.learnerId })
            .from(schema.classEnrollments)
            .where(eq(schema.classEnrollments.classId, targetClassId));
          for (const e of enrollments) {
            targetLearnerIds.push(e.learnerId);
          }
        }

        for (const lId of Array.from(new Set(targetLearnerIds))) {
          const existingSub = await tx
            .select({ id: schema.submissions.id })
            .from(schema.submissions)
            .where(
              and(
                eq(schema.submissions.assignmentId, assignment.id),
                eq(schema.submissions.learnerId, lId)
              )
            );

          if (existingSub.length === 0) {
            await tx.insert(schema.submissions).values({
              assignmentId: assignment.id,
              assessmentId: body.assessmentId,
              learnerId: lId,
              status: SubmissionStatus.STARTED,
              maxPossibleScore: 100,
            });
          }
        }
      }

      // 4. If materialId is specified, release to class
      if (body.materialId && targetClassId) {
        const [mat] = await tx
          .select()
          .from(schema.materials)
          .where(eq(schema.materials.id, body.materialId));

        if (!mat) throw new NotFoundError('Material not found');
        if (mat.status !== MaterialStatus.APPROVED) {
          throw new BadRequestError('Cannot assign a material that is not approved');
        }

        await tx
          .insert(schema.classMaterials)
          .values({
            materialId: body.materialId,
            classId: targetClassId,
            releasedBy: user.id,
          })
          .onConflictDoNothing();
        releasedMaterialId = body.materialId;

        await tx
          .update(schema.classes)
          .set({ nextActivity: body.instructions || `Practice: ${mat.title}` })
          .where(eq(schema.classes.id, targetClassId));
      }

      // 5. Reuse an explicit ACCEPT decision when the teacher already reviewed
      // the recommendation. Assigning curriculum must not duplicate or rewrite
      // that separate decision record.
      let [decisionRow] = rec.decisionStatus === TeacherDecisionStatus.ACCEPT
        ? await tx
            .select()
            .from(schema.teacherDecisions)
            .where(eq(schema.teacherDecisions.recommendationId, id))
            .orderBy(desc(schema.teacherDecisions.decidedAt))
            .limit(1)
        : [];

      if (!decisionRow) {
        await tx
          .update(schema.recommendations)
          .set({
            decisionStatus: TeacherDecisionStatus.ACCEPT,
            recommendedActionText: body.instructions || rec.recommendedActionText,
          })
          .where(eq(schema.recommendations.id, id));

        [decisionRow] = await tx
          .insert(schema.teacherDecisions)
          .values({
            id: randomUUID(),
            recommendationId: id,
            decision: TeacherDecisionStatus.ACCEPT,
            teacherNotes: body.instructions || 'Assigned next activity',
            selectedMaterialId: body.materialId || null,
            decidedAt: now,
            teacherId: user.id,
          })
          .returning();
      }

      // 6. Record audit event
      await tx.insert(schema.auditEvents).values({
        actorId: user.id,
        actorRole: user.role,
        action: 'NEXT_ACTIVITY_ASSIGNED',
        entityType: 'RECOMMENDATION',
        entityId: id,
        metadata: {
          assignmentId: createdAssignmentId,
          materialId: body.materialId || null,
          assessmentId: body.assessmentId || null,
          classId: targetClassId || null,
          requestedClassId: body.classId || null,
          learnerId: rec.learnerId,
          instructions: body.instructions || null,
          dueAt: body.dueAt ? new Date(body.dueAt).toISOString() : null,
          activityTitle: body.activityTitle || null,
          notes: body.notes || null,
        },
      });

      return {
        success: true,
        recommendationId: id,
        decisionId: decisionRow.id,
        assignmentId: createdAssignmentId,
        materialId: releasedMaterialId,
      };
    });

    return reply.status(200).send(result);
  });
};
