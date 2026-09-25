import { FastifyPluginAsync } from 'fastify';
import { db } from '../../infrastructure/persistence/db.js';
import * as schema from '../../infrastructure/persistence/schema.js';
import { inArray, eq, desc, asc, and, or, ilike, gte, lte, sql } from 'drizzle-orm';
import { authenticate, requireRole } from '../../infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';
import { z } from 'zod';

const AuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  actorRole: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  all: z.coerce.boolean().optional(),
  paginate: z.coerce.boolean().optional(),
});

export const auditPlugin: FastifyPluginAsync = async (fastify) => {
  // Audit events trail (Admin sees all, Teacher sees only their own)
  fastify.get(
    '/events',
    { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] },
    async (request) => {
      const user = request.user!;
      const parsedQuery = AuditQuerySchema.parse(request.query);
      const rawQuery = (request.query as any) || {};

      const conditions: any[] = [];
      if (user.role === UserRole.TEACHER) {
        conditions.push(eq(schema.auditEvents.actorId, user.id));
      } else if (parsedQuery.actorId) {
        conditions.push(eq(schema.auditEvents.actorId, parsedQuery.actorId));
      }

      if (parsedQuery.actorRole) {
        conditions.push(eq(schema.auditEvents.actorRole, parsedQuery.actorRole));
      }
      if (parsedQuery.action && parsedQuery.action.trim()) {
        conditions.push(eq(schema.auditEvents.action, parsedQuery.action.trim()));
      }
      if (parsedQuery.entityType && parsedQuery.entityType.trim()) {
        conditions.push(eq(schema.auditEvents.entityType, parsedQuery.entityType.trim()));
      }
      if (parsedQuery.entityId && parsedQuery.entityId.trim()) {
        conditions.push(eq(schema.auditEvents.entityId, parsedQuery.entityId.trim()));
      }
      if (parsedQuery.startDate && parsedQuery.startDate.trim()) {
        const start = new Date(parsedQuery.startDate.trim());
        if (!isNaN(start.getTime())) {
          conditions.push(gte(schema.auditEvents.timestamp, start));
        }
      }
      if (parsedQuery.endDate && parsedQuery.endDate.trim()) {
        const end = new Date(parsedQuery.endDate.trim());
        if (!isNaN(end.getTime())) {
          // If date-only string like YYYY-MM-DD, include the entire day
          if (parsedQuery.endDate.trim().length === 10) {
            end.setHours(23, 59, 59, 999);
          }
          conditions.push(lte(schema.auditEvents.timestamp, end));
        }
      }
      if (parsedQuery.search && parsedQuery.search.trim()) {
        const term = `%${parsedQuery.search.trim()}%`;
        conditions.push(
          or(
            ilike(schema.auditEvents.action, term),
            ilike(schema.auditEvents.entityType, term),
            ilike(schema.auditEvents.entityId, term)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const isPaginatedRequest =
        rawQuery.page !== undefined ||
        rawQuery.limit !== undefined ||
        rawQuery.action !== undefined ||
        rawQuery.entityType !== undefined ||
        rawQuery.startDate !== undefined ||
        rawQuery.endDate !== undefined ||
        rawQuery.search !== undefined ||
        rawQuery.actorRole !== undefined ||
        rawQuery.paginate === 'true';

      if (isPaginatedRequest && !parsedQuery.all) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.auditEvents)
          .where(whereClause);
        const total = countResult?.count ?? 0;

        const rows = await db
          .select()
          .from(schema.auditEvents)
          .where(whereClause)
          .orderBy(desc(schema.auditEvents.timestamp), desc(schema.auditEvents.id))
          .limit(parsedQuery.limit)
          .offset((parsedQuery.page - 1) * parsedQuery.limit);

        const items = rows.map((r) => ({
          id: r.id,
          actorId: r.actorId || undefined,
          actorRole: r.actorRole || undefined,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId || undefined,
          metadata: (r.metadata as Record<string, any>) || undefined,
          timestamp: r.timestamp.toISOString(),
        }));

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
        .from(schema.auditEvents)
        .where(whereClause)
        .orderBy(desc(schema.auditEvents.timestamp), desc(schema.auditEvents.id));

      const formatted = rows.map((r) => ({
        id: r.id,
        actorId: r.actorId || undefined,
        actorRole: r.actorRole || undefined,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId || undefined,
        metadata: (r.metadata as Record<string, any>) || undefined,
        timestamp: r.timestamp.toISOString(),
      }));

      if (rawQuery.paginate === 'true' || isPaginatedRequest) {
        return {
          items: formatted,
          total: formatted.length,
          page: 1,
          limit: formatted.length,
          totalPages: 1,
        };
      }

      return formatted;
    }
  );

  // Pilot Metrics computed authoritative from PostgreSQL
  fastify.get(
    '/metrics',
    { preHandler: [authenticate, requireRole([UserRole.TEACHER, UserRole.ADMIN])] },
    async () => {
      const [
        materials,
        provenanceRows,
        submissionsCount,
        evidenceCount,
        recommendationsCount,
        acceptedDecisionsCount,
        prepEvents,
        pendingRecommendationsCount,
      ] = await Promise.all([
        db.select({
          id: schema.materials.id,
          usageCount: schema.materials.usageCount,
        }).from(schema.materials),
        db.select({ count: sql<number>`count(*)::int` }).from(schema.materialProvenance),
        db.select({ count: sql<number>`count(*)::int` }).from(schema.submissions),
        db.select({ count: sql<number>`count(*)::int` }).from(schema.learningEvidence),
        db.select({ count: sql<number>`count(*)::int` }).from(schema.recommendations),
        // Distinct recommendations, not decision rows. A teacher who records
        // ACCEPT twice on one recommendation leaves two rows, and counting those
        // against the number of recommendations pushed the rate past 100%.
        db.select({ count: sql<number>`count(DISTINCT ${schema.teacherDecisions.recommendationId})::int` })
          .from(schema.teacherDecisions)
          .where(eq(schema.teacherDecisions.decision, 'ACCEPT')),
        db.select({ metadata: schema.auditEvents.metadata })
          .from(schema.auditEvents)
          .where(
            inArray(schema.auditEvents.action, [
              'MATERIAL_CREATED',
              'MATERIAL_ADAPTED',
              'ASSESSMENT_CREATED',
            ])
          ),
        // What is genuinely still waiting on a teacher. The dashboard used to
        // derive this as total minus accepted, which quietly counted REJECT,
        // MODIFY and stale recommendations as outstanding work.
        db.select({ count: sql<number>`count(*)::int` })
          .from(schema.recommendations)
          .where(
            and(
              eq(schema.recommendations.decisionStatus, 'PENDING'),
              eq(schema.recommendations.isStale, false)
            )
          ),
      ]);

      const totalMaterials = materials.length;
      const materialsDirectReuseCount = materials.reduce((sum, m) => sum + (m.usageCount || 0), 0);
      const materialsAdaptedCount = provenanceRows[0]?.count || 0;
      const materialsNewCreatedCount = Math.max(0, totalMaterials - materialsAdaptedCount);

      const totalOpportunities = materialsDirectReuseCount + totalMaterials;
      const reuseRate =
        totalOpportunities > 0
          ? Math.round((materialsDirectReuseCount / totalOpportunities) * 100) / 100
          : 0;

      const totalSubmissions = submissionsCount[0]?.count || 0;
      const totalEvidenceRecorded = evidenceCount[0]?.count || 0;

      const recommendationsTotal = recommendationsCount[0]?.count || 0;
      const recommendationsAcceptedCount = acceptedDecisionsCount[0]?.count || 0;
      const recommendationsAcceptedRate =
        recommendationsTotal > 0
          ? Math.round((recommendationsAcceptedCount / recommendationsTotal) * 100) / 100
          : 0;

      let totalPrepMinutes = 0;
      let prepCount = 0;
      for (const ev of prepEvents) {
        const meta = ev.metadata as Record<string, any> | null;
        if (meta && typeof meta.prepDurationMinutes === 'number' && meta.prepDurationMinutes > 0) {
          totalPrepMinutes += meta.prepDurationMinutes;
          prepCount++;
        }
      }

      const avgPrep = prepCount > 0 ? Math.round((totalPrepMinutes / prepCount) * 10) / 10 : null;

      return {
        totalMaterials,
        materialsDirectReuseCount,
        materialsAdaptedCount,
        materialsNewCreatedCount,
        reuseRate,
        totalSubmissions,
        totalEvidenceRecorded,
        recommendationsTotal,
        recommendationsAcceptedCount,
        recommendationsAcceptedRate,
        recommendationsPendingCount: pendingRecommendationsCount[0]?.count || 0,
        averageTeacherPrepMinutes: avgPrep,
        prepDurationSampleCount: prepCount,
      };
    }
  );
};
