import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

/**
 * G16: the evidence endpoint has to answer the question the explorer asks.
 *
 * The screen drops you into a list after you click one sub-skill, so it needs a
 * skill filter; and it prints a count, so the caller needs control over how many
 * rows it is being given rather than silently receiving a default page of 20.
 */
describe('Evidence list filtering and paging', () => {
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

    // 30 observations on one skill, so the default page of 20 is visibly short
    // of the real total.
    for (let i = 0; i < 30; i++) {
      await db.insert(schema.learningEvidence).values({
        learnerId: SEED_IDS.studentEmma,
        skillId: SEED_IDS.skillListening,
        evidenceType: 'TEACHER_EVALUATION',
        evaluatorType: 'TEACHER',
        normalizedScore: 0.5,
        difficulty: 'MEDIUM',
        weight: 1,
        observedAt: new Date(Date.now() - i * 3600000),
      });
    }
  });

  const get = (query: string) =>
    app.inject({
      method: 'GET',
      url: `/api/evidence?${query}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });

  it('returns only the requested skill when one is named', async () => {
    const res = await get(`learnerId=${SEED_IDS.studentEmma}&skillId=${SEED_IDS.skillListening}&limit=100`);
    expect(res.statusCode).toBe(200);
    const rows = res.json();

    expect(rows.length).toBe(30);
    expect(rows.every((e: any) => e.skillId === SEED_IDS.skillListening)).toBe(true);
  });

  it('returns more than one skill when none is named', async () => {
    const res = await get(`learnerId=${SEED_IDS.studentEmma}&limit=100`);
    const rows = res.json();

    const skills = new Set(rows.map((e: any) => e.skillId));
    expect(skills.size).toBeGreaterThan(1);
  });

  it('caps the page at 100 however large a limit is asked for', async () => {
    const res = await get(`learnerId=${SEED_IDS.studentEmma}&limit=5000`);
    expect(res.json().length).toBeLessThanOrEqual(100);
  });

  it('honours a smaller limit, which is what the old default silently did', async () => {
    const twenty = (await get(`learnerId=${SEED_IDS.studentEmma}&limit=20`)).json();
    const hundred = (await get(`learnerId=${SEED_IDS.studentEmma}&limit=100`)).json();

    expect(twenty.length).toBe(20);
    // The screen used to print `twenty.length` as the retained total.
    expect(hundred.length).toBeGreaterThan(twenty.length);
  });

  it('still refuses a learner the teacher does not teach', async () => {
    const [outsider] = await db
      .insert(schema.users)
      .values({
        email: `outsider-${Date.now()}@student.acorn.edu`,
        passwordHash: 'x',
        name: 'Outsider',
        role: 'STUDENT',
      })
      .returning();

    const res = await get(`learnerId=${outsider.id}&skillId=${SEED_IDS.skillListening}`);
    expect(res.statusCode).toBe(403);

    await db.delete(schema.users).where(eq(schema.users.id, outsider.id));
  });
});
