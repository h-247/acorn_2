import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

/**
 * G13: the assessment lifecycle actually holds.
 *
 * Three separate faults sat here. A question could be stored with no way to
 * answer it. Publish and close wrote the status straight to the row without
 * asking where it came from, so DRAFT -> PUBLISHED skipped READY entirely.
 * And closing a paper left its assignments OPEN, so learners kept submitting
 * against it - reproduced as HTTP 200 after a close.
 */
describe('Assessment lifecycle', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let mcqIds: string[];
  let skillId: string;

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
    mcqIds = all.filter((q) => q.type === 'MCQ' && q.correctAnswer).slice(0, 2).map((q) => q.id);

    const [skill] = await db.select().from(schema.skills).limit(1);
    skillId = skill.id;
  });

  const auth = () => ({ authorization: `Bearer ${teacherToken}` });

  const createPaper = async (questionIds: string[], title = 'Lifecycle paper') =>
    (
      await app.inject({
        method: 'POST',
        url: '/api/assessments',
        headers: auth(),
        payload: { title: `${title} ${Math.random().toString(36).slice(2, 8)}`, level: 'B1', questionIds },
      })
    ).json();

  /** The contract will not create a paper with no questions, so make one directly. */
  const createEmptyPaper = async () => {
    const [row] = await db
      .insert(schema.assessments)
      .values({
        title: 'Empty paper',
        level: 'B1',
        status: 'DRAFT',
        createdBy: SEED_IDS.teacherTaylor,
      })
      .returning();
    return row;
  };

  const step = (id: string, action: 'ready' | 'publish' | 'close') =>
    app.inject({ method: 'PUT', url: `/api/assessments/${id}/${action}`, headers: auth() });

  // ── a question has to be answerable ──────────────────────────────────────

  it('refuses an MCQ with no options', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: auth(),
      payload: {
        type: 'MCQ',
        prompt: 'Which one?',
        correctAnswer: 'A',
        difficulty: 'MEDIUM',
        level: 'B1',
        skills: [{ skillId, role: 'PRIMARY', weight: 1 }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('at least two options');
  });

  it('refuses an MCQ with no answer key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: auth(),
      payload: {
        type: 'MCQ',
        prompt: 'Which one?',
        options: ['A', 'B', 'C'],
        difficulty: 'MEDIUM',
        level: 'B1',
        skills: [{ skillId, role: 'PRIMARY', weight: 1 }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('answer key');
  });

  it('refuses an answer key that is not one of the options', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: auth(),
      payload: {
        type: 'MCQ',
        prompt: 'Which one?',
        options: ['A', 'B', 'C'],
        correctAnswer: 'D',
        difficulty: 'MEDIUM',
        level: 'B1',
        skills: [{ skillId, role: 'PRIMARY', weight: 1 }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('must be one of the options');
  });

  it('accepts a complete MCQ', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: auth(),
      payload: {
        type: 'MCQ',
        prompt: 'Which one is correct?',
        options: ['A', 'B', 'C'],
        correctAnswer: 'B',
        difficulty: 'MEDIUM',
        level: 'B1',
        skills: [{ skillId, role: 'PRIMARY', weight: 1 }],
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('refuses an edit that would strip the answer key', async () => {
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/assessments/questions',
        headers: auth(),
        payload: {
          type: 'MCQ',
          prompt: 'Editable question',
          options: ['A', 'B'],
          correctAnswer: 'A',
          difficulty: 'MEDIUM',
          level: 'B1',
          skills: [{ skillId, role: 'PRIMARY', weight: 1 }],
        },
      })
    ).json();

    // The request is partial, so the rule has to look at the merged result.
    const res = await app.inject({
      method: 'PUT',
      url: `/api/assessments/questions/${created.id}`,
      headers: auth(),
      payload: { correctAnswer: 'Z' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('must be one of the options');
  });

  // ── the states go in order ───────────────────────────────────────────────

  it('will not publish a paper that skipped READY', async () => {
    const paper = await createPaper(mcqIds);
    const res = await step(paper.id, 'publish');
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('DRAFT to PUBLISHED');
  });

  it('will not mark an empty paper ready', async () => {
    const paper = await createEmptyPaper();
    const res = await step(paper.id, 'ready');
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('no questions');
  });

  it('reports what is missing before READY', async () => {
    const paper = await createEmptyPaper();
    const res = await app.inject({
      method: 'GET',
      url: `/api/assessments/${paper.id}/readiness`,
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ready).toBe(false);
    expect(res.json().faults.length).toBeGreaterThan(0);
  });

  it('walks DRAFT -> READY -> PUBLISHED -> CLOSED', async () => {
    const paper = await createPaper(mcqIds);

    expect((await step(paper.id, 'ready')).json().status).toBe('READY');
    expect((await step(paper.id, 'publish')).json().status).toBe('PUBLISHED');
    expect((await step(paper.id, 'close')).json().status).toBe('CLOSED');

    // And nothing comes after CLOSED.
    const res = await step(paper.id, 'publish');
    expect(res.statusCode).toBe(400);
  });

  it('sends a READY paper back to DRAFT when it is edited', async () => {
    const paper = await createPaper(mcqIds);
    await step(paper.id, 'ready');

    const edited = await app.inject({
      method: 'PUT',
      url: `/api/assessments/${paper.id}`,
      headers: auth(),
      payload: { title: 'Reopened for a correction' },
    });
    expect(edited.statusCode).toBe(200);
    // Otherwise a paper could pass the check and then be changed underneath it.
    expect(edited.json().status).toBe('DRAFT');
  });

  it('refuses to close a paper that was never published', async () => {
    const paper = await createPaper(mcqIds);
    await step(paper.id, 'ready');
    const res = await step(paper.id, 'close');
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('READY to CLOSED');
  });

  it('will not assign a paper that is only READY', async () => {
    const paper = await createPaper(mcqIds);
    await step(paper.id, 'ready');

    const res = await app.inject({
      method: 'POST',
      url: `/api/assessments/${paper.id}/assign`,
      headers: auth(),
      payload: { classId: SEED_IDS.classIeltsA },
    });
    expect(res.statusCode).toBe(400);
  });

  // ── closing a paper actually closes it ───────────────────────────────────

  describe('a closed paper turns work away', () => {
    let paperId: string;
    let learnerToken: string;
    let submissionId: string;

    beforeAll(async () => {
      const paper = await createPaper(mcqIds, 'Closing paper');
      paperId = paper.id;
      await step(paperId, 'ready');
      await step(paperId, 'publish');

      await app.inject({
        method: 'POST',
        url: `/api/assessments/${paperId}/assign`,
        headers: auth(),
        payload: { classId: SEED_IDS.classIeltsA },
      });

      const [learner] = await db
        .select()
        .from(schema.classEnrollments)
        .where(eq(schema.classEnrollments.classId, SEED_IDS.classIeltsA))
        .limit(1);

      const [learnerRow] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, learner.learnerId));

      learnerToken = generateToken({
        id: learnerRow.id,
        email: learnerRow.email,
        name: learnerRow.name,
        role: UserRole.STUDENT,
      });

      const [sub] = await db
        .select()
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.assessmentId, paperId),
            eq(schema.submissions.learnerId, learnerRow.id)
          )
        );
      submissionId = sub.id;
    });

    const asLearner = () => ({ authorization: `Bearer ${learnerToken}` });

    it('autosaves while the paper is open', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${submissionId}/autosave`,
        headers: asLearner(),
        payload: { questionId: mcqIds[0], responsePayload: { answer: 'A' } },
      });
      expect(res.statusCode).toBe(200);
    });

    it('closes every assignment along with the paper', async () => {
      const closed = await step(paperId, 'close');
      expect(closed.statusCode).toBe(200);

      const assignments = await db
        .select()
        .from(schema.assignments)
        .where(eq(schema.assignments.assessmentId, paperId));
      expect(assignments.length).toBeGreaterThan(0);
      // This is the one that was missing: the paper closed, the door did not.
      expect(assignments.every((a) => a.status === 'CLOSED')).toBe(true);
    });

    it('refuses an autosave after the close', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${submissionId}/autosave`,
        headers: asLearner(),
        payload: { questionId: mcqIds[0], responsePayload: { answer: 'B' } },
      });
      expect(res.statusCode).toBe(400);
      expect(res.body).toContain('closed');
    });

    it('refuses a submit after the close', async () => {
      // Reproduced as HTTP 200 before this change.
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${submissionId}/submit`,
        headers: asLearner(),
        payload: { answers: [{ questionId: mcqIds[0], responsePayload: { answer: 'A' } }] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.body).toContain('closed');
    });

    it('tells the player the attempt is closed', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/submissions',
        headers: asLearner(),
      });
      const mine = res.json().find((s: any) => s.id === submissionId);
      expect(mine.isClosed).toBe(true);
      expect(mine.assessmentStatus).toBe('CLOSED');
    });
  });

  // ── late is recorded, not refused ────────────────────────────────────────

  it('accepts a submission past the due date and marks it late', async () => {
    const paper = await createPaper(mcqIds, 'Overdue paper');
    await step(paper.id, 'ready');
    await step(paper.id, 'publish');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await app.inject({
      method: 'POST',
      url: `/api/assessments/${paper.id}/assign`,
      headers: auth(),
      payload: { classId: SEED_IDS.classIeltsA, dueAt: yesterday.toISOString() },
    });

    const [enrollment] = await db
      .select()
      .from(schema.classEnrollments)
      .where(eq(schema.classEnrollments.classId, SEED_IDS.classIeltsA))
      .limit(1);
    const [learnerRow] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, enrollment.learnerId));

    const learnerToken = generateToken({
      id: learnerRow.id,
      email: learnerRow.email,
      name: learnerRow.name,
      role: UserRole.STUDENT,
    });

    const [sub] = await db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.assessmentId, paper.id),
          eq(schema.submissions.learnerId, learnerRow.id)
        )
      );

    const res = await app.inject({
      method: 'POST',
      url: `/api/submissions/${sub.id}/submit`,
      headers: { authorization: `Bearer ${learnerToken}` },
      payload: { answers: [{ questionId: mcqIds[0], responsePayload: { answer: 'A' } }] },
    });

    // The policy: a late attempt is taken and flagged, and the teacher decides
    // what it is worth. Only a close turns work away.
    expect(res.statusCode).toBe(200);
    const [stored] = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, sub.id));
    expect(stored.isLate).toBe(true);
    expect(stored.lateMinutes).toBeGreaterThan(0);
  });
});
