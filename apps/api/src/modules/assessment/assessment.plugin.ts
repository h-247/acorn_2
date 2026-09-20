import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, and, or, desc, inArray, sql } from 'drizzle-orm';
import { authenticate, requireRole, assertClassAccess, assertLearnerAccess } from '../../infrastructure/auth/auth.js';
import {
  CreateQuestionRequestSchema,
  CreateAssessmentRequestSchema,
  AssignAssessmentRequestSchema,
  AssessmentStatus,
  UserRole,
} from '@acorn/contracts';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors.js';
import { z } from 'zod';

const UpdateQuestionSchema = CreateQuestionRequestSchema.partial();
const UpdateAssessmentSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  level: z.string().optional(),
  timeLimitMinutes: z.number().int().positive().optional(),
  questionIds: z.array(z.string().uuid()).optional(),
});

export const assessmentPlugin: FastifyPluginAsync = async (fastify) => {
  // 1. Question Bank: List Questions (Staff only)
  fastify.get('/questions', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { query, skillId, level, difficulty, type } = request.query as {
      query?: string;
      skillId?: string;
      level?: string;
      difficulty?: string;
      type?: string;
    };

    let allQuestions = await db
      .select()
      .from(schema.questions)
      .orderBy(desc(schema.questions.createdAt));

    if (query) {
      const q = query.toLowerCase();
      allQuestions = allQuestions.filter((item) => item.prompt.toLowerCase().includes(q));
    }
    if (level) {
      allQuestions = allQuestions.filter((item) => item.level === level);
    }
    if (difficulty) {
      allQuestions = allQuestions.filter((item) => item.difficulty === difficulty);
    }
    if (type) {
      allQuestions = allQuestions.filter((item) => item.type === type);
    }

    const allSkills = await db.select().from(schema.skills);
    const allQSkills = await db.select().from(schema.questionSkills);
    const allMaterials = await db.select().from(schema.materials);

    if (skillId) {
      const matchingQIds = new Set(
        allQSkills.filter((qs) => qs.skillId === skillId).map((qs) => qs.questionId)
      );
      allQuestions = allQuestions.filter((q) => matchingQIds.has(q.id));
    }

    return allQuestions.map((q) => {
      const qSkills = allQSkills
        .filter((qs) => qs.questionId === q.id)
        .map((qs) => {
          const s = allSkills.find((sk) => sk.id === qs.skillId);
          return {
            skillId: qs.skillId,
            skillName: s?.name || 'Skill',
            role: qs.role,
            weight: qs.weight,
          };
        });

      const sourceMat = allMaterials.find((m) => m.id === q.sourceMaterialId);

      return {
        ...q,
        createdAt: q.createdAt.toISOString(),
        skills: qSkills,
        sourceMaterialTitle: sourceMat?.title,
      };
    });
  });

  // 2. Get Question by ID (Staff only)
  fastify.get('/questions/:id', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };

    const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
    if (!q) throw new NotFoundError('Question not found');

    const allSkills = await db.select().from(schema.skills);
    const qSkills = await db
      .select()
      .from(schema.questionSkills)
      .where(eq(schema.questionSkills.questionId, q.id));

    return {
      ...q,
      createdAt: q.createdAt.toISOString(),
      skills: qSkills.map((qs) => {
        const s = allSkills.find((sk) => sk.id === qs.skillId);
        return {
          skillId: qs.skillId,
          skillName: s?.name || 'Skill',
          role: qs.role,
          weight: qs.weight,
        };
      }),
    };
  });

  // 3. Create Question
  fastify.post('/questions', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request, reply) => {
    const body = CreateQuestionRequestSchema.parse(request.body);

    const result = await db.transaction(async (tx) => {
      const [newQuestion] = await tx
        .insert(schema.questions)
        .values({
          type: body.type,
          prompt: body.prompt,
          passage: body.passage || null,
          options: body.options || null,
          correctAnswer: body.correctAnswer || null,
          rubric: body.rubric || null,
          difficulty: body.difficulty,
          level: body.level,
          sourceMaterialId: body.sourceMaterialId || null,
          usageCount: 0,
        })
        .returning();

      for (const s of body.skills) {
        await tx.insert(schema.questionSkills).values({
          questionId: newQuestion.id,
          skillId: s.skillId,
          role: s.role || 'PRIMARY',
          weight: s.weight ?? 1.0,
        });
      }

      await tx.insert(schema.auditEvents).values({
        actorId: request.user!.id,
        actorRole: request.user!.role,
        action: 'QUESTION_CREATED',
        entityType: 'QUESTION',
        entityId: newQuestion.id,
        metadata: { prompt: body.prompt, type: body.type },
      });

      return newQuestion;
    });

    return reply.status(201).send({
      ...result,
      createdAt: result.createdAt.toISOString(),
    });
  });

  // 4. Update Question
  fastify.put('/questions/:id', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateQuestionSchema.parse(request.body);

    const [existing] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
    if (!existing) throw new NotFoundError('Question not found');

    // Block destructive edits if used in published or closed assessments
    const usedInAssessments = await db
      .select({ assessmentId: schema.assessmentItems.assessmentId, status: schema.assessments.status })
      .from(schema.assessmentItems)
      .innerJoin(schema.assessments, eq(schema.assessments.id, schema.assessmentItems.assessmentId))
      .where(
        and(
          eq(schema.assessmentItems.questionId, id),
          inArray(schema.assessments.status, [AssessmentStatus.PUBLISHED, AssessmentStatus.CLOSED])
        )
      );

    if (usedInAssessments.length > 0) {
      throw new BadRequestError('Cannot modify a question that is used in published or closed assessments');
    }

    const result = await db.transaction(async (tx) => {
      const { skills, ...qData } = body;
      const [updated] = await tx
        .update(schema.questions)
        .set(qData)
        .where(eq(schema.questions.id, id))
        .returning();

      if (skills && skills.length > 0) {
        await tx.delete(schema.questionSkills).where(eq(schema.questionSkills.questionId, id));
        for (const s of skills) {
          await tx.insert(schema.questionSkills).values({
            questionId: id,
            skillId: s.skillId,
            role: s.role || 'PRIMARY',
            weight: s.weight ?? 1.0,
          });
        }
      }

      return updated;
    });

    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
    };
  });

  // 5. List Assessments
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const user = request.user!;

    let allAssessments = await db
      .select()
      .from(schema.assessments)
      .orderBy(desc(schema.assessments.createdAt));

    let assignedAssessmentIds: Set<string> | null = null;
    if (user.role === UserRole.STUDENT) {
      const studentClasses = await db
        .select({ classId: schema.classEnrollments.classId })
        .from(schema.classEnrollments)
        .where(eq(schema.classEnrollments.learnerId, user.id));
      const classIds = studentClasses.map((c) => c.classId);

      const conditions = [eq(schema.assignments.learnerId, user.id)];
      if (classIds.length > 0) {
        conditions.push(inArray(schema.assignments.classId, classIds));
      }

      const assignments = await db
        .select({ assessmentId: schema.assignments.assessmentId })
        .from(schema.assignments)
        .where(and(eq(schema.assignments.status, 'OPEN'), or(...conditions)));

      assignedAssessmentIds = new Set(assignments.map((a) => a.assessmentId));
      allAssessments = allAssessments.filter(
        (a) => a.status === AssessmentStatus.PUBLISHED && assignedAssessmentIds!.has(a.id)
      );
    }

    const allItems = await db.select().from(schema.assessmentItems);
    const allQuestions = await db.select().from(schema.questions);
    const allQSkills = await db.select().from(schema.questionSkills);
    const allSkills = await db.select().from(schema.skills);

    return allAssessments.map((a) => {
      const items = allItems
        .filter((ai) => ai.assessmentId === a.id)
        .sort((x, y) => x.sequenceOrder - y.sequenceOrder)
        .map((ai) => {
          const q = allQuestions.find((quest) => quest.id === ai.questionId);
          const qSkills = allQSkills
            .filter((qs) => qs.questionId === q?.id)
            .map((qs) => {
              const s = allSkills.find((sk) => sk.id === qs.skillId);
              return {
                skillId: qs.skillId,
                skillName: s?.name || 'Skill',
                role: qs.role,
                weight: qs.weight,
              };
            });

          const sanitizedQ = q
            ? {
                ...q,
                correctAnswer: user.role === UserRole.STUDENT ? null : q.correctAnswer,
                rubric: user.role === UserRole.STUDENT ? null : q.rubric,
                createdAt: q.createdAt.toISOString(),
                skills: qSkills,
              }
            : null;

          return {
            ...ai,
            question: sanitizedQ,
          };
        });

      return {
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        items,
        totalPoints: items.reduce((sum, it) => sum + (it.points || 1), 0),
        skillsCovered: Array.from(
          new Set(items.flatMap((it) => (it.question ? it.question.skills.map((s: any) => s.skillName) : [])))
        ),
      };
    });
  });

  // 6. Get Assessment by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const [a] = await db.select().from(schema.assessments).where(eq(schema.assessments.id, id));
    if (!a) throw new NotFoundError('Assessment not found');

    if (user.role === UserRole.STUDENT) {
      if (a.status !== AssessmentStatus.PUBLISHED) {
        throw new NotFoundError('Assessment not found or not available');
      }

      const studentClasses = await db
        .select({ classId: schema.classEnrollments.classId })
        .from(schema.classEnrollments)
        .where(eq(schema.classEnrollments.learnerId, user.id));
      const classIds = studentClasses.map((c) => c.classId);

      const conditions = [eq(schema.assignments.learnerId, user.id)];
      if (classIds.length > 0) {
        conditions.push(inArray(schema.assignments.classId, classIds));
      }

      const [assigned] = await db
        .select({ id: schema.assignments.id })
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.assessmentId, id),
            eq(schema.assignments.status, 'OPEN'),
            or(...conditions)
          )
        );

      if (!assigned) {
        throw new ForbiddenError('This assessment is not assigned to you');
      }
    }

    const items = await db
      .select()
      .from(schema.assessmentItems)
      .where(eq(schema.assessmentItems.assessmentId, a.id));

    const questionIds = items.map((i) => i.questionId);
    let questions: any[] = [];
    let qSkills: any[] = [];
    let allSkills: any[] = [];

    if (questionIds.length > 0) {
      questions = await db.select().from(schema.questions).where(inArray(schema.questions.id, questionIds));
      qSkills = await db.select().from(schema.questionSkills).where(inArray(schema.questionSkills.questionId, questionIds));
      allSkills = await db.select().from(schema.skills);
    }

    const fullItems = items
      .sort((x, y) => x.sequenceOrder - y.sequenceOrder)
      .map((ai) => {
        const q = questions.find((quest) => quest.id === ai.questionId);
        const mappedSkills = qSkills
          .filter((qs) => qs.questionId === q?.id)
          .map((qs) => {
            const s = allSkills.find((sk) => sk.id === qs.skillId);
            return {
              skillId: qs.skillId,
              skillName: s?.name || 'Skill',
              role: qs.role,
              weight: qs.weight,
            };
          });

        const sanitizedQ = q
          ? {
              ...q,
              correctAnswer: user.role === UserRole.STUDENT ? null : q.correctAnswer,
              rubric: user.role === UserRole.STUDENT ? null : q.rubric,
              createdAt: q.createdAt.toISOString(),
              skills: mappedSkills,
            }
          : null;

        return {
          ...ai,
          question: sanitizedQ,
        };
      });

    return {
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      items: fullItems,
      totalPoints: fullItems.reduce((sum, it) => sum + (it.points || 1), 0),
      skillsCovered: Array.from(
        new Set(fullItems.flatMap((it) => (it.question ? it.question.skills.map((s: any) => s.skillName) : [])))
      ),
    };
  });

  // 7. Create Assessment
  fastify.post('/', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request, reply) => {
    const body = CreateAssessmentRequestSchema.parse(request.body);
    const userId = request.user!.id;

    const result = await db.transaction(async (tx) => {
      const [newAssessment] = await tx
        .insert(schema.assessments)
        .values({
          title: body.title,
          description: body.description || null,
          instructions: body.instructions || null,
          level: body.level,
          status: AssessmentStatus.DRAFT,
          timeLimitMinutes: body.timeLimitMinutes || 20,
          createdBy: userId,
        })
        .returning();

      for (let i = 0; i < body.questionIds.length; i++) {
        await tx.insert(schema.assessmentItems).values({
          assessmentId: newAssessment.id,
          questionId: body.questionIds[i],
          sequenceOrder: i + 1,
          points: 1.0,
        });
      }

      await tx.insert(schema.auditEvents).values({
        actorId: userId,
        actorRole: request.user!.role,
        action: 'ASSESSMENT_CREATED',
        entityType: 'ASSESSMENT',
        entityId: newAssessment.id,
        metadata: { title: body.title, itemCount: body.questionIds.length },
      });

      return newAssessment;
    });

    return reply.status(201).send({
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    });
  });

  // 8. Update Assessment Draft
  fastify.put('/:id', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateAssessmentSchema.parse(request.body);

    const [existing] = await db.select().from(schema.assessments).where(eq(schema.assessments.id, id));
    if (!existing) throw new NotFoundError('Assessment not found');
    if (existing.status !== AssessmentStatus.DRAFT) {
      throw new BadRequestError('Cannot modify an assessment that is not in draft status');
    }

    const result = await db.transaction(async (tx) => {
      const { questionIds, ...updateFields } = body;
      const [updated] = await tx
        .update(schema.assessments)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(eq(schema.assessments.id, id))
        .returning();

      if (questionIds && questionIds.length > 0 && existing.status === AssessmentStatus.DRAFT) {
        await tx.delete(schema.assessmentItems).where(eq(schema.assessmentItems.assessmentId, id));
        for (let i = 0; i < questionIds.length; i++) {
          await tx.insert(schema.assessmentItems).values({
            assessmentId: id,
            questionId: questionIds[i],
            sequenceOrder: i + 1,
            points: 1.0,
          });
        }
      }

      return updated;
    });

    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  });

  // 9. Publish Assessment
  fastify.put('/:id/publish', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };

    const [updated] = await db
      .update(schema.assessments)
      .set({ status: AssessmentStatus.PUBLISHED, updatedAt: new Date() })
      .where(eq(schema.assessments.id, id))
      .returning();

    if (!updated) throw new NotFoundError('Assessment not found');

    await db.insert(schema.auditEvents).values({
      actorId: request.user!.id,
      actorRole: request.user!.role,
      action: 'ASSESSMENT_PUBLISHED',
      entityType: 'ASSESSMENT',
      entityId: id,
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });

  // 10. Close Assessment
  fastify.put('/:id/close', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };

    const [updated] = await db
      .update(schema.assessments)
      .set({ status: AssessmentStatus.CLOSED, updatedAt: new Date() })
      .where(eq(schema.assessments.id, id))
      .returning();

    if (!updated) throw new NotFoundError('Assessment not found');
    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });

  // 11. Assign Assessment (creates assignment and initial submissions for learners)
  fastify.post('/:id/assign', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = AssignAssessmentRequestSchema.parse({
      ...((request.body as any) || {}),
      assessmentId: id,
    });

    const [assessment] = await db.select().from(schema.assessments).where(eq(schema.assessments.id, id));
    if (!assessment) throw new NotFoundError('Assessment not found');
    if (assessment.status === AssessmentStatus.DRAFT) {
      throw new BadRequestError('Cannot assign a draft assessment. Please publish it first.');
    }
    if (assessment.status === AssessmentStatus.CLOSED) {
      throw new BadRequestError('Cannot assign a closed assessment.');
    }

    if (body.classId) {
      await assertClassAccess(request.user!, body.classId);
      if (body.learnerIds && body.learnerIds.length > 0) {
        const enrollments = await db
          .select({ learnerId: schema.classEnrollments.learnerId })
          .from(schema.classEnrollments)
          .where(eq(schema.classEnrollments.classId, body.classId));
        const enrolledSet = new Set(enrollments.map((e) => e.learnerId));

        for (const learnerId of body.learnerIds) {
          if (!enrolledSet.has(learnerId)) {
            throw new BadRequestError(`Learner ${learnerId} is not enrolled in class ${body.classId}`);
          }
        }
      }
    } else if (body.learnerIds && body.learnerIds.length > 0) {
      for (const learnerId of body.learnerIds) {
        await assertLearnerAccess(request.user!, learnerId);
      }
    }

    if (body.learnerIds && body.learnerIds.length > 0) {
      const targetUsers = await db
        .select({ id: schema.users.id, isActive: schema.users.isActive, role: schema.users.role })
        .from(schema.users)
        .where(inArray(schema.users.id, body.learnerIds));
      const validUserIds = new Set(
        targetUsers.filter((u) => u.isActive !== false && u.role === UserRole.STUDENT).map((u) => u.id)
      );
      for (const learnerId of body.learnerIds) {
        if (!validUserIds.has(learnerId)) {
          throw new BadRequestError(`Learner ${learnerId} is invalid, inactive, or not a student`);
        }
      }
    }

    const result = await db.transaction(async (tx) => {
      // Check duplicate assignment
      const existingAssignments = await tx
        .select()
        .from(schema.assignments)
        .where(
          and(
            eq(schema.assignments.assessmentId, id),
            body.classId ? eq(schema.assignments.classId, body.classId) : eq(schema.assignments.status, 'OPEN')
          )
        );

      let assignment = existingAssignments[0];

      if (!assignment) {
        const [newAssign] = await tx
          .insert(schema.assignments)
          .values({
            assessmentId: id,
            classId: body.classId || null,
            learnerId: body.learnerIds?.[0] || null,
            dueAt: body.dueAt ? new Date(body.dueAt) : null,
            status: 'OPEN',
          })
          .returning();
        assignment = newAssign;
      }

      // Collect target learners
      let targetLearnerIds: string[] = body.learnerIds || [];
      if (body.classId) {
        const enrollments = await tx
          .select({ learnerId: schema.classEnrollments.learnerId })
          .from(schema.classEnrollments)
          .where(eq(schema.classEnrollments.classId, body.classId));
        targetLearnerIds = Array.from(new Set([...targetLearnerIds, ...enrollments.map((e) => e.learnerId)]));
      }

      // Automatically create STARTED submissions for each learner if not already exists
      for (const learnerId of targetLearnerIds) {
        const existingSub = await tx
          .select({ id: schema.submissions.id })
          .from(schema.submissions)
          .where(
            and(
              eq(schema.submissions.assignmentId, assignment.id),
              eq(schema.submissions.learnerId, learnerId)
            )
          );

        if (existingSub.length === 0) {
          await tx.insert(schema.submissions).values({
            assignmentId: assignment.id,
            assessmentId: id,
            learnerId,
            status: 'STARTED',
            maxPossibleScore: 100,
          });
        }
      }

      await tx.insert(schema.auditEvents).values({
        actorId: request.user!.id,
        actorRole: request.user!.role,
        action: 'ASSESSMENT_ASSIGNED',
        entityType: 'ASSIGNMENT',
        entityId: assignment.id,
        metadata: { classId: body.classId, learnersCount: targetLearnerIds.length },
      });

      return assignment;
    });

    return reply.status(201).send({
      ...result,
      assignedAt: result.assignedAt.toISOString(),
      dueAt: result.dueAt ? result.dueAt.toISOString() : null,
    });
  });
};
