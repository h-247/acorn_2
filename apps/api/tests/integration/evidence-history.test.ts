import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

/**
 * Two things 0004 left open.
 *
 * It retires the machine's row when a teacher marks the same question, which
 * works because the two carry different evidence types. A teacher marking the
 * same question twice hits the same type, and used to overwrite the first
 * marking in place - so nothing recorded that the score had ever been anything
 * else.
 *
 * And observed_at was stamped with the marking time rather than the moment the
 * learner handed the paper in, which matters because learner state picks the
 * most recent evidence by that column.
 */
describe('Evidence keeps its history across a regrade', () => {
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

  it('a correction writes a new row and retires the old one instead of overwriting it', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/evidence?learnerId=${SEED_IDS.studentEmma}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const evidenceList = JSON.parse(listRes.body);
    expect(evidenceList.length).toBeGreaterThan(0);

    const target = evidenceList[0];
    const originalScore = target.normalizedScore;
    const originalObservedAt = target.observedAt;
    const correctedScore = originalScore === 0.5 ? 0.9 : 0.5;

    const correctRes = await app.inject({
      method: 'POST',
      url: `/api/evidence/${target.id}/correct`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        evidenceId: target.id,
        correctedNormalizedScore: correctedScore,
        reason: 'Oral check in class showed the reasoning was sound.',
      },
    });
    expect(correctRes.statusCode).toBe(200);
    const replacement = JSON.parse(correctRes.body);

    expect(replacement.id).not.toBe(target.id);
    expect(replacement.normalizedScore).toBe(correctedScore);
    expect(replacement.isSuperseded).toBe(false);

    // The learner sat the paper when they sat it, whatever happens afterwards.
    expect(replacement.observedAt).toBe(originalObservedAt);

    const [retired] = await db
      .select()
      .from(schema.learningEvidence)
      .where(eq(schema.learningEvidence.id, target.id));

    expect(retired).toBeDefined();
    expect(retired.normalizedScore).toBe(originalScore);
    expect(retired.isSuperseded).toBe(true);
  });

  it('lists what currently counts, and the history only when asked', async () => {
    const liveRes = await app.inject({
      method: 'GET',
      url: `/api/evidence?learnerId=${SEED_IDS.studentEmma}&limit=100`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    const live = JSON.parse(liveRes.body);
    expect(live.every((e: any) => e.isSuperseded === false)).toBe(true);

    const allRes = await app.inject({
      method: 'GET',
      url: `/api/evidence?learnerId=${SEED_IDS.studentEmma}&limit=100&includeSuperseded=true`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    const all = JSON.parse(allRes.body);
    expect(all.length).toBeGreaterThan(live.length);
    expect(all.some((e: any) => e.isSuperseded === true)).toBe(true);
  });

  it('refuses to correct a row that has already been replaced', async () => {
    const [retired] = await db
      .select()
      .from(schema.learningEvidence)
      .where(eq(schema.learningEvidence.isSuperseded, true))
      .limit(1);

    expect(retired).toBeDefined();

    const res = await app.inject({
      method: 'POST',
      url: `/api/evidence/${retired.id}/correct`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        evidenceId: retired.id,
        correctedNormalizedScore: 0.2,
        reason: 'Trying to correct history twice.',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('counts only the live row toward learner state', async () => {
    const [retired] = await db
      .select()
      .from(schema.learningEvidence)
      .where(eq(schema.learningEvidence.isSuperseded, true))
      .limit(1);

    const live = await db
      .select()
      .from(schema.learningEvidence)
      .where(
        and(
          eq(schema.learningEvidence.learnerId, retired.learnerId),
          eq(schema.learningEvidence.skillId, retired.skillId),
          eq(schema.learningEvidence.isSuperseded, false)
        )
      );

    const [state] = await db
      .select()
      .from(schema.learnerSkillStates)
      .where(
        and(
          eq(schema.learnerSkillStates.learnerId, retired.learnerId),
          eq(schema.learnerSkillStates.skillId, retired.skillId)
        )
      );

    // The retired row is still on disk but must not be counted, or the same
    // answer would be weighted twice.
    expect(state.evidenceCount).toBe(live.length);
  });
});
