import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';
import { EvidenceCorrectionRequestSchema } from '@acorn/contracts';

export const evidencePlugin: FastifyPluginAsync = async (fastify) => {
  // Query evidence list
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { learnerId, skillId, limit = '20' } = request.query as {
      learnerId?: string;
      skillId?: string;
      limit?: string;
    };
    const store = db.getStore();

    let result = store.learningEvidence;
    if (learnerId) {
      result = result.filter((e) => e.learnerId === learnerId);
    }
    if (skillId) {
      result = result.filter((e) => e.skillId === skillId);
    }

    result = result
      .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
      .slice(0, parseInt(limit, 10));

    return result.map((e) => {
      const skill = store.skills.find((s) => s.id === e.skillId);
      const question = store.questions.find((q) => q.id === e.questionId);
      const assessment = store.assessments.find((a) => a.id === e.assessmentId);
      const sourceMat = store.materials.find((m) => m.id === e.sourceMaterialId);

      return {
        ...e,
        skillName: skill?.name || 'Skill',
        skillArea: skill?.area || 'READING',
        questionPrompt: question?.prompt,
        assessmentTitle: assessment?.title,
        sourceMaterialTitle: sourceMat?.title,
      };
    });
  });

  // Get evidence by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const e = store.learningEvidence.find((item) => item.id === id);
    if (!e) return reply.status(404).send({ message: 'Evidence not found' });

    const skill = store.skills.find((s) => s.id === e.skillId);
    const question = store.questions.find((q) => q.id === e.questionId);
    const assessment = store.assessments.find((a) => a.id === e.assessmentId);
    const sourceMat = store.materials.find((m) => m.id === e.sourceMaterialId);

    return {
      ...e,
      skillName: skill?.name || 'Skill',
      skillArea: skill?.area || 'READING',
      questionPrompt: question?.prompt,
      assessmentTitle: assessment?.title,
      sourceMaterialTitle: sourceMat?.title,
    };
  });

  // Evidence correction with audit and state recompute
  fastify.post('/:id/correct', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = EvidenceCorrectionRequestSchema.parse({
      ...((request.body as any) || {}),
      evidenceId: id,
    });
    const store = db.getStore();
    const e = store.learningEvidence.find((item) => item.id === id);
    if (!e) return reply.status(404).send({ message: 'Evidence not found' });

    const oldScore = e.normalizedScore;
    e.normalizedScore = body.correctedNormalizedScore;
    e.isCorrected = true;
    e.correctionNotes = body.reason;

    const now = new Date().toISOString();
    store.auditEvents.push({
      id: randomUUID(),
      actorId: request.user?.id,
      actorRole: request.user?.role,
      action: 'EVIDENCE_CORRECTED',
      entityType: 'LEARNING_EVIDENCE',
      entityId: e.id,
      metadata: {
        oldScore,
        newScore: body.correctedNormalizedScore,
        reason: body.reason,
      },
      timestamp: now,
    });

    return e;
  });
};
