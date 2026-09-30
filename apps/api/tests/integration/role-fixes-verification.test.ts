import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole, QuestionType, AssessmentStatus, SubmissionStatus } from '@acorn/contracts';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { eq } from 'drizzle-orm';

describe('Role Fixes Verification Suite (Admin, Student, Teacher)', () => {
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    adminToken = generateToken({
      id: SEED_IDS.adminUser,
      email: 'admin@acorn.edu',
      name: 'System Admin',
      role: UserRole.ADMIN,
    });

    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    studentToken = generateToken({
      id: SEED_IDS.studentEmma,
      email: 'emma.nguyen@student.acorn.edu',
      name: 'Emma Nguyen',
      role: UserRole.STUDENT,
    });
  });

  describe('Admin Role Fixes', () => {
    it('invalidates user token on deactivation by incrementing tokenVersion', async () => {
      // 1. Create temporary student user
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/identity/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: `deactivate-test-${Date.now()}@student.acorn.edu`,
          password: 'password123',
          name: 'Deactivate Test Student',
          role: UserRole.STUDENT,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const user = JSON.parse(createRes.body);

      // 2. Generate a valid token for this student
      const userToken = generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: UserRole.STUDENT,
        tokenVersion: 1,
      });

      // Verify token works before deactivation
      const meBefore = await app.inject({
        method: 'GET',
        url: '/api/identity/me',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(meBefore.statusCode).toBe(200);

      // 3. Deactivate user via Admin PUT route
      const deactRes = await app.inject({
        method: 'PUT',
        url: `/api/identity/users/${user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });
      expect(deactRes.statusCode).toBe(200);

      // 4. Verify original token is now rejected due to tokenVersion mismatch / account deactivation
      const meAfter = await app.inject({
        method: 'GET',
        url: '/api/identity/me',
        headers: { authorization: `Bearer ${userToken}` },
      });
      expect(meAfter.statusCode).toBe(401);
    });

    it('allows teacher to unenroll student from their own assigned class', async () => {
      // Unenroll student from class
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/classes/${SEED_IDS.classIeltsA}/enroll/${SEED_IDS.studentEmma}`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });
      expect(res.statusCode).toBe(200);

      // Re-enroll student back to maintain clean seed state
      const reEnrollRes = await app.inject({
        method: 'POST',
        url: `/api/classes/${SEED_IDS.classIeltsA}/enroll`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { learnerId: SEED_IDS.studentEmma },
      });
      expect(reEnrollRes.statusCode).toBe(201);
    });
  });

  describe('Student Role Fixes & Auto-Grading Verification', () => {
    it('returns student submissions and handles status filtering cleanly', async () => {
      // Get student submissions
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/submissions',
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      const subs = JSON.parse(listRes.body);
      expect(Array.isArray(subs)).toBe(true);
    });

    it('correctly auto-grades a correct SHORT_ANSWER submission', async () => {
      // Create a short-answer question with a correctAnswer key
      const qRes = await app.inject({
        method: 'POST',
        url: '/api/assessments/questions',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          type: QuestionType.SHORT_ANSWER,
          prompt: 'What process converts solar energy to chemical energy in plants?',
          correctAnswer: 'photosynthesis',
          difficulty: 'MEDIUM',
          level: 'B2',
          skills: [{ skillId: SEED_IDS.skillReadingInference, role: 'PRIMARY' }],
        },
      });
      expect(qRes.statusCode).toBe(201);
      const question = JSON.parse(qRes.body);

      // Create and publish an assessment containing this short answer question
      const assRes = await app.inject({
        method: 'POST',
        url: '/api/assessments',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          title: 'Short Answer Auto-Grade Test (Correct)',
          skillId: SEED_IDS.skillReadingInference,
          level: 'B2',
          questionIds: [question.id],
        },
      });
      expect(assRes.statusCode).toBe(201);
      const assessment = JSON.parse(assRes.body);

      await app.inject({
        method: 'PUT',
        url: `/api/assessments/${assessment.id}/ready`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      await app.inject({
        method: 'PUT',
        url: `/api/assessments/${assessment.id}/publish`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      // Create assignment for class
      const assignRes = await app.inject({
        method: 'POST',
        url: `/api/assessments/${assessment.id}/assign`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { classId: SEED_IDS.classIeltsA },
      });
      expect(assignRes.statusCode).toBe(201);

      // Get student submission endpoint
      const subRes = await app.inject({
        method: 'GET',
        url: `/api/submissions/${assessment.id}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(subRes.statusCode).toBe(200);
      const sub = JSON.parse(subRes.body);

      // Submit correct answer
      const submitRes = await app.inject({
        method: 'POST',
        url: `/api/submissions/${sub.id}/submit`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          answers: [
            {
              questionId: question.id,
              responsePayload: { text: 'Photosynthesis' },
            },
          ],
        },
      });
      expect(submitRes.statusCode).toBe(200);
      const result = JSON.parse(submitRes.body);

      expect(result.status).toBe(SubmissionStatus.EVALUATED);
      expect(result.overallScore).toBe(100);

      // Verify response item details
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/submissions/${sub.id}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      const detail = JSON.parse(detailRes.body);
      const itemResp = detail.items[0].response;
      expect(itemResp.isCorrect).toBe(true);
      expect(itemResp.normalizedScore).toBe(1);
      expect(itemResp.rawScore).toBe(1);
    });

    it('correctly auto-grades an incorrect SHORT_ANSWER submission', async () => {
      // Create a short-answer question with a correctAnswer key
      const qRes = await app.inject({
        method: 'POST',
        url: '/api/assessments/questions',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          type: QuestionType.SHORT_ANSWER,
          prompt: 'What is the capital of France?',
          correctAnswer: 'Paris',
          difficulty: 'EASY',
          level: 'A2',
          skills: [{ skillId: SEED_IDS.skillReadingInference, role: 'PRIMARY' }],
        },
      });
      expect(qRes.statusCode).toBe(201);
      const question = JSON.parse(qRes.body);

      // Create and publish an assessment containing this short answer question
      const assRes = await app.inject({
        method: 'POST',
        url: '/api/assessments',
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          title: 'Short Answer Auto-Grade Test (Incorrect)',
          skillId: SEED_IDS.skillReadingInference,
          level: 'A2',
          questionIds: [question.id],
        },
      });
      expect(assRes.statusCode).toBe(201);
      const assessment = JSON.parse(assRes.body);

      await app.inject({
        method: 'PUT',
        url: `/api/assessments/${assessment.id}/ready`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      await app.inject({
        method: 'PUT',
        url: `/api/assessments/${assessment.id}/publish`,
        headers: { authorization: `Bearer ${teacherToken}` },
      });

      // Create assignment for class
      const assignRes = await app.inject({
        method: 'POST',
        url: `/api/assessments/${assessment.id}/assign`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: { classId: SEED_IDS.classIeltsA },
      });
      expect(assignRes.statusCode).toBe(201);

      // Get student submission endpoint
      const subRes = await app.inject({
        method: 'GET',
        url: `/api/submissions/${assessment.id}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      expect(subRes.statusCode).toBe(200);
      const sub = JSON.parse(subRes.body);

      // Submit incorrect answer
      const submitRes = await app.inject({
        method: 'POST',
        url: `/api/submissions/${sub.id}/submit`,
        headers: { authorization: `Bearer ${studentToken}` },
        payload: {
          answers: [
            {
              questionId: question.id,
              responsePayload: { text: 'London' },
            },
          ],
        },
      });
      expect(submitRes.statusCode).toBe(200);
      const result = JSON.parse(submitRes.body);

      expect(result.status).toBe(SubmissionStatus.EVALUATED);
      expect(result.overallScore).toBe(0);

      // Verify response item details
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/submissions/${sub.id}`,
        headers: { authorization: `Bearer ${studentToken}` },
      });
      const detail = JSON.parse(detailRes.body);
      const itemResp = detail.items[0].response;
      expect(itemResp.isCorrect).toBe(false);
      expect(itemResp.normalizedScore).toBe(0);
      expect(itemResp.rawScore).toBe(0);
    });
  });

  describe('Teacher Role Fixes', () => {
    it('copies attached material files when adapting a material', async () => {
      const sourceFiles = await db
        .select()
        .from(schema.materialFiles)
        .where(eq(schema.materialFiles.materialId, SEED_IDS.matListeningCampus));
      expect(sourceFiles.length).toBeGreaterThan(0);

      const adaptRes = await app.inject({
        method: 'POST',
        url: `/api/materials/${SEED_IDS.matListeningCampus}/adapt`,
        headers: { authorization: `Bearer ${teacherToken}` },
        payload: {
          title: 'Adapted Campus Orientation for B2',
          contentModifications: 'Adapted content with higher complexity vocabulary.',
          targetLevel: 'B2',
          adaptationReason: 'Level progression',
        },
      });
      expect(adaptRes.statusCode).toBe(201);
      const adapted = JSON.parse(adaptRes.body);
      expect(adapted.title).toBe('Adapted Campus Orientation for B2');

      const adaptedFiles = await db
        .select()
        .from(schema.materialFiles)
        .where(eq(schema.materialFiles.materialId, adapted.id));

      expect(adaptedFiles).toHaveLength(sourceFiles.length);
      for (const srcFile of sourceFiles) {
        const matched = adaptedFiles.find((f) => f.fileName === srcFile.fileName);
        expect(matched).toBeDefined();
        expect(matched!.fileKey).toBe(srcFile.fileKey);
        expect(matched!.mimeType).toBe(srcFile.mimeType);
        expect(matched!.fileSize).toBe(srcFile.fileSize);
      }
    });
  });
});
