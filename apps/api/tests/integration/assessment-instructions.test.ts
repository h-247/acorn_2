import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

/**
 * G12: instructions are a field of their own, and the learner has to get them.
 *
 * The builder folded the text into `description`, so it was stored, shown on
 * listings, and never reached the player - which reads `instructions`. Everything
 * between the two already worked; only the form was sending it to the wrong place.
 */
describe('Assessment instructions reach the learner', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let questionId: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();
    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    const [q] = await db.select().from(schema.questions).limit(1);
    questionId = q.id;
  });

  it('stores instructions separately from the description', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        title: 'Instructions probe',
        description: 'A short reading checkpoint.',
        instructions: 'Read the passage twice before answering.',
        level: 'B1',
        timeLimitMinutes: 20,
        questionIds: [questionId],
      },
    });
    expect(res.statusCode).toBe(201);
    const created = res.json();

    const [stored] = await db
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.id, created.id));

    expect(stored.instructions).toBe('Read the passage twice before answering.');
    expect(stored.description).toBe('A short reading checkpoint.');

    // The old builder appended the instructions onto the description, which is
    // how they ended up somewhere the player never looks.
    expect(stored.description).not.toContain('Read the passage twice');
  });

  it('hands the instructions to the learner sitting the paper', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        title: 'Player instructions probe',
        instructions: 'Answer in complete sentences.',
        level: 'B1',
        questionIds: [questionId],
      },
    });
    const assessment = createRes.json();

    await app.inject({
      method: 'PUT',
      url: `/api/assessments/${assessment.id}/publish`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });

    const assignRes = await app.inject({
      method: 'POST',
      url: `/api/assessments/${assessment.id}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { classId: SEED_IDS.classIeltsA },
    });
    expect([200, 201]).toContain(assignRes.statusCode);

    const [submission] = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.assessmentId, assessment.id))
      .limit(1);
    expect(submission).toBeDefined();

    const subRes = await app.inject({
      method: 'GET',
      url: `/api/submissions/${submission.id}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(subRes.json().assessmentInstructions).toBe('Answer in complete sentences.');
  });
});
