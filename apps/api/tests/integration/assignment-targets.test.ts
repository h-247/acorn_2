import { describe, it, expect, beforeAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

/**
 * G14: assigning reaches exactly who was named.
 *
 * Naming learners used to write one assignment holding only the first one's
 * id while creating submissions for all of them, so everyone after the first
 * held a submission against an assignment that was not theirs and got 403
 * opening the assessment. Naming learners alongside a class quietly unioned in
 * the whole roster. With no class, the duplicate check matched any OPEN
 * assignment of the assessment, whoever it belonged to. And re-assigning
 * reused the old row and dropped the new deadline.
 */
describe('Assignment targets', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let mcqIds: string[];
  let roster: { id: string; email: string; name: string }[];

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

    const enrolled = await db
      .select({ learnerId: schema.classEnrollments.learnerId })
      .from(schema.classEnrollments)
      .where(eq(schema.classEnrollments.classId, SEED_IDS.classIeltsA));

    roster = await db
      .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
      .from(schema.users)
      .where(inArray(schema.users.id, enrolled.map((e) => e.learnerId)));

    expect(roster.length).toBeGreaterThanOrEqual(3);
  });

  const auth = () => ({ authorization: `Bearer ${teacherToken}` });

  /** A fresh published paper, so each case starts from nothing assigned. */
  const publishedPaper = async (title: string) => {
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/assessments',
        headers: auth(),
        payload: {
          title: `${title} ${Math.random().toString(36).slice(2, 8)}`,
          level: 'B1',
          questionIds: mcqIds,
        },
      })
    ).json();

    await app.inject({ method: 'PUT', url: `/api/assessments/${created.id}/ready`, headers: auth() });
    await app.inject({ method: 'PUT', url: `/api/assessments/${created.id}/publish`, headers: auth() });
    return created.id as string;
  };

  const assign = (assessmentId: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: `/api/assessments/${assessmentId}/assign`,
      headers: auth(),
      payload,
    });

  const learnersWithWork = async (assessmentId: string) => {
    const subs = await db
      .select({ learnerId: schema.submissions.learnerId })
      .from(schema.submissions)
      .where(eq(schema.submissions.assessmentId, assessmentId));
    return new Set(subs.map((s) => s.learnerId));
  };

  const tokenFor = (learner: { id: string; email: string; name: string }) =>
    generateToken({ ...learner, role: UserRole.STUDENT });

  // ── who receives it ──────────────────────────────────────────────────────

  it('gives one named learner the paper, and nobody else', async () => {
    const paperId = await publishedPaper('Single learner');
    const [alone] = roster;

    const res = await assign(paperId, { learnerIds: [alone.id] });
    expect(res.statusCode).toBe(201);
    expect(res.json().learnersAssigned).toBe(1);

    expect(await learnersWithWork(paperId)).toEqual(new Set([alone.id]));
  });

  it('gives two named learners the paper, and nobody else', async () => {
    const paperId = await publishedPaper('Two learners');
    const [a, b] = roster;

    const res = await assign(paperId, { learnerIds: [a.id, b.id] });
    expect(res.statusCode).toBe(201);
    expect(res.json().learnersAssigned).toBe(2);

    expect(await learnersWithWork(paperId)).toEqual(new Set([a.id, b.id]));

    // Each gets their own assignment; the old code kept only the first id and
    // hung the second learner's submission off it.
    const assignments = await db
      .select()
      .from(schema.assignments)
      .where(eq(schema.assignments.assessmentId, paperId));
    expect(assignments).toHaveLength(2);
    expect(new Set(assignments.map((x) => x.learnerId))).toEqual(new Set([a.id, b.id]));

    for (const assignment of assignments) {
      const subs = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.assignmentId, assignment.id));
      expect(subs).toHaveLength(1);
      expect(subs[0].learnerId).toBe(assignment.learnerId);
    }
  });

  it('does not widen to the whole class when a class is named alongside learners', async () => {
    const paperId = await publishedPaper('Class plus learners');
    const [a, b] = roster;

    const res = await assign(paperId, { classId: SEED_IDS.classIeltsA, learnerIds: [a.id, b.id] });
    expect(res.statusCode).toBe(201);

    // The class is context for the teacher's views, not an audience.
    expect(await learnersWithWork(paperId)).toEqual(new Set([a.id, b.id]));
  });

  it('gives the whole class the paper when only a class is named', async () => {
    const paperId = await publishedPaper('Whole class');

    const res = await assign(paperId, { classId: SEED_IDS.classIeltsA });
    expect(res.statusCode).toBe(201);
    expect(res.json().learnersAssigned).toBe(roster.length);

    expect(await learnersWithWork(paperId)).toEqual(new Set(roster.map((r) => r.id)));
  });

  it('refuses an assignment that names nobody', async () => {
    const paperId = await publishedPaper('No target');
    const res = await assign(paperId, {});
    expect(res.statusCode).toBe(400);
  });

  // ── a learner only sees what was sent to them ────────────────────────────

  it('hides one learner’s assignment from their classmates', async () => {
    const paperId = await publishedPaper('Private to one');
    const [alone, classmate] = roster;

    await assign(paperId, { classId: SEED_IDS.classIeltsA, learnerIds: [alone.id] });

    const mine = await app.inject({
      method: 'GET',
      url: `/api/assessments/${paperId}`,
      headers: { authorization: `Bearer ${tokenFor(alone)}` },
    });
    expect(mine.statusCode).toBe(200);

    // The assignment carries classIeltsA, and the classmate is in it - but it
    // names someone else, so it must not reach them.
    const theirs = await app.inject({
      method: 'GET',
      url: `/api/assessments/${paperId}`,
      headers: { authorization: `Bearer ${tokenFor(classmate)}` },
    });
    // 403 rather than 404 is the endpoint's existing answer for a learner who
    // was not assigned; what matters here is that it is refused.
    expect(theirs.statusCode).toBe(403);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/assessments',
      headers: { authorization: `Bearer ${tokenFor(classmate)}` },
    });
    expect(listed.json().some((a: any) => a.id === paperId)).toBe(false);
  });

  it('lets a named learner open the paper they were given', async () => {
    const paperId = await publishedPaper('Second of two');
    const [a, b] = roster;

    await assign(paperId, { learnerIds: [a.id, b.id] });

    // Reproduced as 403 before this change: b held a submission against a's
    // assignment.
    const res = await app.inject({
      method: 'GET',
      url: `/api/assessments/${paperId}`,
      headers: { authorization: `Bearer ${tokenFor(b)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  // ── assigning twice ──────────────────────────────────────────────────────

  it('creates nothing extra when the same call is retried', async () => {
    const paperId = await publishedPaper('Retry');
    const [a, b] = roster;
    const payload = { learnerIds: [a.id, b.id] };

    await assign(paperId, payload);
    await assign(paperId, payload);
    await assign(paperId, payload);

    const assignments = await db
      .select()
      .from(schema.assignments)
      .where(eq(schema.assignments.assessmentId, paperId));
    expect(assignments).toHaveLength(2);

    const subs = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.assessmentId, paperId));
    expect(subs).toHaveLength(2);
  });

  it('moves the deadline when the class is assigned again', async () => {
    const paperId = await publishedPaper('New deadline');
    const first = new Date(Date.now() + 24 * 3600 * 1000);
    const second = new Date(Date.now() + 72 * 3600 * 1000);

    await assign(paperId, { classId: SEED_IDS.classIeltsA, dueAt: first.toISOString() });
    const res = await assign(paperId, {
      classId: SEED_IDS.classIeltsA,
      dueAt: second.toISOString(),
    });
    expect(res.statusCode).toBe(201);

    const [assignment] = await db
      .select()
      .from(schema.assignments)
      .where(eq(schema.assignments.assessmentId, paperId));
    // Silently ignored before: the second call found the row and returned it.
    expect(assignment.dueAt!.toISOString()).toBe(second.toISOString());
  });

  it('keeps the work a learner already did when the paper is assigned again', async () => {
    const paperId = await publishedPaper('Reassign keeps work');
    const [a] = roster;

    await assign(paperId, { learnerIds: [a.id] });

    const [sub] = await db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.assessmentId, paperId),
          eq(schema.submissions.learnerId, a.id)
        )
      );

    await app.inject({
      method: 'POST',
      url: `/api/submissions/${sub.id}/autosave`,
      headers: { authorization: `Bearer ${tokenFor(a)}` },
      payload: { questionId: mcqIds[0], responsePayload: { answer: 'A' } },
    });

    await assign(paperId, { learnerIds: [a.id] });

    const after = await db
      .select()
      .from(schema.submissions)
      .where(
        and(
          eq(schema.submissions.assessmentId, paperId),
          eq(schema.submissions.learnerId, a.id)
        )
      );
    // Re-assigning is not a reset: one attempt, still in progress, answers kept.
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(sub.id);
    expect(after[0].status).toBe('IN_PROGRESS');

    const responses = await db
      .select()
      .from(schema.submissionResponses)
      .where(eq(schema.submissionResponses.submissionId, sub.id));
    expect(responses).toHaveLength(1);
  });

  // -- Next Activity ------------------------------------------------------

  it('sends a recommended paper to the one learner it is about', async () => {
    await db
      .update(schema.recommendations)
      .set({ decisionStatus: 'WAITING', isStale: false })
      .where(eq(schema.recommendations.id, SEED_IDS.recEmmaReadingInference));

    const paperId = await publishedPaper('Next activity');

    const res = await app.inject({
      method: 'POST',
      url: `/api/recommendations/${SEED_IDS.recEmmaReadingInference}/assign-next-activity`,
      headers: auth(),
      payload: { assessmentId: paperId, classId: SEED_IDS.classIeltsA },
    });
    expect([200, 201]).toContain(res.statusCode);

    // The interface calls this "Individual Learner Only", but a classId used
    // to turn it into a class-wide release with a submission for everyone.
    const reached = await learnersWithWork(paperId);
    expect(reached.size).toBe(1);
    expect(reached.has(SEED_IDS.studentEmma)).toBe(true);

    const [assignment] = await db
      .select()
      .from(schema.assignments)
      .where(eq(schema.assignments.assessmentId, paperId));
    expect(assignment.learnerId).toBe(SEED_IDS.studentEmma);
  });

  it('does not reuse one learner’s assignment for another', async () => {
    const paperId = await publishedPaper('No stolen assignment');
    const [a, b] = roster;

    await assign(paperId, { learnerIds: [a.id] });
    await assign(paperId, { learnerIds: [b.id] });

    const assignments = await db
      .select()
      .from(schema.assignments)
      .where(eq(schema.assignments.assessmentId, paperId));
    // The old duplicate check matched any OPEN assignment of the assessment,
    // so b was handed a's row.
    expect(assignments).toHaveLength(2);
    expect(new Set(assignments.map((x) => x.learnerId))).toEqual(new Set([a.id, b.id]));
  });
});
