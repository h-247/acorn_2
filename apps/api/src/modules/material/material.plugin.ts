import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, and, ilike, inArray, desc, sql } from 'drizzle-orm';
import { authenticate, requireRole, assertClassAccess } from '../../infrastructure/auth/auth.js';
import { storage } from '../../infrastructure/object-storage/storage.js';
import {
  CreateMaterialRequestSchema,
  AdaptMaterialRequestSchema,
  MaterialStatus,
  UserRole,
} from '@acorn/contracts';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors.js';
import { z } from 'zod';

const UpdateMaterialSchema = z.object({
  title: z.string().min(2).optional(),
  level: z.string().optional(),
  difficulty: z.string().optional(),
  topic: z.string().optional(),
  courseId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  status: z.nativeEnum(MaterialStatus).optional(),
  changelog: z.string().optional(),
});

export const materialPlugin: FastifyPluginAsync = async (fastify) => {
  // 1. List materials with filters
  fastify.get('/', { preHandler: [authenticate] }, async (request) => {
    const user = request.user!;
    const { query, skill, level, type, status } = request.query as {
      query?: string;
      skill?: string;
      level?: string;
      type?: string;
      status?: string;
    };

    let allMaterials = await db
      .select()
      .from(schema.materials)
      .orderBy(desc(schema.materials.createdAt));

    let releasedMaterialIds: Set<string> | null = null;
    if (user.role === UserRole.STUDENT) {
      const enrollments = await db
        .select({ classId: schema.classEnrollments.classId })
        .from(schema.classEnrollments)
        .where(eq(schema.classEnrollments.learnerId, user.id));
      const studentClassIds = enrollments.map((e) => e.classId);

      if (studentClassIds.length > 0) {
        const releases = await db
          .select({ materialId: schema.classMaterials.materialId })
          .from(schema.classMaterials)
          .where(inArray(schema.classMaterials.classId, studentClassIds));
        releasedMaterialIds = new Set(releases.map((r) => r.materialId));
      } else {
        releasedMaterialIds = new Set();
      }

      allMaterials = allMaterials.filter(
        (m) => m.status === MaterialStatus.APPROVED && releasedMaterialIds!.has(m.id)
      );
    }

    if (query) {
      const q = query.toLowerCase();
      allMaterials = allMaterials.filter((m) => m.title.toLowerCase().includes(q));
    }
    if (skill) {
      allMaterials = allMaterials.filter((m) => m.primarySkillId === skill);
    }
    if (level) {
      allMaterials = allMaterials.filter((m) => m.level === level);
    }
    if (type) {
      allMaterials = allMaterials.filter((m) => m.type === type);
    }
    if (status) {
      allMaterials = allMaterials.filter((m) => m.status === status);
    }

    const allSkills = await db.select().from(schema.skills);
    const allVersions = await db.select().from(schema.materialVersions);
    const allProv = await db.select().from(schema.materialProvenance);
    const allReleases = await db.select().from(schema.classMaterials);

    return allMaterials.map((m) => {
      const skillObj = allSkills.find((s) => s.id === m.primarySkillId);
      const v = allVersions.find(
        (ver) => ver.materialId === m.id && ver.versionNumber === m.currentVersionNumber
      ) || allVersions.find((ver) => ver.materialId === m.id);
      const prov = allProv.find((p) => p.materialId === m.id);
      const releases = allReleases.filter((r) => r.materialId === m.id);

      return {
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        primarySkillName: skillObj?.name || 'English',
        content: v?.content || '',
        summary: v?.summary,
        tags: (m.tags as string[]) || [],
        topic: m.topic || null,
        difficulty: m.difficulty || null,
        courseId: m.courseId || null,
        sharedWithClassesCount: releases.length,
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

  // 2. Get material by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const user = request.user!;

    const [m] = await db.select().from(schema.materials).where(eq(schema.materials.id, id));
    if (!m) throw new NotFoundError('Material not found');

    if (user.role === UserRole.STUDENT) {
      if (m.status !== MaterialStatus.APPROVED) {
        throw new NotFoundError('Material not found or not available');
      }

      const enrollments = await db
        .select({ classId: schema.classEnrollments.classId })
        .from(schema.classEnrollments)
        .where(eq(schema.classEnrollments.learnerId, user.id));
      const studentClassIds = enrollments.map((e) => e.classId);

      const [rel] = studentClassIds.length > 0
        ? await db
            .select()
            .from(schema.classMaterials)
            .where(
              and(
                eq(schema.classMaterials.materialId, m.id),
                inArray(schema.classMaterials.classId, studentClassIds)
              )
            )
        : [null];

      if (!rel) {
        throw new ForbiddenError('This material has not been released to your class');
      }
    }

    const [skillObj] = await db.select().from(schema.skills).where(eq(schema.skills.id, m.primarySkillId));
    const versions = await db
      .select()
      .from(schema.materialVersions)
      .where(eq(schema.materialVersions.materialId, m.id))
      .orderBy(desc(schema.materialVersions.versionNumber));

    const currentVer = versions.find((v) => v.versionNumber === m.currentVersionNumber) || versions[0];
    const [prov] = await db.select().from(schema.materialProvenance).where(eq(schema.materialProvenance.materialId, m.id));

    let sourceTitle: string | undefined;
    if (prov?.sourceMaterialId) {
      const [src] = await db.select({ title: schema.materials.title }).from(schema.materials).where(eq(schema.materials.id, prov.sourceMaterialId));
      sourceTitle = src?.title;
    }

    const files = await db.select().from(schema.materialFiles).where(eq(schema.materialFiles.materialId, m.id));
    const releases = await db
      .select()
      .from(schema.classMaterials)
      .where(eq(schema.classMaterials.materialId, m.id));

    return {
      ...m,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      primarySkillName: skillObj?.name || 'English',
      content: currentVer?.content || '',
      summary: currentVer?.summary,
      versions: versions.map((v) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
      })),
      provenance: prov
        ? {
            sourceMaterialId: prov.sourceMaterialId,
            sourceMaterialTitle: sourceTitle,
            adaptationType: prov.adaptationType,
            notes: prov.notes,
          }
        : undefined,
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
        uploadedAt: f.uploadedAt.toISOString(),
      })),
      tags: (m.tags as string[]) || [],
      topic: m.topic || null,
      difficulty: m.difficulty || null,
      courseId: m.courseId || null,
      sharedWithClassesCount: releases.length,
    };
  });

  // 3. Create material
  fastify.post('/', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request, reply) => {
    const body = CreateMaterialRequestSchema.parse(request.body);
    const userId = request.user!.id;

    const result = await db.transaction(async (tx) => {
      const [newMaterial] = await tx
        .insert(schema.materials)
        .values({
          title: body.title,
          type: body.type,
          primarySkillId: body.primarySkillId,
          level: body.level,
          estimatedMinutes: body.estimatedMinutes,
          difficulty: body.difficulty || undefined,
          topic: body.topic || undefined,
          courseId: body.courseId || undefined,
          tags: body.tags || [],
          source: body.source,
          status: MaterialStatus.DRAFT,
          currentVersionNumber: 1,
          usageCount: 0,
        })
        .returning();

      await tx.insert(schema.materialVersions).values({
        materialId: newMaterial.id,
        versionNumber: 1,
        content: body.content,
        summary: body.summary,
        changelog: 'Initial version',
        createdBy: userId,
      });

      await tx.insert(schema.auditEvents).values({
        actorId: userId,
        actorRole: request.user!.role,
        action: 'MATERIAL_CREATED',
        entityType: 'MATERIAL',
        entityId: newMaterial.id,
        // Recorded when the caller offers it. The average prep time metric reads
        // this key and had nowhere to read it from before.
        metadata: { title: body.title, prepDurationMinutes: body.prepDurationMinutes ?? null },
      });

      return newMaterial;
    });

    return reply.status(201).send({
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    });
  });

  // 4. Update material or create new version
  fastify.put('/:id', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateMaterialSchema.parse(request.body);
    const userId = request.user!.id;

    const [existing] = await db.select().from(schema.materials).where(eq(schema.materials.id, id));
    if (!existing) throw new NotFoundError('Material not found');

    const result = await db.transaction(async (tx) => {
      let newVersionNum = existing.currentVersionNumber;

      if (body.content) {
        newVersionNum += 1;
        await tx.insert(schema.materialVersions).values({
          materialId: id,
          versionNumber: newVersionNum,
          content: body.content,
          summary: body.summary || existing.title,
          changelog: body.changelog || `Updated to version ${newVersionNum}`,
          createdBy: userId,
        });
      }

      const [updated] = await tx
        .update(schema.materials)
        .set({
          title: body.title || existing.title,
          level: body.level || existing.level,
          estimatedMinutes: body.estimatedMinutes || existing.estimatedMinutes,
          status: body.status || existing.status,
          difficulty: body.difficulty !== undefined ? body.difficulty : existing.difficulty,
          topic: body.topic !== undefined ? body.topic : existing.topic,
          courseId: body.courseId !== undefined ? body.courseId : existing.courseId,
          tags: body.tags !== undefined ? body.tags : existing.tags,
          currentVersionNumber: newVersionNum,
          updatedAt: new Date(),
        })
        .where(eq(schema.materials.id, id))
        .returning();

      await tx.insert(schema.auditEvents).values({
        actorId: userId,
        actorRole: request.user!.role,
        action: 'MATERIAL_UPDATED',
        entityType: 'MATERIAL',
        entityId: id,
        metadata: { version: newVersionNum, status: updated.status },
      });

      return updated;
    });

    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  });

  // 5. Adapt material (creates new variant preserving provenance)
  fastify.post('/:id/adapt', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request, reply) => {
    const { id: sourceMaterialId } = request.params as { id: string };
    const body = AdaptMaterialRequestSchema.parse({
      ...((request.body as any) || {}),
      sourceMaterialId,
    });
    const userId = request.user!.id;

    const [sourceMat] = await db.select().from(schema.materials).where(eq(schema.materials.id, sourceMaterialId));
    if (!sourceMat) throw new NotFoundError('Source material not found');

    const result = await db.transaction(async (tx) => {
      // Increment source material usage count
      await tx
        .update(schema.materials)
        .set({ usageCount: sourceMat.usageCount + 1 })
        .where(eq(schema.materials.id, sourceMaterialId));

      const [adapted] = await tx
        .insert(schema.materials)
        .values({
          title: body.title,
          type: sourceMat.type,
          primarySkillId: body.targetSkillId || sourceMat.primarySkillId,
          level: body.targetLevel || sourceMat.level,
          estimatedMinutes: sourceMat.estimatedMinutes,
          difficulty: body.difficulty || sourceMat.difficulty || undefined,
          topic: body.topic || sourceMat.topic || undefined,
          courseId: body.courseId || sourceMat.courseId || undefined,
          tags: body.tags || (sourceMat.tags as string[]) || [],
          source: `Adapted from ${sourceMat.title}`,
          status: MaterialStatus.DRAFT,
          currentVersionNumber: 1,
          usageCount: 0,
        })
        .returning();

      await tx.insert(schema.materialVersions).values({
        materialId: adapted.id,
        versionNumber: 1,
        content: body.contentModifications,
        summary: `Adapted from ${sourceMat.title}`,
        changelog: body.adaptationReason || 'Teacher manual adaptation',
        createdBy: userId,
      });

      await tx.insert(schema.materialProvenance).values({
        materialId: adapted.id,
        sourceMaterialId: sourceMat.id,
        adaptationType: 'TEACHER_ADAPTATION',
        notes: body.adaptationReason,
      });

      await tx.insert(schema.auditEvents).values({
        actorId: userId,
        actorRole: request.user!.role,
        action: 'MATERIAL_ADAPTED',
        entityType: 'MATERIAL',
        entityId: adapted.id,
        metadata: {
          sourceMaterialId: sourceMat.id,
          prepDurationMinutes: (request.body as any)?.prepDurationMinutes ?? null,
        },
      });

      return adapted;
    });

    return reply.status(201).send({
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    });
  });

  // 6. Update Status (Review / Approve / Archive)
  fastify.put('/:id/status', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };
    const { status } = z.object({ status: z.nativeEnum(MaterialStatus) }).parse(request.body);

    const [current] = await db.select({ status: schema.materials.status }).from(schema.materials).where(eq(schema.materials.id, id));
    if (!current) throw new NotFoundError('Material not found');

    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['UNDER_REVIEW'],
      'UNDER_REVIEW': ['APPROVED', 'DRAFT'],
      'APPROVED': ['ARCHIVED'],
      'ARCHIVED': ['APPROVED'],
    };

    if (!validTransitions[current.status]?.includes(status)) {
      throw new BadRequestError(`Invalid state transition from ${current.status} to ${status}`);
    }

    const [updated] = await db
      .update(schema.materials)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.materials.id, id))
      .returning();

    if (!updated) throw new NotFoundError('Material not found');

    await db.insert(schema.auditEvents).values({
      actorId: request.user!.id,
      actorRole: request.user!.role,
      action: `MATERIAL_STATUS_${status}`,
      entityType: 'MATERIAL',
      entityId: id,
      metadata: { status },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });

  // 7. Upload file to material (stores in SeaweedFS S3, metadata in DB)
  fastify.post('/:id/files', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [m] = await db.select({ id: schema.materials.id }).from(schema.materials).where(eq(schema.materials.id, id));
    if (!m) throw new NotFoundError('Material not found');

    const data = await request.file();
    if (!data) throw new BadRequestError('No file uploaded');

    const validMaterialMimes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/markdown',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp',
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
    const mime = (data.mimetype || '').toLowerCase().split(';')[0].trim();
    if (!validMaterialMimes.has(mime)) {
      throw new BadRequestError(`Unsupported file type: ${data.mimetype}`);
    }

    let buf: Buffer;
    try {
      buf = await data.toBuffer();
    } catch (err: any) {
      if (err.code === 'FST_REQ_FILE_TOO_LARGE' || err.statusCode === 413) {
        throw new BadRequestError('File exceeds maximum 50MB limit');
      }
      throw err;
    }

    if ((data as any).file?.truncated || buf.length > 50 * 1024 * 1024) {
      throw new BadRequestError('File exceeds maximum 50MB limit');
    }

    const safeFileName = (data.filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileKey = `materials/${id}/${Date.now()}-${safeFileName}`;

    await storage.putObject(fileKey, buf, mime);

    try {
      const fileRow = await db.transaction(async (tx) => {
        const [insertedFile] = await tx
          .insert(schema.materialFiles)
          .values({
            materialId: id,
            fileName: safeFileName,
            fileKey,
            fileSize: buf.length,
            mimeType: mime,
            uploadedBy: request.user!.id,
          })
          .returning();

        await tx.insert(schema.auditEvents).values({
          actorId: request.user!.id,
          actorRole: request.user!.role,
          action: 'MATERIAL_FILE_UPLOADED',
          entityType: 'MATERIAL_FILE',
          entityId: insertedFile.id,
          metadata: { fileName: safeFileName, fileSize: buf.length },
        });

        return insertedFile;
      });

      return reply.status(201).send({
        id: fileRow.id,
        fileName: fileRow.fileName,
        fileSize: fileRow.fileSize,
        mimeType: fileRow.mimeType,
        uploadedAt: fileRow.uploadedAt.toISOString(),
      });
    } catch (err) {
      try {
        await storage.deleteObject(fileKey);
      } catch (cleanupErr) {
        fastify.log.error(cleanupErr, 'Failed to delete orphaned material file from storage');
      }
      throw err;
    }
  });

  // 8. Download material file (private S3 URL or stream)
  fastify.get('/:id/files/:fileId/download', { preHandler: [authenticate] }, async (request, reply) => {
    const { id, fileId } = request.params as { id: string; fileId: string };
    const user = request.user!;

    const [fileRow] = await db
      .select()
      .from(schema.materialFiles)
      .where(and(eq(schema.materialFiles.id, fileId), eq(schema.materialFiles.materialId, id)));

    if (!fileRow) throw new NotFoundError('File not found');

    if (user.role === UserRole.STUDENT) {
      const [mat] = await db.select().from(schema.materials).where(eq(schema.materials.id, id));
      if (!mat || mat.status !== MaterialStatus.APPROVED) {
        throw new ForbiddenError('You do not have permission to download this file');
      }

      const enrollments = await db
        .select({ classId: schema.classEnrollments.classId })
        .from(schema.classEnrollments)
        .where(eq(schema.classEnrollments.learnerId, user.id));
      const studentClassIds = enrollments.map((e) => e.classId);

      const [rel] = studentClassIds.length > 0
        ? await db
            .select()
            .from(schema.classMaterials)
            .where(
              and(
                eq(schema.classMaterials.materialId, id),
                inArray(schema.classMaterials.classId, studentClassIds)
              )
            )
        : [null];

      if (!rel) {
        throw new ForbiddenError('You do not have permission to download this file');
      }
    }

    const downloadUrl = await storage.getSignedUrl(fileRow.fileKey, 300);
    return { url: downloadUrl, fileName: fileRow.fileName, mimeType: fileRow.mimeType };
  });

  // 9. Release material to a class
  fastify.post('/:id/release', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { classId } = z.object({ classId: z.string().uuid() }).parse(request.body);
    const user = request.user!;

    if (user.role === UserRole.TEACHER) {
      await assertClassAccess(user, classId);
    }

    const [mat] = await db.select({ id: schema.materials.id, status: schema.materials.status }).from(schema.materials).where(eq(schema.materials.id, id));
    if (!mat) throw new NotFoundError('Material not found');

    if (mat.status !== MaterialStatus.APPROVED) {
      throw new BadRequestError('Material must be APPROVED before it can be released to a class');
    }

    // Direct reuse is exactly this: an approved material put in front of another
    // class without being rewritten. Counting it here is what stops the reuse
    // rate reading zero for a centre that reuses everything.
    //
    // `returning()` after `onConflictDoNothing()` yields nothing when the row
    // was already there, so releasing the same material to the same class twice
    // is not two reuses - the metric must not reward a double click.
    const inserted = await db
      .insert(schema.classMaterials)
      .values({
        materialId: id,
        classId,
        releasedBy: user.id,
      })
      .onConflictDoNothing()
      .returning({ id: schema.classMaterials.id });

    const isNewRelease = inserted.length > 0;

    if (isNewRelease) {
      await db
        .update(schema.materials)
        .set({ usageCount: sql`${schema.materials.usageCount} + 1`, updatedAt: new Date() })
        .where(eq(schema.materials.id, id));
    }

    await db.insert(schema.auditEvents).values({
      actorId: user.id,
      actorRole: user.role,
      action: 'MATERIAL_RELEASED_TO_CLASS',
      entityType: 'MATERIAL',
      entityId: id,
      metadata: { classId, countedAsReuse: isNewRelease },
    });

    return reply.status(201).send({ success: true, materialId: id, classId, countedAsReuse: isNewRelease });
  });

  // 10. Revoke release of material to a class
  fastify.delete('/:id/release/:classId', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id, classId } = request.params as { id: string; classId: string };
    const user = request.user!;

    if (user.role === UserRole.TEACHER) {
      await assertClassAccess(user, classId);
    }

    await db
      .delete(schema.classMaterials)
      .where(and(eq(schema.classMaterials.materialId, id), eq(schema.classMaterials.classId, classId)));

    return { success: true };
  });

  // 11. List releases for a material
  fastify.get('/:id/releases', { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };

    const releases = await db
      .select({
        id: schema.classMaterials.id,
        classId: schema.classMaterials.classId,
        releasedAt: schema.classMaterials.releasedAt,
        releasedBy: schema.classMaterials.releasedBy,
        className: schema.classes.name,
      })
      .from(schema.classMaterials)
      .innerJoin(schema.classes, eq(schema.classes.id, schema.classMaterials.classId))
      .where(eq(schema.classMaterials.materialId, id));

    return releases.map((r) => ({
      ...r,
      releasedAt: r.releasedAt.toISOString(),
    }));
  });
};
