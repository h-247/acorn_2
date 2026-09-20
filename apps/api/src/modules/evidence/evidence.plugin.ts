import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { authenticate, requireRole, assertLearnerAccess } from '../../infrastructure/auth/auth.js';
import { EvidenceCorrectionRequestSchema, UserRole } from '@acorn/contracts';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';
import { recomputeLearnerSkillState } from '../learner-state/learner-state.service.js';

export const evidencePlugin: FastifyPluginAsync = async (fastify) => {
  // Query evidence list
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const user = request.user!;
    const { learnerId, skillId, assessmentId, limit = '20' } = request.query as {
      learnerId?: string;
      skillId?: string;
      assessmentId?: string;
      limit?: string;
    };

    let targetLearnerIds: string[] | null = null;

    if (user.role === UserRole.STUDENT) {
      if (learnerId && learnerId !== user.id) {
        throw new ForbiddenError('You cannot view evidence of other students');
      }
      targetLearnerIds = [user.id];
    } else if (user.role === UserRole.TEACHER) {
      if (learnerId) {
        await assertLearnerAccess(user, learnerId);
        targetLearnerIds = [learnerId];
      } else {
        // Find all students in this teacher's classes
        const teacherClasses = await db
          .select({ id: schema.classes.id })
          .from(schema.classes)
          .where(eq(schema.classes.teacherId, user.id));

        const classIds = teacherClasses.map((c) => c.id);
        if (classIds.length === 0) {
          return [];
        }

        const enrollments = await db
          .select({ learnerId: schema.classEnrollments.learnerId })
          .from(schema.classEnrollments)
          .where(inArray(schema.classEnrollments.classId, classIds));

        targetLearnerIds = [...new Set(enrollments.map((e) => e.learnerId))];
        if (targetLearnerIds.length === 0) {
          return [];
        }
      }
    } else {
      // Admin / Academic manager
      if (learnerId) {
        targetLearnerIds = [learnerId];
      }
    }

    const conditions: any[] = [];
    if (targetLearnerIds) {
      conditions.push(inArray(schema.learningEvidence.learnerId, targetLearnerIds));
    }
    if (skillId) {
      conditions.push(eq(schema.learningEvidence.skillId, skillId));
    }
    if (assessmentId) {
      conditions.push(eq(schema.learningEvidence.assessmentId, assessmentId));
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const rows = await db
      .select()
      .from(schema.learningEvidence)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.learningEvidence.observedAt))
      .limit(parsedLimit);

    if (rows.length === 0) return [];

    // Related entities for DTO enrichment
    const learnerIds = [...new Set(rows.map((r) => r.learnerId))];
    const skillIds = [...new Set(rows.map((r) => r.skillId))];
    const questionIds = [...new Set(rows.map((r) => r.questionId).filter(Boolean) as string[])];
    const assessmentIds = [...new Set(rows.map((r) => r.assessmentId).filter(Boolean) as string[])];
    const materialIds = [...new Set(rows.map((r) => r.sourceMaterialId).filter(Boolean) as string[])];

    const [learners, skills, questions, assessments, materials] = await Promise.all([
      db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, learnerIds)),
      db.select().from(schema.skills).where(inArray(schema.skills.id, skillIds)),
      questionIds.length > 0
        ? db.select({ id: schema.questions.id, prompt: schema.questions.prompt }).from(schema.questions).where(inArray(schema.questions.id, questionIds))
        : [],
      assessmentIds.length > 0
        ? db.select({ id: schema.assessments.id, title: schema.assessments.title }).from(schema.assessments).where(inArray(schema.assessments.id, assessmentIds))
        : [],
      materialIds.length > 0
        ? db.select({ id: schema.materials.id, title: schema.materials.title }).from(schema.materials).where(inArray(schema.materials.id, materialIds))
        : [],
    ]);

    const learnerMap = new Map(learners.map((l) => [l.id, l.name]));
    const skillMap = new Map(skills.map((s) => [s.id, s]));
    const questionMap = new Map(questions.map((q) => [q.id, q.prompt]));
    const assessmentMap = new Map(assessments.map((a) => [a.id, a.title]));
    const materialMap = new Map(materials.map((m) => [m.id, m.title]));

    return rows.map((e) => {
      const skill = skillMap.get(e.skillId);
      return {
        id: e.id,
        learnerId: e.learnerId,
        learnerName: learnerMap.get(e.learnerId) || 'Learner',
        skillId: e.skillId,
        skillName: skill?.name || 'Skill',
        skillArea: skill?.area || 'READING',
        questionId: e.questionId,
        questionPrompt: e.questionId ? questionMap.get(e.questionId) : undefined,
        assessmentId: e.assessmentId,
        assessmentTitle: e.assessmentId ? assessmentMap.get(e.assessmentId) : undefined,
        submissionId: e.submissionId,
        evidenceType: e.evidenceType,
        evaluatorType: e.evaluatorType,
        observedValue: e.observedValue,
        normalizedScore: e.normalizedScore,
        difficulty: e.difficulty,
        weight: e.weight,
        observedAt: e.observedAt.toISOString(),
        isCorrected: e.isCorrected,
        correctionNotes: e.correctionNotes,
        sourceMaterialId: e.sourceMaterialId,
        sourceMaterialTitle: e.sourceMaterialId ? materialMap.get(e.sourceMaterialId) : undefined,
      };
    });
  });

  // Get evidence by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const [e] = await db
      .select()
      .from(schema.learningEvidence)
      .where(eq(schema.learningEvidence.id, id));

    if (!e) throw new NotFoundError('Evidence not found');

    await assertLearnerAccess(user, e.learnerId);

    const [skill] = await db.select().from(schema.skills).where(eq(schema.skills.id, e.skillId));
    const [learner] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, e.learnerId));

    let questionPrompt: string | undefined;
    if (e.questionId) {
      const [q] = await db.select({ prompt: schema.questions.prompt }).from(schema.questions).where(eq(schema.questions.id, e.questionId));
      questionPrompt = q?.prompt;
    }

    let assessmentTitle: string | undefined;
    if (e.assessmentId) {
      const [a] = await db.select({ title: schema.assessments.title }).from(schema.assessments).where(eq(schema.assessments.id, e.assessmentId));
      assessmentTitle = a?.title;
    }

    let sourceMaterialTitle: string | undefined;
    if (e.sourceMaterialId) {
      const [m] = await db.select({ title: schema.materials.title }).from(schema.materials).where(eq(schema.materials.id, e.sourceMaterialId));
      sourceMaterialTitle = m?.title;
    }

    return {
      id: e.id,
      learnerId: e.learnerId,
      learnerName: learner?.name || 'Learner',
      skillId: e.skillId,
      skillName: skill?.name || 'Skill',
      skillArea: skill?.area || 'READING',
      questionId: e.questionId,
      questionPrompt,
      assessmentId: e.assessmentId,
      assessmentTitle,
      submissionId: e.submissionId,
      evidenceType: e.evidenceType,
      evaluatorType: e.evaluatorType,
      observedValue: e.observedValue,
      normalizedScore: e.normalizedScore,
      difficulty: e.difficulty,
      weight: e.weight,
      observedAt: e.observedAt.toISOString(),
      isCorrected: e.isCorrected,
      correctionNotes: e.correctionNotes,
      sourceMaterialId: e.sourceMaterialId,
      sourceMaterialTitle,
    };
  });

  // Evidence correction with audit and state recompute
  fastify.post('/:id/correct', {
    preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const [e] = await db
      .select()
      .from(schema.learningEvidence)
      .where(eq(schema.learningEvidence.id, id));

    if (!e) throw new NotFoundError('Evidence not found');

    await assertLearnerAccess(user, e.learnerId);

    const body = EvidenceCorrectionRequestSchema.parse({
      ...((request.body as any) || {}),
      evidenceId: id,
    });

    const oldScore = e.normalizedScore;

    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.learningEvidence)
        .set({
          normalizedScore: body.correctedNormalizedScore,
          isCorrected: true,
          correctionNotes: body.reason,
        })
        .where(eq(schema.learningEvidence.id, id))
        .returning();

      await tx.insert(schema.auditEvents).values({
        actorId: user.id,
        actorRole: user.role,
        action: 'EVIDENCE_CORRECTED',
        entityType: 'LEARNING_EVIDENCE',
        entityId: id,
        metadata: {
          oldScore,
          newScore: body.correctedNormalizedScore,
          reason: body.reason,
        },
      });

      // Synchronize recomputed learner skill state in DB
      await recomputeLearnerSkillState(tx, e.learnerId, e.skillId);

      return updated;
    });

    return {
      ...result,
      observedAt: result.observedAt.toISOString(),
    };
  });
};
