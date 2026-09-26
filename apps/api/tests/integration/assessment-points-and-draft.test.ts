import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

/**
 * G12: a teacher can weight the questions, and can correct a draft.
 *
 * Every question without a rubric was fixed at one point, with no way to say
 * otherwise. And the builder always created a new assessment, so the draft
 * update the backend already supported was unreachable from the interface.
 */
describe('Assessment points and draft editing', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let plainQuestions: any[];
  let rubricQuestion: any;

  beforeAll(async () => {
    await seed();
    app = buildApp();
    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    const all = await db.select().from(schema.questions);
    plainQuestions = all.filter((q) => !q.rubric).slice(0, 2);
    rubricQuestion = all.find((q) => q.rubric);
  });

  const auth = () => ({ authorization: `Bearer ${teacherToken}` });

  const itemsOf = (assessmentId: string) =>
    db
      .select()
      .from(schema.assessmentItems)
      .where(eq(schema.assessmentItems.assessmentId, assessmentId));

  it('weights a question the teacher asked to be worth more', async () => {
    const [a, b] = plainQuestions;

    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: auth(),
      payload: {
        title: 'Weighted paper',
        level: 'B1',
        questionIds: [a.id, b.id],
        itemPoints: { [a.id]: 5 },
      },
    });
    expect(res.statusCode).toBe(201);

    const items = await itemsOf(res.json().id);
    expect(items.find((i) => i.questionId === a.id)!.points).toBe(5);
    // Saying nothing still means one point.
    expect(items.find((i) => i.questionId === b.id)!.points).toBe(1);
  });

  it('lets a rubric decide its own total, whatever the teacher types', async () => {
    if (!rubricQuestion) return;

    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: auth(),
      payload: {
        title: 'Rubric paper',
        level: 'B1',
        questionIds: [rubricQuestion.id],
        itemPoints: { [rubricQuestion.id]: 3 },
      },
    });
    expect(res.statusCode).toBe(201);

    const parsed =
      typeof rubricQuestion.rubric === 'string'
        ? JSON.parse(rubricQuestion.rubric)
        : rubricQuestion.rubric;
    const rubricTotal = parsed.reduce((sum: number, c: any) => sum + (c.maxScore || 0), 0);

    const [item] = await itemsOf(res.json().id);
    // The marking screen checks maxScore against this, so letting the two
    // disagree would fail evaluation later rather than here.
    expect(item.points).toBe(rubricTotal);
    expect(item.points).not.toBe(3);
  });

  it('reopens a draft and keeps the edits, including the weights', async () => {
    const [a, b] = plainQuestions;

    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/assessments',
        headers: auth(),
        payload: {
          title: 'Draft to correct',
          instructions: 'First attempt.',
          level: 'B1',
          questionIds: [a.id],
        },
      })
    ).json();

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/assessments/${created.id}`,
      headers: auth(),
      payload: {
        title: 'Draft corrected',
        instructions: 'Second attempt, clearer.',
        questionIds: [a.id, b.id],
        itemPoints: { [b.id]: 4 },
      },
    });
    expect(updated.statusCode).toBe(200);

    const [stored] = await db
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.id, created.id));
    expect(stored.title).toBe('Draft corrected');
    expect(stored.instructions).toBe('Second attempt, clearer.');
    expect(stored.status).toBe('DRAFT');

    const items = await itemsOf(created.id);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.questionId === b.id)!.points).toBe(4);
  });

  it('refuses to reshape a paper that is already published', async () => {
    const [a] = plainQuestions;

    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/assessments',
        headers: auth(),
        payload: { title: 'Published paper', level: 'B1', questionIds: [a.id] },
      })
    ).json();

    await app.inject({
      method: 'PUT',
      url: `/api/assessments/${created.id}/publish`,
      headers: auth(),
    });

    // Learners may already be sitting it.
    const res = await app.inject({
      method: 'PUT',
      url: `/api/assessments/${created.id}`,
      headers: auth(),
      payload: { title: 'Too late' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('does not write itemPoints onto the assessment row', async () => {
    const [a] = plainQuestions;

    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/assessments',
        headers: auth(),
        payload: { title: 'Column guard', level: 'B1', questionIds: [a.id] },
      })
    ).json();

    // itemPoints belongs to assessment_items; reaching the SET clause of the
    // assessments update would be a column that does not exist.
    const res = await app.inject({
      method: 'PUT',
      url: `/api/assessments/${created.id}`,
      headers: auth(),
      payload: { questionIds: [a.id], itemPoints: { [a.id]: 7 } },
    });
    expect(res.statusCode).toBe(200);

    const items = await itemsOf(created.id);
    expect(items[0].points).toBe(7);
  });
});
