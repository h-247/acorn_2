import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

describe('Assignment Idempotency', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  const assessmentId = SEED_IDS.assessmentReading03;
  const classId = SEED_IDS.classIeltsA;
  const learnerId = SEED_IDS.studentEmma;

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

  afterAll(async () => {
    await app.close();
  });

  it('handles repeated and concurrent assignment requests idempotently', async () => {
    // Fire concurrent requests
    const p1 = app.inject({
      method: 'POST',
      url: `/api/assessments/${assessmentId}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { classId, dueAt: new Date().toISOString() },
    });

    const p2 = app.inject({
      method: 'POST',
      url: `/api/assessments/${assessmentId}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { classId, dueAt: new Date().toISOString() },
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    if (res1.statusCode !== 201) console.error('RES1 ERROR:', res1.body);
    if (res2.statusCode !== 201) console.error('RES2 ERROR:', res2.body);
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);

    const data1 = JSON.parse(res1.body);
    const data2 = JSON.parse(res2.body);

    // Assert that the assignments returned are identical
    expect(data1.id).toEqual(data2.id);

    // Verify repeated request sequentially
    const res3 = await app.inject({
      method: 'POST',
      url: `/api/assessments/${assessmentId}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { classId, dueAt: new Date().toISOString() },
    });
    expect(res3.statusCode).toBe(201);
    const data3 = JSON.parse(res3.body);
    expect(data3.id).toEqual(data1.id);

    const { db } = await import('../../src/infrastructure/persistence/db.js');
    const schema = await import('../../src/infrastructure/persistence/schema.js');
    const { eq, and } = await import('drizzle-orm');

    // Exactly one active assignment
    const assignments = await db.select().from(schema.assignments).where(and(eq(schema.assignments.assessmentId, assessmentId), eq(schema.assignments.classId, classId), eq(schema.assignments.status, 'OPEN')));
    expect(assignments.length).toBe(1);

    // Exactly one submission per learner
    const submissions = await db.select().from(schema.submissions).where(eq(schema.submissions.assignmentId, assignments[0].id));

    // In seed.ts, exactly 10 students are enrolled in classIeltsA. Wait, Emma, Liam, Sofia have seeded submissions in seed.ts for assignmentReading03.
    // So if this test uses the seeded assignment, it's returning the existing OPEN assignment which was seeded.
    // We should assert that the number of submissions is the number of enrolled students, or just group by learnerId to ensure exactly 1 per learner.
    const learnerSubmissionCount = new Map<string, number>();
    for (const sub of submissions) {
      learnerSubmissionCount.set(sub.learnerId, (learnerSubmissionCount.get(sub.learnerId) || 0) + 1);
    }

    // Assert exactly 1 submission per learner
    for (const count of learnerSubmissionCount.values()) {
      expect(count).toBe(1);
    }

    // There are 10 students in classIeltsA
    expect(learnerSubmissionCount.size).toBe(10);
  });

  it('tests true first-write assignment concurrency for a new assessment', async () => {
    const { db } = await import('../../src/infrastructure/persistence/db.js');
    const schema = await import('../../src/infrastructure/persistence/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const { randomUUID } = await import('crypto');

    // Create a new assessment with no existing assignment
    const newAssessmentId = randomUUID();
    await db.insert(schema.assessments).values({
      id: newAssessmentId,
      title: 'First-Write Concurrency Assessment',
      status: 'PUBLISHED',
      level: 'B2',
      createdBy: SEED_IDS.teacherTaylor,
    });

    // Fire concurrent first-time assignment requests for the same class
    const p1 = app.inject({
      method: 'POST',
      url: `/api/assessments/${newAssessmentId}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { classId },
    });

    const p2 = app.inject({
      method: 'POST',
      url: `/api/assessments/${newAssessmentId}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { classId },
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);

    const data1 = JSON.parse(res1.body);
    const data2 = JSON.parse(res2.body);

    // Return the same assignment
    expect(data1.id).toEqual(data2.id);

    // Query database: exactly one open assignment exists
    const assignments = await db.select().from(schema.assignments).where(and(eq(schema.assignments.assessmentId, newAssessmentId), eq(schema.assignments.classId, classId), eq(schema.assignments.status, 'OPEN')));
    expect(assignments.length).toBe(1);

    // Verify exactly one submission exists per enrolled learner
    const submissions = await db.select().from(schema.submissions).where(eq(schema.submissions.assignmentId, assignments[0].id));

    const learnerSubCount = new Map<string, number>();
    for (const sub of submissions) {
      learnerSubCount.set(sub.learnerId, (learnerSubCount.get(sub.learnerId) || 0) + 1);
    }
    for (const count of learnerSubCount.values()) {
      expect(count).toBe(1);
    }
    // 10 students in classIeltsA
    expect(learnerSubCount.size).toBe(10);
  });

  it('tests true first-write assignment concurrency for a new individual learner assignment', async () => {
    const { db } = await import('../../src/infrastructure/persistence/db.js');
    const schema = await import('../../src/infrastructure/persistence/schema.js');
    const { eq, and, isNull } = await import('drizzle-orm');
    const { randomUUID } = await import('crypto');

    // Create a new assessment with no existing assignment
    const newAssessmentId = randomUUID();
    await db.insert(schema.assessments).values({
      id: newAssessmentId,
      title: 'Individual Concurrency Assessment',
      status: 'PUBLISHED',
      level: 'B2',
      createdBy: SEED_IDS.teacherTaylor,
    });

    // Fire concurrent first-time assignment requests for the same learner
    const p1 = app.inject({
      method: 'POST',
      url: `/api/assessments/${newAssessmentId}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { learnerIds: [learnerId] },
    });

    const p2 = app.inject({
      method: 'POST',
      url: `/api/assessments/${newAssessmentId}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: { learnerIds: [learnerId] },
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);

    const data1 = JSON.parse(res1.body);
    const data2 = JSON.parse(res2.body);

    // Return the same assignment
    expect(data1.id).toEqual(data2.id);

    // Query database: exactly one open individual assignment exists (classId is null)
    const assignments = await db.select().from(schema.assignments).where(and(eq(schema.assignments.assessmentId, newAssessmentId), isNull(schema.assignments.classId), eq(schema.assignments.status, 'OPEN')));
    expect(assignments.length).toBe(1);

    // Verify exactly one submission exists for the specific learner
    const submissions = await db.select().from(schema.submissions).where(eq(schema.submissions.assignmentId, assignments[0].id));
    expect(submissions.length).toBe(1);
    expect(submissions[0].learnerId).toBe(learnerId);
  });
});
