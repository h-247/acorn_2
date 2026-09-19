import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../../infrastructure/persistence/db.js';
import { aiAdapter } from '../../infrastructure/ai/ai-adapter.js';
import { authenticate } from '../../infrastructure/auth/auth.js';
import {
  AIGenerateRequestSchema,
  AIReviewDecisionRequestSchema,
  AIGenerationStatus,
  MaterialStatus,
} from '@acorn/contracts';

export const aiPlugin: FastifyPluginAsync = async (fastify) => {
  // Generate candidate content via AI adapter
  fastify.post('/generate', { preHandler: [authenticate] }, async (request, reply) => {
    const body = AIGenerateRequestSchema.parse(request.body);
    const store = db.getStore();

    let sourceMat = null;
    if (body.sourceMaterialId) {
      sourceMat = store.materials.find((m) => m.id === body.sourceMaterialId);
    }

    const candidate = await aiAdapter.generateCandidate(body, sourceMat);
    store.aiGenerations.push(candidate);

    store.auditEvents.push({
      id: randomUUID(),
      actorId: request.user?.id,
      actorRole: request.user?.role,
      action: 'AI_CANDIDATE_GENERATED',
      entityType: 'AI_GENERATION',
      entityId: candidate.id,
      metadata: { taskType: candidate.taskType, model: candidate.model },
      timestamp: candidate.createdAt,
    });

    return reply.status(201).send(candidate);
  });

  // List AI candidates
  fastify.get('/candidates', { preHandler: [authenticate] }, async (request) => {
    const store = db.getStore();
    return store.aiGenerations.map((c) => {
      const sourceMat = store.materials.find((m) => m.id === c.sourceMaterialId);
      const skill = store.skills.find((s) => s.id === c.targetSkillId);
      return {
        ...c,
        sourceMaterialTitle: sourceMat?.title,
        targetSkillName: skill?.name || 'Skill',
        validation: c.validation || {
          isSchemaValid: true,
          skillMappingPresent: true,
          answerKeyProvided: true,
          requiresTeacherApproval: true,
        },
      };
    });
  });

  // Get AI candidate by ID
  fastify.get('/candidates/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const candidate = store.aiGenerations.find((c) => c.id === id);
    if (!candidate) return reply.status(404).send({ message: 'Candidate not found' });

    const sourceMat = store.materials.find((m) => m.id === candidate.sourceMaterialId);
    const skill = store.skills.find((s) => s.id === candidate.targetSkillId);

    return {
      ...candidate,
      sourceMaterialTitle: sourceMat?.title,
      targetSkillName: skill?.name || 'Reading • Inference',
      validation: candidate.validation || {
        isSchemaValid: true,
        skillMappingPresent: true,
        answerKeyProvided: true,
        requiresTeacherApproval: true,
      },
    };
  });

  // Teacher Review & Approval (Approve / Revise / Reject)
  fastify.post('/candidates/:id/review', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = AIReviewDecisionRequestSchema.parse({
      ...((request.body as any) || {}),
      generationId: id,
    });
    const store = db.getStore();
    const candidate = store.aiGenerations.find((c) => c.id === id);
    if (!candidate) return reply.status(404).send({ message: 'Candidate not found' });

    const now = new Date().toISOString();
    candidate.teacherNotes = body.teacherNotes;

    if (body.decision === 'APPROVE') {
      candidate.status = AIGenerationStatus.APPROVED;

      // On approval, convert into official approved material asset
      const newMaterialId = randomUUID();
      const approvedMaterial = {
        id: newMaterialId,
        title: `AI Adapted: ${candidate.targetSkillName} (${candidate.targetLevel})`,
        type: 'ARTICLE',
        primarySkillId: candidate.targetSkillId,
        level: candidate.targetLevel,
        estimatedMinutes: 10,
        source: `AI Generated (${candidate.provider})`,
        status: MaterialStatus.APPROVED,
        currentVersionNumber: 1,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      store.materials.push(approvedMaterial);

      store.materialVersions.push({
        id: randomUUID(),
        materialId: newMaterialId,
        versionNumber: 1,
        content: body.editedContent || candidate.candidateContent,
        summary: candidate.promptSummary,
        changelog: 'Approved from AI generation',
        createdBy: request.user?.id || store.users[0].id,
        createdAt: now,
      });

      store.materialProvenance.push({
        id: randomUUID(),
        materialId: newMaterialId,
        sourceMaterialId: candidate.sourceMaterialId,
        adaptationType: 'AI_ASSISTED_GENERATION',
        aiGenerationId: candidate.id,
        notes: body.teacherNotes,
      });
    } else if (body.decision === 'REJECT') {
      candidate.status = AIGenerationStatus.REJECTED;
    }

    store.auditEvents.push({
      id: randomUUID(),
      actorId: request.user?.id,
      actorRole: request.user?.role,
      action: `AI_CANDIDATE_${body.decision}`,
      entityType: 'AI_GENERATION',
      entityId: id,
      metadata: { decision: body.decision },
      timestamp: now,
    });

    return candidate;
  });
};
