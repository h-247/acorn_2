import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../../infrastructure/persistence/db.js';
import { authenticate } from '../../infrastructure/auth/auth.js';
import {
  CreateMaterialRequestSchema,
  AdaptMaterialRequestSchema,
  MaterialStatus,
} from '@acorn/contracts';

export const materialPlugin: FastifyPluginAsync = async (fastify) => {
  // List materials
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const { query, skill, level, type, status } = request.query as {
      query?: string;
      skill?: string;
      level?: string;
      type?: string;
      status?: string;
    };
    const store = db.getStore();

    let result = store.materials;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q));
    }
    if (skill) {
      result = result.filter((m) => m.primarySkillId === skill);
    }
    if (level) {
      result = result.filter((m) => m.level === level);
    }
    if (type) {
      result = result.filter((m) => m.type === type);
    }
    if (status) {
      result = result.filter((m) => m.status === status);
    }

    return result.map((m) => {
      const skillObj = store.skills.find((s) => s.id === m.primarySkillId);
      const v = store.materialVersions.find(
        (ver) => ver.materialId === m.id && ver.versionNumber === m.currentVersionNumber
      );
      const prov = store.materialProvenance.find((p) => p.materialId === m.id);

      return {
        ...m,
        primarySkillName: skillObj?.name || 'English',
        content: v?.content || '',
        summary: v?.summary,
        tags: ['ielts', 'reading', 'practice'],
        sharedWithClassesCount: 3,
        provenance: prov
          ? {
              sourceMaterialId: prov.sourceMaterialId,
              adaptationType: prov.adaptationType,
              notes: prov.notes,
            }
          : undefined,
      };
    });
  });

  // Get material by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = db.getStore();
    const m = store.materials.find((item) => item.id === id);
    if (!m) return reply.status(404).send({ message: 'Material not found' });

    const skillObj = store.skills.find((s) => s.id === m.primarySkillId);
    const versions = store.materialVersions.filter((ver) => ver.materialId === m.id);
    const currentVer = versions.find((v) => v.versionNumber === m.currentVersionNumber) || versions[0];
    const prov = store.materialProvenance.find((p) => p.materialId === m.id);

    return {
      ...m,
      primarySkillName: skillObj?.name || 'English',
      content: currentVer?.content || '',
      summary: currentVer?.summary,
      versions,
      provenance: prov
        ? {
            sourceMaterialId: prov.sourceMaterialId,
            sourceMaterialTitle: store.materials.find((src) => src.id === prov.sourceMaterialId)?.title,
            adaptationType: prov.adaptationType,
            notes: prov.notes,
          }
        : undefined,
      tags: ['ielts', 'reading', 'inference'],
      sharedWithClassesCount: 3,
    };
  });

  // Create new material
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    const body = CreateMaterialRequestSchema.parse(request.body);
    const store = db.getStore();
    const now = new Date().toISOString();
    const id = randomUUID();

    const newMaterial = {
      id,
      title: body.title,
      type: body.type,
      primarySkillId: body.primarySkillId,
      level: body.level,
      estimatedMinutes: body.estimatedMinutes,
      source: body.source,
      status: MaterialStatus.APPROVED,
      currentVersionNumber: 1,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.materials.push(newMaterial);

    const newVersion = {
      id: randomUUID(),
      materialId: id,
      versionNumber: 1,
      content: body.content,
      summary: body.summary,
      changelog: 'Initial version',
      createdBy: request.user?.id || store.users[0].id,
      createdAt: now,
    };
    store.materialVersions.push(newVersion);

    store.auditEvents.push({
      id: randomUUID(),
      actorId: request.user?.id,
      actorRole: request.user?.role,
      action: 'MATERIAL_CREATED',
      entityType: 'MATERIAL',
      entityId: id,
      metadata: { title: body.title },
      timestamp: now,
    });

    return reply.status(201).send(newMaterial);
  });

  // Adapt material (creates new variant linked to source)
  fastify.post('/:id/adapt', { preHandler: [authenticate] }, async (request, reply) => {
    const { id: sourceMaterialId } = request.params as { id: string };
    const body = AdaptMaterialRequestSchema.parse({
      ...((request.body as any) || {}),
      sourceMaterialId,
    });

    const store = db.getStore();
    const sourceMat = store.materials.find((m) => m.id === sourceMaterialId);
    if (!sourceMat) return reply.status(404).send({ message: 'Source material not found' });

    // Increment usage/adaptation count of source material
    sourceMat.usageCount += 1;

    const now = new Date().toISOString();
    const newId = randomUUID();

    const adaptedMaterial = {
      id: newId,
      title: body.title,
      type: sourceMat.type,
      primarySkillId: body.targetSkillId || sourceMat.primarySkillId,
      level: body.targetLevel || sourceMat.level,
      estimatedMinutes: sourceMat.estimatedMinutes,
      source: 'Adapted from ' + sourceMat.title,
      status: MaterialStatus.APPROVED,
      currentVersionNumber: 1,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    store.materials.push(adaptedMaterial);

    const newVersion = {
      id: randomUUID(),
      materialId: newId,
      versionNumber: 1,
      content: body.contentModifications,
      summary: `Adapted from ${sourceMat.title}`,
      changelog: body.adaptationReason || 'Teacher adaptation',
      createdBy: request.user?.id || store.users[0].id,
      createdAt: now,
    };
    store.materialVersions.push(newVersion);

    store.materialProvenance.push({
      id: randomUUID(),
      materialId: newId,
      sourceMaterialId: sourceMat.id,
      adaptationType: 'TEACHER_ADAPTATION',
      notes: body.adaptationReason,
    });

    store.auditEvents.push({
      id: randomUUID(),
      actorId: request.user?.id,
      actorRole: request.user?.role,
      action: 'MATERIAL_ADAPTED',
      entityType: 'MATERIAL',
      entityId: newId,
      metadata: { sourceMaterialId: sourceMat.id },
      timestamp: now,
    });

    return reply.status(201).send(adaptedMaterial);
  });
};
