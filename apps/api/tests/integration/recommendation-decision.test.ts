import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

/**
 * What the recommendation workspace puts in front of a teacher.
 *
 * It used to show whichever recommendation was newest, decided or not, so a
 * card that had already been accepted sat on top of one still waiting - and its
 * three decision buttons kept working, letting the same recommendation collect
 * decision after decision.
 */
describe('Recommendation decisions are made once, on the one that is waiting', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });
  });

  const openWorkspace = () =>
    app.inject({
      method: 'GET',
      url: `/api/recommendations/learner/${SEED_IDS.studentEmma}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });

  const decide = (id: string, decision: string) =>
    app.inject({
      method: 'POST',
      url: `/api/recommendations/${id}/decision`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { learnerId: SEED_IDS.studentEmma, decision, teacherNotes: 'test' },
    });

  it('shows the recommendation awaiting a decision, not merely the newest one', async () => {
    const res = await openWorkspace();
    expect(res.statusCode).toBe(200);
    const shown = res.json();

    expect(shown.decisionStatus).toBe('PENDING');

    // The seed also holds a newer, already-accepted recommendation for the same
    // learner. Ordering by date alone put that one on screen instead.
    const rows = await db
      .select()
      .from(schema.recommendations)
      .where(eq(schema.recommendations.learnerId, SEED_IDS.studentEmma));
    const newest = [...rows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0];
    expect(newest.decisionStatus).toBe('ACCEPT');
    expect(shown.id).not.toBe(newest.id);
  });

  it('refuses a second decision on the same recommendation', async () => {
    const pending = (await openWorkspace()).json();

    expect((await decide(pending.id, 'REJECT')).statusCode).toBe(200);

    const again = await decide(pending.id, 'ACCEPT');
    expect(again.statusCode).toBe(400);

    const decisions = await db
      .select()
      .from(schema.teacherDecisions)
      .where(eq(schema.teacherDecisions.recommendationId, pending.id));
    expect(decisions).toHaveLength(1);
  });

  it('moves on after a rejection instead of offering the same card again', async () => {
    const before = (await openWorkspace()).json();
    expect(before.decisionStatus).not.toBe('REJECT');

    // Every rejected recommendation stays rejected, so reopening the workspace
    // has to produce something else - a remaining pending one, or a freshly
    // generated suggestion.
    const rejected = await db
      .select()
      .from(schema.recommendations)
      .where(eq(schema.recommendations.decisionStatus, 'REJECT'));

    for (const r of rejected) {
      expect(before.id).not.toBe(r.id);
    }
  });
});
