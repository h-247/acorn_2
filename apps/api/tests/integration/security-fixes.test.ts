import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import { storage } from '../../src/infrastructure/object-storage/storage.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { resetDatabase } from '../../src/infrastructure/persistence/reset-db.js';
import { UserRole, AssessmentStatus, QuestionType, SubmissionStatus, MaterialStatus, TeacherDecisionStatus } from '@acorn/contracts';
import { hashPassword } from '../../src/infrastructure/auth/crypto.js';
import { eq, and } from 'drizzle-orm';

describe('Security, Authorization, and Integrity Fixes', () => {
  let app: ReturnType<typeof buildApp>;

  const TEACHER_DAVID_ID = '11111111-1111-1111-1111-111111111112';
  const CLASS_IELTS_B_ID = '55555555-5555-5555-5555-555555555557';
  const ASSESSMENT_CLASS_B_ID = '99999999-9999-9999-9999-999999999977';
  const ASSIGNMENT_CLASS_B_ID = '99999999-9999-9999-9999-999999999902';
  const SUBMISSION_CLASS_B_ID = '99999999-9999-9999-9999-999999999903';
  const SPEAKING_Q_ID = '33333333-3333-3333-3333-333333333333';
  const TEST_STUDENT_ID = '99999999-0000-0000-0000-000000000099';

  let adminToken: string;
  let teacherTaylorToken: string;
  let teacherDavidToken: string;
  let studentEmmaToken: string;
  let studentLiamToken: string;
  let testStudentToken: string;
  let draftSubId: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    adminToken = generateToken({
      id: SEED_IDS.adminUser,
      email: 'admin@acorn.edu',
      name: 'System Admin',
      role: UserRole.ADMIN,
      tokenVersion: 1,
    });

    teacherTaylorToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
      tokenVersion: 1,
    });

    // 1. Create Teacher David
    await db.insert(schema.users).values({
      id: TEACHER_DAVID_ID,
      email: 'david@acorn.edu',
      passwordHash: hashPassword('password123'),
      name: 'Mr. David',
      role: UserRole.TEACHER,
      isActive: true,
      tokenVersion: 1,
    }).onConflictDoUpdate({
      target: schema.users.id,
      set: { name: 'Mr. David', tokenVersion: 1, isActive: true },
    });

    teacherDavidToken = generateToken({
      id: TEACHER_DAVID_ID,
      email: 'david@acorn.edu',
      name: 'Mr. David',
      role: UserRole.TEACHER,
      tokenVersion: 1,
    });

    studentEmmaToken = generateToken({
      id: SEED_IDS.studentEmma,
      email: 'emma.nguyen@student.acorn.edu',
      name: 'Emma Nguyen',
      role: UserRole.STUDENT,
      tokenVersion: 1,
    });

    studentLiamToken = generateToken({
      id: SEED_IDS.studentLiam,
      email: 'liam.chen@student.acorn.edu',
      name: 'Liam Chen',
      role: UserRole.STUDENT,
      tokenVersion: 1,
    });

    // Dedicated test student for recommendation tests
    await db.insert(schema.users).values({
      id: TEST_STUDENT_ID,
      email: 'security.student@acorn.edu',
      passwordHash: hashPassword('password123'),
      name: 'Security Test Student',
      role: UserRole.STUDENT,
      isActive: true,
      tokenVersion: 1,
    }).onConflictDoUpdate({
      target: schema.users.id,
      set: { tokenVersion: 1, isActive: true },
    });

    testStudentToken = generateToken({
      id: TEST_STUDENT_ID,
      email: 'security.student@acorn.edu',
      name: 'Security Test Student',
      role: UserRole.STUDENT,
      tokenVersion: 1,
    });

    // 2. Create Class IELTS B taught by David
    await db.insert(schema.classes).values({
      id: CLASS_IELTS_B_ID,
      courseId: SEED_IDS.courseIelts,
      name: 'IELTS Band 7+ Cohort B',
      teacherId: TEACHER_DAVID_ID,
      level: 'B2',
    }).onConflictDoNothing();

    // 3. Enroll Emma and Test Student in Class B and Class A
    await db.insert(schema.classEnrollments).values([
      {
        id: '55555555-5555-5555-5555-555555555558',
        classId: CLASS_IELTS_B_ID,
        learnerId: SEED_IDS.studentEmma,
      },
      {
        id: '55555555-5555-5555-5555-555555555598',
        classId: SEED_IDS.classIeltsA,
        learnerId: TEST_STUDENT_ID,
      },
      {
        id: '55555555-5555-5555-5555-555555555599',
        classId: CLASS_IELTS_B_ID,
        learnerId: TEST_STUDENT_ID,
      },
    ]).onConflictDoNothing();

    // 4. Create an assessment for Class B
    await db.insert(schema.assessments).values({
      id: ASSESSMENT_CLASS_B_ID,
      title: 'Class B Exclusive Diagnostic',
      status: AssessmentStatus.PUBLISHED,
      level: 'B2',
      createdBy: TEACHER_DAVID_ID,
    }).onConflictDoNothing();

    // Link questions to this assessment
    await db.insert(schema.assessmentItems).values({
      assessmentId: ASSESSMENT_CLASS_B_ID,
      questionId: SEED_IDS.qMainIdeaUrbanFarming,
      sequenceOrder: 0,
      points: 10,
    }).onConflictDoNothing();

    await db.insert(schema.questions).values({
      id: SPEAKING_Q_ID,
      type: QuestionType.SPEAKING,
      prompt: 'Describe a city you visited.',
      level: 'B1',
      difficulty: 'MEDIUM',
    }).onConflictDoNothing();

    await db.insert(schema.assessmentItems).values({
      assessmentId: ASSESSMENT_CLASS_B_ID,
      questionId: SPEAKING_Q_ID,
      sequenceOrder: 1,
      points: 10,
    }).onConflictDoNothing();

    // 5. Assign assessment to Class B
    await db.insert(schema.assignments).values({
      id: ASSIGNMENT_CLASS_B_ID,
      assessmentId: ASSESSMENT_CLASS_B_ID,
      classId: CLASS_IELTS_B_ID,
      status: 'OPEN',
    }).onConflictDoNothing();

    // 6. Create Emma submission in Class B (status SUBMITTED)
    await db.insert(schema.submissions).values({
      id: SUBMISSION_CLASS_B_ID,
      assignmentId: ASSIGNMENT_CLASS_B_ID,
      assessmentId: ASSESSMENT_CLASS_B_ID,
      learnerId: SEED_IDS.studentEmma,
      status: SubmissionStatus.SUBMITTED,
      submittedAt: new Date(),
      maxPossibleScore: 10,
    }).onConflictDoUpdate({
      target: schema.submissions.id,
      set: {
        assessmentId: ASSESSMENT_CLASS_B_ID,
        assignmentId: ASSIGNMENT_CLASS_B_ID,
        status: SubmissionStatus.SUBMITTED,
      },
    });

    // 7. Create draft submission in Class B (status STARTED)
    draftSubId = '88888888-9999-aaaa-bbbb-111111111111';
    await db.insert(schema.submissions).values({
      id: draftSubId,
      assignmentId: ASSIGNMENT_CLASS_B_ID,
      assessmentId: ASSESSMENT_CLASS_B_ID,
      learnerId: SEED_IDS.studentEmma,
      status: SubmissionStatus.STARTED,
      maxPossibleScore: 10,
    }).onConflictDoUpdate({
      target: schema.submissions.id,
      set: {
        assessmentId: ASSESSMENT_CLASS_B_ID,
        assignmentId: ASSIGNMENT_CLASS_B_ID,
        status: SubmissionStatus.STARTED,
      },
    });
  });

  afterAll(async () => {
    // This suite creates an additional teacher, class, enrollments and related
    // records to exercise authorization boundaries. Restore the canonical seed
    // before the next integration suite runs.
    await resetDatabase();
    await app.close();
  });

  // ==========================================
  // ITEM 1: Authorization at Assignment & Class Level
  // ==========================================
  describe('1. Cross-Class Submission & Assignment Authorization', () => {
    it('prevents Teacher Taylor from seeing Emma submission from Teacher David class in GET /submissions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/submissions',
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
      });
      expect(res.statusCode).toBe(200);
      const subs = JSON.parse(res.body);
      const found = subs.find((s: any) => s.id === SUBMISSION_CLASS_B_ID);
      expect(found).toBeUndefined();
    });

    it('allows Teacher David to see Emma submission from his own class in GET /submissions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/submissions',
        headers: { authorization: `Bearer ${teacherDavidToken}` },
      });
      expect(res.statusCode).toBe(200);
      const subs = JSON.parse(res.body);
      const found = subs.find((s: any) => s.id === SUBMISSION_CLASS_B_ID);
      expect(found).toBeDefined();
    });

    it('rejects Teacher Taylor viewing submission detail for Class B submission with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects Teacher Taylor accessing audio for Class B submission with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/audio/${SEED_IDS.qMainIdeaUrbanFarming}`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects Teacher Taylor evaluating Class B submission with 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/evaluate`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: {
          responses: [
            {
              questionId: SEED_IDS.qMainIdeaUrbanFarming,
              rawScore: 8,
              maxScore: 10,
            },
          ],
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects assigning assessment to a class when learnerId is NOT enrolled in target class', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/assessments/${ASSESSMENT_CLASS_B_ID}/assign`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          classId: CLASS_IELTS_B_ID,
          learnerIds: [SEED_IDS.studentLiam],
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('not enrolled in class');
    });
  });

  // ==========================================
  // ITEM 2: Secure and Make Assign Next Activity Idempotent
  // ==========================================
  describe('2. Assign Next Activity Security & Idempotency', () => {
    async function createTestRecommendation(overrides: Partial<typeof schema.recommendations.$inferInsert> = {}) {
      const recId = randomUUID();
      const [newRec] = await db.insert(schema.recommendations).values({
        id: recId,
        learnerId: TEST_STUDENT_ID,
        targetSkillId: SEED_IDS.skillReading,
        targetLevel: 'B1',
        priority: 'MEDIUM',
        decisionStatus: 'PENDING',
        recommendedActionText: 'Practice reading comprehension',
        rationale: ['Student needs practice'],
        evidenceBasisCount: 1,
        learnerConfidence: 'HIGH',
        ...overrides,
      }).returning();
      return newRec.id;
    }

    it('rejects assigning next activity if teacher does not control the target class with 403', async () => {
      const recId = await createTestRecommendation();
      const res = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          classId: SEED_IDS.classIeltsA,
          materialId: SEED_IDS.matUrbanFarming,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects assigning next activity if learner does not belong to target class with 400', async () => {
      await db
        .insert(schema.classes)
        .values({
          id: '55555555-5555-5555-5555-555555555566',
          courseId: SEED_IDS.courseIelts,
          name: 'Taylor Other Class',
          teacherId: SEED_IDS.teacherTaylor,
          level: 'B1',
        })
        .onConflictDoNothing();

      const recId = await createTestRecommendation({ learnerId: SEED_IDS.studentLiam });
      const res = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: {
          classId: '55555555-5555-5555-5555-555555555566',
          materialId: SEED_IDS.matUrbanFarming,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('not enrolled in class');
    });

    it('rejects assigning next activity on STALE recommendation with 400', async () => {
      const recId = await createTestRecommendation({ decisionStatus: 'STALE' });
      const res = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: {
          materialId: SEED_IDS.matUrbanFarming,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('STALE');
    });

    it('rejects assigning next activity on REJECT recommendation with 400', async () => {
      const recId = await createTestRecommendation({ decisionStatus: TeacherDecisionStatus.REJECT });
      const res = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: {
          materialId: SEED_IDS.matUrbanFarming,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('REJECT');
    });

    it('rejects assigning next activity when classId is omitted and learner has multiple classes taught by teacher with 400', async () => {
      // Create a second class for Teacher Taylor
      const CLASS_TAYLOR_2 = '55555555-5555-5555-5555-555555555566';
      await db.insert(schema.classes).values({
        id: CLASS_TAYLOR_2,
        courseId: SEED_IDS.courseIelts,
        name: 'Taylor Cohort 2',
        teacherId: SEED_IDS.teacherTaylor,
        level: 'B2',
      }).onConflictDoNothing();

      // Enroll TEST_STUDENT_ID in both SEED_IDS.classIeltsA and CLASS_TAYLOR_2
      await db.insert(schema.classEnrollments).values({
        id: '55555555-5555-5555-5555-555555555567',
        classId: CLASS_TAYLOR_2,
        learnerId: TEST_STUDENT_ID,
      }).onConflictDoNothing();

      const recId = await createTestRecommendation();

      // Call assign-next-activity with materialId but NO classId
      const res = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: {
          materialId: SEED_IDS.matUrbanFarming,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('multiple classes');
    });

    it('rejects a retry from the teacher of another class attended by the same learner', async () => {
      const recId = await createTestRecommendation();
      const payload = {
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matUrbanFarming,
        instructions: 'Read and take notes',
      };

      const first = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload,
      });
      expect(first.statusCode).toBe(200);

      // The learner is also in David's class B, but the activity belongs to Taylor's class A.
      const unauthorizedRetry = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload,
      });
      expect(unauthorizedRetry.statusCode).toBe(403);

      const authorizedRetry = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload,
      });
      expect(authorizedRetry.statusCode).toBe(200);
      expect(JSON.parse(authorizedRetry.body).decisionId).toBe(JSON.parse(first.body).decisionId);

      const decisions = await db.select().from(schema.teacherDecisions).where(eq(schema.teacherDecisions.recommendationId, recId));
      const audits = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, recId), eq(schema.auditEvents.action, 'NEXT_ACTIVITY_ASSIGNED')));
      expect(decisions).toHaveLength(1);
      expect(audits).toHaveLength(1);
    });

    it('enforces full retry payload consistency: rejects changed instructions, due date, class, material, or assessment, and keeps DB counts intact', async () => {
      const recId = await createTestRecommendation();

      const initialDueAt = new Date(Date.now() + 86400000).toISOString();
      const basePayload = {
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matUrbanFarming,
        assessmentId: ASSESSMENT_CLASS_B_ID,
        instructions: 'Initial instructions for activity',
        dueAt: initialDueAt,
      };

      // 1. Initial assignment succeeds
      const initialRes = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: basePayload,
      });
      expect(initialRes.statusCode).toBe(200);
      const initialData = JSON.parse(initialRes.body);
      expect(initialData.success).toBe(true);

      // Verify initial row counts in DB
      const decisionsInitial = await db.select().from(schema.teacherDecisions).where(eq(schema.teacherDecisions.recommendationId, recId));
      const auditsInitial = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, recId), eq(schema.auditEvents.action, 'NEXT_ACTIVITY_ASSIGNED')));
      const assignmentsInitial = await db.select().from(schema.assignments).where(eq(schema.assignments.id, initialData.assignmentId));
      expect(decisionsInitial.length).toBe(1);
      expect(auditsInitial.length).toBe(1);
      expect(assignmentsInitial.length).toBe(1);

      // 2. Reject retry with changed instructions
      const resDiffInstr = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: { ...basePayload, instructions: 'Changed instructions' },
      });
      expect(resDiffInstr.statusCode).toBe(400);
      expect(JSON.parse(resDiffInstr.body).message).toContain('instructions mismatch');

      // 3. Reject retry with changed due date
      const resDiffDue = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: { ...basePayload, dueAt: new Date(Date.now() + 172800000).toISOString() },
      });
      expect(resDiffDue.statusCode).toBe(400);
      expect(JSON.parse(resDiffDue.body).message).toContain('dueAt mismatch');

      // 4. Reject retry with changed class
      const resDiffClass = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: { ...basePayload, classId: CLASS_IELTS_B_ID },
      });
      expect(resDiffClass.statusCode).toBe(400);

      // 5. Reject retry with changed material
      const resDiffMat = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: { ...basePayload, materialId: '33333333-3333-3333-3333-333333333302' },
      });
      expect(resDiffMat.statusCode).toBe(400);
      expect(JSON.parse(resDiffMat.body).message).toContain('materialId mismatch');

      // 6. Reject retry with changed assessment
      const resDiffAss = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: { ...basePayload, assessmentId: SEED_IDS.assessmentReading03 },
      });
      expect(resDiffAss.statusCode).toBe(400);
      expect(JSON.parse(resDiffAss.body).message).toContain('assessmentId mismatch');

      // 7. Identical retry succeeds with exact same data
      const identicalRes = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload: basePayload,
      });
      expect(identicalRes.statusCode).toBe(200);
      const identicalData = JSON.parse(identicalRes.body);
      expect(identicalData.success).toBe(true);
      expect(identicalData.decisionId).toBe(initialData.decisionId);
      expect(identicalData.assignmentId).toBe(initialData.assignmentId);
      expect(identicalData.materialId).toBe(initialData.materialId);

      // Verify row counts unchanged
      const decisionsFinal = await db.select().from(schema.teacherDecisions).where(eq(schema.teacherDecisions.recommendationId, recId));
      const auditsFinal = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, recId), eq(schema.auditEvents.action, 'NEXT_ACTIVITY_ASSIGNED')));
      const assignmentsFinal = await db.select().from(schema.assignments).where(eq(schema.assignments.id, initialData.assignmentId));
      expect(decisionsFinal.length).toBe(1);
      expect(auditsFinal.length).toBe(1);
      expect(assignmentsFinal.length).toBe(1);
    });

    it('verifies sequential retries return consistent result and do not create duplicate DB rows', async () => {
      const recId = await createTestRecommendation();

      const payload = {
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matUrbanFarming,
        instructions: 'Consistent instructions',
      };

      // First call
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload,
      });
      expect(res1.statusCode).toBe(200);
      const data1 = JSON.parse(res1.body);

      // Count DB records
      const decisionsBefore = await db.select().from(schema.teacherDecisions).where(eq(schema.teacherDecisions.recommendationId, recId));
      const auditsBefore = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, recId), eq(schema.auditEvents.action, 'NEXT_ACTIVITY_ASSIGNED')));
      expect(decisionsBefore.length).toBe(1);
      expect(auditsBefore.length).toBe(1);

      // Second identical call
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/recommendations/${recId}/assign-next-activity`,
        headers: { authorization: `Bearer ${teacherTaylorToken}` },
        payload,
      });
      expect(res2.statusCode).toBe(200);
      const data2 = JSON.parse(res2.body);
      expect(data2.decisionId).toBe(data1.decisionId);
      expect(data2.materialId).toBe(data1.materialId);

      // Verify no extra DB records were created
      const decisionsAfter = await db.select().from(schema.teacherDecisions).where(eq(schema.teacherDecisions.recommendationId, recId));
      const auditsAfter = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, recId), eq(schema.auditEvents.action, 'NEXT_ACTIVITY_ASSIGNED')));
      expect(decisionsAfter.length).toBe(1);
      expect(auditsAfter.length).toBe(1);
    });

    it('handles concurrent retries transitioning only once with row locking', async () => {
      const concurrentRecId = await createTestRecommendation();

      const payload = {
        classId: SEED_IDS.classIeltsA,
        materialId: SEED_IDS.matUrbanFarming,
        instructions: 'Concurrent assignment',
      };

      // Launch 5 concurrent requests simultaneously
      const results = await Promise.all([
        app.inject({ method: 'POST', url: `/api/recommendations/${concurrentRecId}/assign-next-activity`, headers: { authorization: `Bearer ${teacherTaylorToken}` }, payload }),
        app.inject({ method: 'POST', url: `/api/recommendations/${concurrentRecId}/assign-next-activity`, headers: { authorization: `Bearer ${teacherTaylorToken}` }, payload }),
        app.inject({ method: 'POST', url: `/api/recommendations/${concurrentRecId}/assign-next-activity`, headers: { authorization: `Bearer ${teacherTaylorToken}` }, payload }),
        app.inject({ method: 'POST', url: `/api/recommendations/${concurrentRecId}/assign-next-activity`, headers: { authorization: `Bearer ${teacherTaylorToken}` }, payload }),
        app.inject({ method: 'POST', url: `/api/recommendations/${concurrentRecId}/assign-next-activity`, headers: { authorization: `Bearer ${teacherTaylorToken}` }, payload }),
      ]);

      // All 5 must succeed (200)
      for (const res of results) {
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.success).toBe(true);
        expect(body.recommendationId).toBe(concurrentRecId);
      }

      // Verify that exactly 1 teacher decision and 1 audit event were written to PostgreSQL
      const decisions = await db.select().from(schema.teacherDecisions).where(eq(schema.teacherDecisions.recommendationId, concurrentRecId));
      const audits = await db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.entityId, concurrentRecId), eq(schema.auditEvents.action, 'NEXT_ACTIVITY_ASSIGNED')));
      expect(decisions.length).toBe(1);
      expect(audits.length).toBe(1);
    });
  });

  // ==========================================
  // ITEM 3: Protect Submission and Grading Integrity
  // ==========================================
  describe('3. Submission & Grading Integrity', () => {
    it('rejects evaluate on a submission that is not SUBMITTED (e.g. STARTED) with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${draftSubId}/evaluate`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          responses: [
            {
              questionId: SEED_IDS.qMainIdeaUrbanFarming,
              rawScore: 8,
              maxScore: 10,
            },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('not been submitted');
    });

    it('rejects duplicate question IDs in submit answers with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${draftSubId}/submit`,
        headers: { authorization: `Bearer ${studentEmmaToken}` },
        payload: {
          submissionId: draftSubId,
          answers: [
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, responsePayload: 'B' },
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, responsePayload: 'B' },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Duplicate questionId');
    });

    it('rejects duplicate question IDs in evaluate responses with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/evaluate`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          responses: [
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, rawScore: 5, maxScore: 10 },
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, rawScore: 5, maxScore: 10 },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Duplicate questionId');
    });

    it('rejects rawScore > maxScore in evaluate with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/evaluate`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          responses: [
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, rawScore: 15, maxScore: 10 },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('between 0 and maxScore');
    });

    it('rejects rawScore < 0 in evaluate with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/evaluate`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          responses: [
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, rawScore: -5, maxScore: 10 },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects empty responses array in evaluate with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/evaluate`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          responses: [],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('responses cannot be empty');
    });

    it('rejects incomplete evaluation missing required questions with 400', async () => {
      // ASSESSMENT_CLASS_B_ID has 2 questions: qMainIdeaUrbanFarming and SPEAKING_Q_ID
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/evaluate`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          responses: [
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, rawScore: 8, maxScore: 10 },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('responses for all assessment items');
    });

    it('rejects incorrect maxScore not matching assessment item points with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/evaluate`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          responses: [
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, rawScore: 8, maxScore: 50 }, // points is 10, not 50
            { questionId: SPEAKING_Q_ID, rawScore: 8, maxScore: 10 },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Invalid maxScore');
    });

    it('accepts valid complete evaluation and computes overallScore within 0-100', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${SUBMISSION_CLASS_B_ID}/evaluate`,
        headers: { authorization: `Bearer ${teacherDavidToken}` },
        payload: {
          responses: [
            { questionId: SEED_IDS.qMainIdeaUrbanFarming, rawScore: 8, maxScore: 10, teacherFeedback: 'Well reasoned' },
            { questionId: SPEAKING_Q_ID, rawScore: 7, maxScore: 10, teacherFeedback: 'Good fluency' },
          ],
          overallTeacherFeedback: 'Solid performance',
        },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.status).toBe(SubmissionStatus.EVALUATED);
      expect(data.overallScore).toBe(75); // (8 + 7) / (10 + 10) = 15/20 = 75%
      expect(data.overallScore).toBeGreaterThanOrEqual(0);
      expect(data.overallScore).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================
  // ITEM 4: Safe and Consistent Uploads
  // ==========================================
  describe('4. Safe & Consistent Uploads', () => {
    it('rejects audio upload on non-SPEAKING question with 400', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="questionId"',
        '',
        SEED_IDS.qMainIdeaUrbanFarming,
        `--${boundary}`,
        'Content-Disposition: form-data; name="audio"; filename="recording.webm"',
        'Content-Type: audio/webm',
        '',
        'fake audio buffer content',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${draftSubId}/audio`,
        headers: {
          authorization: `Bearer ${studentEmmaToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('SPEAKING');
    });

    it('rejects audio upload with invalid MIME type with 400', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="questionId"',
        '',
        SPEAKING_Q_ID,
        `--${boundary}`,
        'Content-Disposition: form-data; name="audio"; filename="evil.exe"',
        'Content-Type: application/x-msdownload',
        '',
        'fake malicious payload',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/submissions/${draftSubId}/audio`,
        headers: {
          authorization: `Bearer ${studentEmmaToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Invalid audio file type');
    });

    it('rejects material upload with invalid file MIME type with 400', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="malware.exe"',
        'Content-Type: application/x-msdownload',
        '',
        'executable binary',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/materials/${SEED_IDS.matUrbanFarming}/files`,
        headers: {
          authorization: `Bearer ${teacherTaylorToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Unsupported file type');
    });

    it('storage failure injection: leaves no metadata in database when object storage fails', async () => {
      const putSpy = vi.spyOn(storage, 'putObject').mockRejectedValueOnce(new Error('Storage service connection timeout'));

      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="fail_storage.pdf"',
        'Content-Type: application/pdf',
        '',
        'PDF content here',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/materials/${SEED_IDS.matUrbanFarming}/files`,
        headers: {
          authorization: `Bearer ${teacherTaylorToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(500);

      // Verify no material file was inserted in DB
      const files = await db.select().from(schema.materialFiles).where(eq(schema.materialFiles.fileName, 'fail_storage.pdf'));
      expect(files.length).toBe(0);

      putSpy.mockRestore();
    });

    it('DB/audit failure injection: cleans up uploaded object from storage when DB transaction fails', async () => {
      const deleteSpy = vi.spyOn(storage, 'deleteObject');
      const txSpy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('PostgreSQL transaction aborted'));

      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="file"; filename="cleanup_test.pdf"',
        'Content-Type: application/pdf',
        '',
        'PDF to be cleaned up',
        `--${boundary}--`,
      ].join('\r\n');

      const res = await app.inject({
        method: 'POST',
        url: `/api/materials/${SEED_IDS.matUrbanFarming}/files`,
        headers: {
          authorization: `Bearer ${teacherTaylorToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(500);

      // Verify storage deleteObject was called to clean up the uploaded file
      expect(deleteSpy).toHaveBeenCalled();
      const deletedKey = deleteSpy.mock.calls[0][0];
      expect(deletedKey).toContain('cleanup_test.pdf');

      // Verify no dangling record in DB
      const files = await db.select().from(schema.materialFiles).where(eq(schema.materialFiles.fileName, 'cleanup_test.pdf'));
      expect(files.length).toBe(0);

      txSpy.mockRestore();
      deleteSpy.mockRestore();
    });

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 52,428,800 bytes

    it('uploads file immediately below effective maximum (50MB - 1KB) with 201', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const filename = `below_max_${Date.now()}.pdf`;
      const fileBytes = MAX_FILE_SIZE - 1024; // 52,427,776 bytes
      const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`
      );
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const fileContent = Buffer.alloc(fileBytes, 0x61);
      const payload = Buffer.concat([header, fileContent, footer]);

      const res = await app.inject({
        method: 'POST',
        url: `/api/materials/${SEED_IDS.matUrbanFarming}/files`,
        headers: {
          authorization: `Bearer ${teacherTaylorToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.fileSize).toBe(fileBytes);

      // Verify metadata was stored in DB
      const [dbFile] = await db.select().from(schema.materialFiles).where(eq(schema.materialFiles.id, body.id));
      expect(dbFile).toBeDefined();
      expect(dbFile.fileSize).toBe(fileBytes);

      // Clean up test file from DB and storage
      await db.delete(schema.materialFiles).where(eq(schema.materialFiles.id, body.id));
      await storage.deleteObject(dbFile.fileKey);
    });

    it('uploads file exactly at effective maximum (50MB) with 201', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const filename = `at_max_${Date.now()}.pdf`;
      const fileBytes = MAX_FILE_SIZE; // 52,428,800 bytes
      const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`
      );
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const fileContent = Buffer.alloc(fileBytes, 0x61);
      const payload = Buffer.concat([header, fileContent, footer]);

      const res = await app.inject({
        method: 'POST',
        url: `/api/materials/${SEED_IDS.matUrbanFarming}/files`,
        headers: {
          authorization: `Bearer ${teacherTaylorToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.fileSize).toBe(fileBytes);

      // Verify metadata was stored in DB
      const [dbFile] = await db.select().from(schema.materialFiles).where(eq(schema.materialFiles.id, body.id));
      expect(dbFile).toBeDefined();
      expect(dbFile.fileSize).toBe(fileBytes);

      // Clean up test file from DB and storage
      await db.delete(schema.materialFiles).where(eq(schema.materialFiles.id, body.id));
      await storage.deleteObject(dbFile.fileKey);
    });

    it('rejects file immediately above effective maximum (50MB + 1KB) with 400 without leaving DB or storage metadata', async () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const filename = `above_max_${Date.now()}.pdf`;
      const fileBytes = MAX_FILE_SIZE + 1024; // 52,429,824 bytes
      const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`
      );
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const fileContent = Buffer.alloc(fileBytes, 0x61);
      const payload = Buffer.concat([header, fileContent, footer]);

      const res = await app.inject({
        method: 'POST',
        url: `/api/materials/${SEED_IDS.matUrbanFarming}/files`,
        headers: {
          authorization: `Bearer ${teacherTaylorToken}`,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect([400, 413]).toContain(res.statusCode);

      // Confirm rejected files leave no database metadata
      const dbFiles = await db.select().from(schema.materialFiles).where(eq(schema.materialFiles.fileName, filename));
      expect(dbFiles.length).toBe(0);

      // Confirm no audit event created for rejected upload
      const audits = await db.select().from(schema.auditEvents).where(
        and(
          eq(schema.auditEvents.action, 'MATERIAL_FILE_UPLOADED'),
          eq(schema.auditEvents.entityType, 'MATERIAL_FILE')
        )
      );
      const matchingAudit = audits.find((a) => (a.metadata as any)?.fileName === filename);
      expect(matchingAudit).toBeUndefined();
    });
  });

  // ==========================================
  // ITEM 5: Account Behavior & Session Invalidation
  // ==========================================
  describe('5. Session Invalidation & Student Shielding', () => {
    it('invalidates existing tokens when admin resets user password', async () => {
      const testRes1 = await app.inject({
        method: 'GET',
        url: '/api/identity/me',
        headers: { authorization: `Bearer ${studentLiamToken}` },
      });
      expect(testRes1.statusCode).toBe(200);

      const resetRes = await app.inject({
        method: 'POST',
        url: `/api/identity/users/${SEED_IDS.studentLiam}/reset-password`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          newPassword: 'BrandNewPassword456!',
        },
      });
      expect(resetRes.statusCode).toBe(200);

      const testRes2 = await app.inject({
        method: 'GET',
        url: '/api/identity/me',
        headers: { authorization: `Bearer ${studentLiamToken}` },
      });
      expect(testRes2.statusCode).toBe(401);
      expect(JSON.parse(testRes2.body).message).toContain('invalidated');

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/identity/login',
        payload: {
          email: 'liam.chen@student.acorn.edu',
          password: 'BrandNewPassword456!',
        },
      });
      expect(loginRes.statusCode).toBe(200);
    });

    it('ensures students never see pending, stale, or rejected recommendations', async () => {
      const SHIELD_STUDENT_ID = '99999999-0000-0000-0000-000000000088';
      await db.insert(schema.users).values({
        id: SHIELD_STUDENT_ID,
        email: 'shield.student@acorn.edu',
        passwordHash: hashPassword('password123'),
        name: 'Shield Student',
        role: UserRole.STUDENT,
        isActive: true,
        tokenVersion: 1,
      }).onConflictDoNothing();

      const shieldToken = generateToken({
        id: SHIELD_STUDENT_ID,
        email: 'shield.student@acorn.edu',
        name: 'Shield Student',
        role: UserRole.STUDENT,
        tokenVersion: 1,
      });

      const pendingRecId = '66666666-aaaa-bbbb-cccc-111111111111';
      await db.insert(schema.recommendations).values({
        id: pendingRecId,
        learnerId: SHIELD_STUDENT_ID,
        targetSkillId: SEED_IDS.skillReading,
        targetLevel: 'B1',
        priority: 'HIGH',
        decisionStatus: 'PENDING',
        recommendedActionText: 'Pending recommendation',
        rationale: ['Student needs practice'],
        evidenceBasisCount: 1,
        learnerConfidence: 'HIGH',
      }).onConflictDoUpdate({
        target: schema.recommendations.id,
        set: { decisionStatus: 'PENDING' },
      });

      const res1 = await app.inject({
        method: 'GET',
        url: `/api/recommendations/learner/${SHIELD_STUDENT_ID}`,
        headers: { authorization: `Bearer ${shieldToken}` },
      });
      expect(res1.statusCode).toBe(200);
      expect(JSON.parse(res1.body)).toBeNull();

      await db.update(schema.recommendations).set({ decisionStatus: TeacherDecisionStatus.REJECT }).where(eq(schema.recommendations.id, pendingRecId));
      const res2 = await app.inject({
        method: 'GET',
        url: `/api/recommendations/learner/${SHIELD_STUDENT_ID}`,
        headers: { authorization: `Bearer ${shieldToken}` },
      });
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res2.body)).toBeNull();

      await db.update(schema.recommendations).set({ decisionStatus: TeacherDecisionStatus.ACCEPT }).where(eq(schema.recommendations.id, pendingRecId));
      const res3 = await app.inject({
        method: 'GET',
        url: `/api/recommendations/learner/${SHIELD_STUDENT_ID}`,
        headers: { authorization: `Bearer ${shieldToken}` },
      });
      expect(res3.statusCode).toBe(200);
      const data3 = JSON.parse(res3.body);
      expect(data3).not.toBeNull();
      expect(data3.decisionStatus).toBe('ACCEPT');
    });

    it('returns averageTeacherPrepMinutes as null when no prep duration data is recorded', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/audit/metrics',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.averageTeacherPrepMinutes).toBeNull();
      expect(body.prepDurationSampleCount).toBe(0);
    });
  });
});
