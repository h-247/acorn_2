import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';
import {
  TeacherDecisionRequestSchema,
  TeacherDecisionStatus,
  RecommendationAction,
  ConfidenceLevel,
  CEFRLevel,
} from '@acorn/contracts';

export const recommendationPlugin: FastifyPluginAsync = async (fastify) => {
  // Get recommendation for a learner
  fastify.get('/learner/:learnerId', { preHandler: [authenticate] }, async (request, reply) => {
    const { learnerId } = request.params as { learnerId: string };
    const store = db.getStore();
    const learner = store.users.find((u) => u.id === learnerId);
    if (!learner) return reply.status(404).send({ message: 'Learner not found' });

    let rec = store.recommendations.find((r) => r.learnerId === learnerId);

    if (!rec) {
      const recId = randomUUID();
      const targetSkill = store.skills.find((s) => s.name.includes('Inference')) || store.skills[0];

      rec = {
        id: recId,
        learnerId,
        targetSkillId: targetSkill.id,
        targetLevel: CEFRLevel.B1,
        priority: 'HIGH',
        recommendedActionText: `Focus on ${targetSkill.name}`,
        rationale: [
          `Inference accuracy is lower than other subskills.`,
          `Aligned with IELTS preparation goals.`,
          `Based on recent evidence items.`,
        ],
        evidenceBasisCount: 9,
        learnerCurrentScore: 0.54,
        learnerConfidence: ConfidenceLevel.MEDIUM,
        decisionStatus: TeacherDecisionStatus.PENDING,
        createdAt: new Date().toISOString(),
      };
      store.recommendations.push(rec);

      // Seed candidate materials (Reuse -> Adapt -> Generate)
      store.recommendationCandidates.push(
        {
          id: randomUUID(),
          recommendationId: recId,
          materialId: store.materials[0].id,
          action: RecommendationAction.REUSE,
          matchReason: 'Direct skill match from teacher library.',
        },
        {
          id: randomUUID(),
          recommendationId: recId,
          materialId: store.materials[6]?.id || store.materials[0].id,
          action: RecommendationAction.ADAPT,
          matchReason: 'Adaptable passage for targeted B1 inference practice.',
        },
        {
          id: randomUUID(),
          recommendationId: recId,
          materialId: store.materials[7]?.id || store.materials[0].id,
          action: RecommendationAction.GENERATE,
          matchReason: 'Generate customized micro-set for travel reviews topic.',
        }
      );
    }

    const candidateRows = store.recommendationCandidates.filter((rc) => rc.recommendationId === rec?.id);
    const candidates = candidateRows.map((rc) => {
      const mat = store.materials.find((m) => m.id === rc.materialId);
      return {
        materialId: rc.materialId,
        title: mat?.title || 'Practice Material',
        type: mat?.type || 'ARTICLE',
        level: mat?.level || 'B1',
        estimatedMinutes: mat?.estimatedMinutes || 10,
        action: rc.action,
        matchReason: rc.matchReason,
        tags: ['ielts', 'reading'],
        previouslyUsedCount: mat?.usageCount || 0,
      };
    });

    const targetSkill = store.skills.find((s) => s.id === rec?.targetSkillId);
    const decision = store.teacherDecisions.find((td) => td.recommendationId === rec?.id);

    return {
      ...rec,
      learnerName: learner.name,
      targetSkillName: targetSkill?.name || 'Inference',
      candidates,
      teacherDecision: decision
        ? {
            id: decision.id,
            decision: decision.decision,
            teacherNotes: decision.teacherNotes,
            selectedMaterialId: decision.selectedMaterialId,
            decidedAt: decision.decidedAt,
          }
        : null,
    };
  });

  // Record teacher decision (ACCEPT, MODIFY, REJECT)
  fastify.post('/:id/decision', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = TeacherDecisionRequestSchema.parse({
      ...((request.body as any) || {}),
      recommendationId: id,
    });
    const store = db.getStore();
    const rec = store.recommendations.find((r) => r.id === id);
    if (!rec) return reply.status(404).send({ message: 'Recommendation not found' });

    const now = new Date().toISOString();
    rec.decisionStatus = body.decision;

    const teacherDecision = {
      id: randomUUID(),
      recommendationId: id,
      decision: body.decision,
      teacherNotes: body.teacherNotes,
      selectedMaterialId: body.selectedMaterialId || null,
      decidedAt: now,
      teacherId: request.user?.id || store.users[0].id,
    };
    store.teacherDecisions.push(teacherDecision);

    store.auditEvents.push({
      id: randomUUID(),
      actorId: request.user?.id,
      actorRole: request.user?.role,
      action: 'TEACHER_DECISION_RECORDED',
      entityType: 'RECOMMENDATION',
      entityId: id,
      metadata: {
        decision: body.decision,
        selectedMaterialId: body.selectedMaterialId,
      },
      timestamp: now,
    });

    return teacherDecision;
  });
};
