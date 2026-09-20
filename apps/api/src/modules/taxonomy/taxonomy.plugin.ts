import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { eq, or, ilike, and, asc, sql } from 'drizzle-orm';
import { authenticate, requireRole } from '../../infrastructure/auth/auth.js';
import { UserRole, SkillArea, CEFRLevel } from '@acorn/contracts';
import { z } from 'zod';
import { NotFoundError, BadRequestError } from '../../shared/errors.js';

const CreateSkillSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  area: z.nativeEnum(SkillArea),
  parentId: z.string().uuid().nullable().optional(),
  level: z.nativeEnum(CEFRLevel).optional(),
  description: z.string().optional(),
});

const SkillQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  area: z.nativeEnum(SkillArea).optional(),
  level: z.nativeEnum(CEFRLevel).optional(),
  all: z.coerce.boolean().optional(),
  paginate: z.coerce.boolean().optional(),
});

export const taxonomyPlugin: FastifyPluginAsync = async (fastify) => {
  // Get flat list of skills (with optional filtering & pagination)
  fastify.get('/skills', async (request) => {
    const parsedQuery = SkillQuerySchema.parse(request.query);
    const rawQuery = (request.query as any) || {};

    const conditions: any[] = [];
    if (parsedQuery.area) {
      conditions.push(eq(schema.skills.area, parsedQuery.area));
    }
    if (parsedQuery.level) {
      conditions.push(eq(schema.skills.level, parsedQuery.level));
    }
    if (parsedQuery.search && parsedQuery.search.trim()) {
      const term = `%${parsedQuery.search.trim()}%`;
      conditions.push(or(ilike(schema.skills.name, term), ilike(schema.skills.code, term)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const isPaginatedRequest =
      rawQuery.page !== undefined ||
      rawQuery.limit !== undefined ||
      rawQuery.search !== undefined ||
      rawQuery.area !== undefined ||
      rawQuery.level !== undefined ||
      rawQuery.paginate === 'true';

    if (isPaginatedRequest && !parsedQuery.all) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.skills)
        .where(whereClause);
      const total = countResult?.count ?? 0;

      const items = await db
        .select()
        .from(schema.skills)
        .where(whereClause)
        .orderBy(asc(schema.skills.area), asc(schema.skills.code), asc(schema.skills.id))
        .limit(parsedQuery.limit)
        .offset((parsedQuery.page - 1) * parsedQuery.limit);

      return {
        items,
        total,
        page: parsedQuery.page,
        limit: parsedQuery.limit,
        totalPages: Math.ceil(total / parsedQuery.limit) || 1,
      };
    }

    const rows = await db
      .select()
      .from(schema.skills)
      .where(whereClause)
      .orderBy(asc(schema.skills.area), asc(schema.skills.code), asc(schema.skills.id));

    if (rawQuery.paginate === 'true' || isPaginatedRequest) {
      return {
        items: rows,
        total: rows.length,
        page: 1,
        limit: rows.length,
        totalPages: 1,
      };
    }

    return rows;
  });

  // Get hierarchical skills tree
  fastify.get('/tree', async () => {
    const allSkills = await db.select().from(schema.skills);
    const rootSkills = allSkills.filter((s) => !s.parentId);
    return rootSkills.map((root) => ({
      ...root,
      children: allSkills.filter((child) => child.parentId === root.id),
    }));
  });

  // Admin: Create skill node
  fastify.post('/skills', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request, reply) => {
    const body = CreateSkillSchema.parse(request.body);

    if (body.parentId) {
      const [parent] = await db
        .select({ id: schema.skills.id })
        .from(schema.skills)
        .where(eq(schema.skills.id, body.parentId));
      if (!parent) {
        throw new BadRequestError('Parent skill does not exist');
      }
    }

    const [created] = await db
      .insert(schema.skills)
      .values({
        code: body.code,
        name: body.name,
        area: body.area,
        parentId: body.parentId || null,
        level: body.level || null,
        description: body.description || null,
      })
      .returning();

    return reply.status(201).send(created);
  });

  // Admin: Update skill node
  fastify.put('/skills/:id', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = CreateSkillSchema.partial().parse(request.body);

    const [existing] = await db.select().from(schema.skills).where(eq(schema.skills.id, id));
    if (!existing) throw new NotFoundError('Skill not found');

    if (body.parentId !== undefined && body.parentId !== null) {
      if (body.parentId === id) {
        throw new BadRequestError('A skill cannot be its own parent');
      }

      const [parent] = await db
        .select({ id: schema.skills.id })
        .from(schema.skills)
        .where(eq(schema.skills.id, body.parentId));
      if (!parent) {
        throw new BadRequestError('Parent skill does not exist');
      }

      // Detect circular reference in hierarchy
      const allSkills = await db
        .select({ id: schema.skills.id, parentId: schema.skills.parentId })
        .from(schema.skills);
      const parentMap = new Map(allSkills.map((s) => [s.id, s.parentId]));

      let current: string | null | undefined = body.parentId;
      const visited = new Set<string>();
      while (current) {
        if (current === id) {
          throw new BadRequestError('Cannot set parent: circular reference detected in skill hierarchy');
        }
        if (visited.has(current)) break;
        visited.add(current);
        current = parentMap.get(current);
      }
    }

    const [updated] = await db
      .update(schema.skills)
      .set(body)
      .where(eq(schema.skills.id, id))
      .returning();

    return updated;
  });

  // Admin: Delete skill node
  fastify.delete('/skills/:id', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(schema.skills).where(eq(schema.skills.id, id));
    if (!existing) throw new NotFoundError('Skill not found');

    // 1. Block if has child skills
    const children = await db
      .select({ id: schema.skills.id })
      .from(schema.skills)
      .where(eq(schema.skills.parentId, id));
    if (children.length > 0) {
      throw new BadRequestError('Cannot delete skill that has child skills');
    }

    // 2. Block if referenced by materials
    const materials = await db
      .select({ id: schema.materials.id })
      .from(schema.materials)
      .where(eq(schema.materials.primarySkillId, id));
    if (materials.length > 0) {
      throw new BadRequestError('Cannot delete skill referenced by materials');
    }

    // 3. Block if referenced by questions
    const questions = await db
      .select({ questionId: schema.questionSkills.questionId })
      .from(schema.questionSkills)
      .where(eq(schema.questionSkills.skillId, id));
    if (questions.length > 0) {
      throw new BadRequestError('Cannot delete skill referenced by questions');
    }

    // 4. Block if referenced by learning evidence
    const evidence = await db
      .select({ id: schema.learningEvidence.id })
      .from(schema.learningEvidence)
      .where(eq(schema.learningEvidence.skillId, id));
    if (evidence.length > 0) {
      throw new BadRequestError('Cannot delete skill referenced by learning evidence');
    }

    await db.delete(schema.skills).where(eq(schema.skills.id, id));
    return { success: true };
  });
};
