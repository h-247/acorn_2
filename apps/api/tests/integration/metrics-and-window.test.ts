import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { computeSkillState } from '../../src/modules/learner-state/learner-state.service.js';
import { config } from '../../src/shared/config.js';
import { UserRole } from '@acorn/contracts';

/**
 * G17 and G19.
 *
 * The evidence window was configurable in name only - RECENT_EVIDENCE_COUNT was
 * read into config and then no call site passed it on. And three business
 * metrics reported figures that were wrong rather than merely incomplete: reuse
 * never counted, an acceptance rate that could exceed 100%, and an average prep
 * time with nowhere to get a sample from.
 */
describe('Evidence window and business metrics', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    adminToken = generateToken({
      id: SEED_IDS.adminUser,
      email: 'admin@acorn.edu',
      name: 'Admin',
      role: UserRole.ADMIN,
    });
  });

  describe('G17 — the recent-N window honours its configuration', () => {
    it('takes its default from config rather than a literal', () => {
      const evidence = Array.from({ length: 30 }, (_, i) => ({
        normalizedScore: i < 20 ? 1 : 0,
        weight: 1,
        observedAt: new Date(2026, 0, 30 - i).toISOString(),
      }));

      // Newest 20 all score 1, everything older scores 0. A window of 20 sees
      // only the ones, a window of 30 averages them down - so the number itself
      // proves which window was used.
      expect(computeSkillState(evidence).score).toBe(
        computeSkillState(evidence, config.recentEvidenceCount).score
      );
      expect(computeSkillState(evidence, 20).score).toBe(1);
      expect(computeSkillState(evidence, 30).score).toBeCloseTo(20 / 30, 2);
    });
  });

  describe('G19 — metrics report what actually happened', () => {
    it('counts a release as reuse, and counts it once', async () => {
      const [material] = await db
        .select()
        .from(schema.materials)
        .where(eq(schema.materials.status, 'APPROVED'))
        .limit(1);
      expect(material).toBeDefined();

      const before = material.usageCount;

      const release = () =>
        app.inject({
          method: 'POST',
          url: `/api/materials/${material.id}/release`,
          headers: { authorization: `Bearer ${teacherToken}` },
          payload: { classId: SEED_IDS.classIeltsA },
        });

      const first = await release();
      expect(first.statusCode).toBe(201);
      const firstBody = JSON.parse(first.body);

      const [afterFirst] = await db
        .select()
        .from(schema.materials)
        .where(eq(schema.materials.id, material.id));

      if (firstBody.countedAsReuse) {
        expect(afterFirst.usageCount).toBe(before + 1);
      } else {
        // Already released to this class by the seed; nothing to count.
        expect(afterFirst.usageCount).toBe(before);
      }

      // Releasing again to the same class is not a second reuse.
      const second = await release();
      expect(second.statusCode).toBe(201);
      expect(JSON.parse(second.body).countedAsReuse).toBe(false);

      const [afterSecond] = await db
        .select()
        .from(schema.materials)
        .where(eq(schema.materials.id, material.id));
      expect(afterSecond.usageCount).toBe(afterFirst.usageCount);
    });

    it('keeps the acceptance rate within 0..1 when one recommendation is accepted twice', async () => {
      const [decision] = await db.select().from(schema.teacherDecisions).limit(1);
      expect(decision).toBeDefined();

      // A duplicate decision row on the same recommendation, which is what used
      // to push the rate above 100%.
      await db.insert(schema.teacherDecisions).values({
        recommendationId: decision.recommendationId,
        decision: 'ACCEPT',
        teacherId: SEED_IDS.teacherTaylor,
        teacherNotes: 'Recorded twice on purpose.',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/metrics',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(res.statusCode).toBe(200);
      const metrics = JSON.parse(res.body);

      expect(metrics.recommendationsAcceptedCount).toBeLessThanOrEqual(metrics.recommendationsTotal);
      expect(metrics.recommendationsAcceptedRate).toBeGreaterThanOrEqual(0);
      expect(metrics.recommendationsAcceptedRate).toBeLessThanOrEqual(1);
    });

    it('reports a pending count instead of leaving the dashboard to infer one', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/metrics',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      const metrics = JSON.parse(res.body);

      const pendingRows = await db
        .select()
        .from(schema.recommendations)
        .where(eq(schema.recommendations.decisionStatus, 'PENDING'));
      const livePending = pendingRows.filter((r) => !r.isStale).length;

      expect(metrics.recommendationsPendingCount).toBe(livePending);
    });

    it('records a self-reported prep duration so average prep time has a sample', async () => {
      const [skill] = await db.select().from(schema.skills).limit(1);

      const res = await app.inject({
        method: 'POST',
        url: '/api/materials',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          title: 'Prep duration probe',
          type: 'ARTICLE',
          primarySkillId: skill.id,
          level: 'B1',
          content: 'A short passage used to check that prep time is recorded.',
          source: 'Teacher Library',
          prepDurationMinutes: 42,
        },
      });
      expect(res.statusCode).toBe(201);

      const metricsRes = await app.inject({
        method: 'GET',
        url: '/api/audit/metrics',
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      const metrics = JSON.parse(metricsRes.body);

      // Before this, nothing anywhere wrote the key the metric reads, so the
      // average was permanently null however much work teachers did.
      expect(metrics.prepDurationSampleCount).toBeGreaterThan(0);
      expect(metrics.averageTeacherPrepMinutes).not.toBeNull();
    });
  });
});
