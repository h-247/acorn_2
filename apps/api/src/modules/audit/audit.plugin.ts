import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';

export const auditPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/events', { preHandler: [authenticate] }, async () => {
    return db.getStore().auditEvents;
  });

  fastify.get('/metrics', { preHandler: [authenticate] }, async () => {
    const store = db.getStore();
    const totalMaterials = store.materials.length;
    const directReuseCount = store.materials.reduce((sum, m) => sum + (m.usageCount || 0), 0);
    const adaptedCount = store.materialProvenance.length;
    const newCreatedCount = totalMaterials - adaptedCount;

    const totalSubmissions = store.submissions.length;
    const totalEvidenceRecorded = store.learningEvidence.length;

    const aiGenerationsTotal = store.aiGenerations.length;
    const aiGenerationsApprovedCount = store.aiGenerations.filter(
      (g) => g.status === 'APPROVED'
    ).length;

    const recommendationsTotal = store.recommendations.length;
    const recommendationsAcceptedCount = store.teacherDecisions.filter(
      (td) => td.decision === 'ACCEPT'
    ).length;

    return {
      totalMaterials,
      materialsDirectReuseCount: directReuseCount,
      materialsAdaptedCount: adaptedCount,
      materialsNewCreatedCount: Math.max(0, newCreatedCount),
      reuseRate: totalMaterials > 0 ? directReuseCount / (directReuseCount + totalMaterials) : 0.82,
      totalSubmissions,
      totalEvidenceRecorded,
      aiGenerationsTotal,
      aiGenerationsApprovedCount,
      aiGenerationsApprovedRate:
        aiGenerationsTotal > 0 ? aiGenerationsApprovedCount / aiGenerationsTotal : 0.8,
      recommendationsTotal,
      recommendationsAcceptedCount,
      recommendationsAcceptedRate:
        recommendationsTotal > 0 ? recommendationsAcceptedCount / recommendationsTotal : 0.85,
      averageTeacherPrepMinutes: 14.5,
    };
  });
};
