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

/**
 * A skill is retired, never deleted.
 *
 * `learning_evidence`, `question_skills` and `materials` all point at
 * `skills.id`, so deleting one that has been used would take a learner's
 * history with it - and DELETE below refuses for exactly that reason. ARCHIVED
 * is the way out instead: stop offering it when tagging new work, leave
 * everything already recorded against it alone.
 *
 * Archiving takes the subtree and restoring takes the ancestors, because either
 * one alone leaves a tree no screen can draw honestly: an archived parent whose
 * children are still live, or a live child hanging off a parent nobody sees.
 */
const ARCHIVE_SUBTREE = (id: string) => sql`
  WITH RECURSIVE sub AS (
    SELECT id FROM skills WHERE id = ${id}
    UNION ALL
    SELECT c.id FROM skills c JOIN sub ON c.parent_id = sub.id
  )
  UPDATE skills SET status = 'ARCHIVED'
  WHERE id IN (SELECT id FROM sub) AND status <> 'ARCHIVED'
  RETURNING id
`;

const RESTORE_WITH_ANCESTORS = (id: string) => sql`
  WITH RECURSIVE up AS (
    SELECT id, parent_id FROM skills WHERE id = ${id}
    UNION ALL
    SELECT p.id, p.parent_id FROM skills p JOIN up ON up.parent_id = p.id
  )
  UPDATE skills SET status = 'ACTIVE'
  WHERE id IN (SELECT id FROM up) AND status <> 'ACTIVE'
  RETURNING id
`;

export const taxonomyPlugin: FastifyPluginAsync = async (fastify) => {
  // Get flat list of skills (with optional filtering & pagination)
  // A centre's skill tree is its own business. These two were the only reads
  // in the service with no authentication at all.
  fastify.get('/skills', { preHandler: [authenticate] }, async (request) => {
    const parsedQuery = SkillQuerySchema.parse(request.query);
    const rawQuery = (request.query as any) || {};

    // Read the raw string rather than coercing: z.coerce.boolean() maps the
    // string "false" to true, so a coerced flag would mean the opposite of what
    // the caller wrote.
    const includeArchived = rawQuery.includeArchived === 'true';

    const conditions: any[] = [];
    if (!includeArchived) {
      conditions.push(eq(schema.skills.status, 'ACTIVE'));
    }
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
  fastify.get('/tree', { preHandler: [authenticate] }, async (request) => {
    const includeArchived = (request.query as any)?.includeArchived === 'true';
    const allSkills = includeArchived
      ? await db.select().from(schema.skills)
      : await db.select().from(schema.skills).where(eq(schema.skills.status, 'ACTIVE'));
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
        .select({ id: schema.skills.id, status: schema.skills.status })
        .from(schema.skills)
        .where(eq(schema.skills.id, body.parentId));
      if (!parent) {
        throw new BadRequestError('Parent skill does not exist');
      }
      // A child of an archived parent is invisible the moment it is created.
      if (parent.status !== 'ACTIVE') {
        throw new BadRequestError('Parent skill is archived: restore it before adding children');
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
        .select({ id: schema.skills.id, status: schema.skills.status })
        .from(schema.skills)
        .where(eq(schema.skills.id, body.parentId));
      if (!parent) {
        throw new BadRequestError('Parent skill does not exist');
      }
      if (parent.status !== 'ACTIVE') {
        throw new BadRequestError('Parent skill is archived: restore it before moving skills under it');
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

  // Admin: Retire a skill and everything under it
  fastify.post('/skills/:id/archive', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(schema.skills).where(eq(schema.skills.id, id));
    if (!existing) throw new NotFoundError('Skill not found');

    const result: any = await db.execute(ARCHIVE_SUBTREE(id));
    const archivedIds: string[] = (result.rows ?? result).map((r: any) => r.id);

    const [updated] = await db.select().from(schema.skills).where(eq(schema.skills.id, id));
    return { skill: updated, archivedCount: archivedIds.length, archivedIds };
  });

  // Admin: Bring a skill back, with any ancestor it needs to be reachable
  fastify.post('/skills/:id/restore', { preHandler: [authenticate, requireRole([UserRole.ADMIN])] }, async (request) => {
    const { id } = request.params as { id: string };

    const [existing] = await db.select().from(schema.skills).where(eq(schema.skills.id, id));
    if (!existing) throw new NotFoundError('Skill not found');

    // Children are deliberately left alone. Archiving the parent was one
    // decision about a branch; undoing it should not silently undo the separate
    // decisions made about the leaves.
    const result: any = await db.execute(RESTORE_WITH_ANCESTORS(id));
    const restoredIds: string[] = (result.rows ?? result).map((r: any) => r.id);

    const [updated] = await db.select().from(schema.skills).where(eq(schema.skills.id, id));
    return { skill: updated, restoredCount: restoredIds.length, restoredIds };
  });

  // Admin: Delete skill node
  //
  // Only ever succeeds on a skill nothing has used yet; the four checks below
  // see to that. Retiring one that is in use is what archive is for.
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
