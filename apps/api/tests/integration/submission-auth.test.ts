import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { resetDatabase } from '../../src/infrastructure/persistence/reset-db.js';
import { SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';

describe('Submission Mutation Authorization', () => {
  let app: ReturnType<typeof buildApp>;

  const TEACHER_DAVID_ID = '11111111-1111-1111-1111-111111111112';

  let adminToken: string;
  let teacherTaylorToken: string;
  let teacherDavidToken: string;
  let studentEmmaToken: string;
  let studentLiamToken: string;

  beforeAll(async () => {
    await resetDatabase();

    // Create David
    await db.insert(schema.users).values({
      id: TEACHER_DAVID_ID,
      email: 'david@acorn.edu',
      name: 'Mr. David',
      passwordHash: 'dev_password_hash',
      role: 'TEACHER',
      isActive: true,
    }).onConflictDoNothing();

    app = buildApp();
    await app.ready();

    adminToken = generateToken({ id: SEED_IDS.adminUser, email: 'admin@acorn.edu', role: 'ADMIN', name: 'Admin' });
    teacherTaylorToken = generateToken({ id: SEED_IDS.teacherTaylor, email: 'taylor@acorn.edu', role: 'TEACHER', name: 'Taylor' });
    teacherDavidToken = generateToken({ id: TEACHER_DAVID_ID, email: 'david@acorn.edu', role: 'TEACHER', name: 'David' });
    studentEmmaToken = generateToken({ id: SEED_IDS.studentEmma, email: 'emma@acorn.edu', role: 'STUDENT', name: 'Emma' });
    studentLiamToken = generateToken({ id: SEED_IDS.studentLiam, email: 'liam@acorn.edu', role: 'STUDENT', name: 'Liam' });
  });

  afterAll(async () => {
    await app.close();
  });

  const getTargetSubmissionId = () => SEED_IDS.submissionEmmaReading;
  
  const testCases = [
    { endpoint: 'autosave', payload: { responses: [] }, method: 'POST' },
    { endpoint: 'submit', payload: { responses: [] }, method: 'POST' },
    { endpoint: 'audio', payload: {}, method: 'POST' }
  ];

  for (const { endpoint, payload, method } of testCases) {
    describe(`${method} /:id/${endpoint}`, () => {
      it('should allow owner student', async () => {
        const res = await app.inject({
          method: method as any,
          url: `/api/submissions/${getTargetSubmissionId()}/${endpoint}`,
          headers: { authorization: `Bearer ${studentEmmaToken}` },
          payload
        });
        expect(res.statusCode).not.toBe(403);
      });

      it('should reject another student', async () => {
        const res = await app.inject({
          method: method as any,
          url: `/api/submissions/${getTargetSubmissionId()}/${endpoint}`,
          headers: { authorization: `Bearer ${studentLiamToken}` },
          payload
        });
        expect(res.statusCode).toBe(403);
      });

      it('should reject same-class teacher', async () => {
        const res = await app.inject({
          method: method as any,
          url: `/api/submissions/${getTargetSubmissionId()}/${endpoint}`,
          headers: { authorization: `Bearer ${teacherTaylorToken}` },
          payload
        });
        expect(res.statusCode).toBe(403);
      });

      it('should reject outside-class teacher', async () => {
        const res = await app.inject({
          method: method as any,
          url: `/api/submissions/${getTargetSubmissionId()}/${endpoint}`,
          headers: { authorization: `Bearer ${teacherDavidToken}` },
          payload
        });
        expect(res.statusCode).toBe(403);
      });

      it('should reject admin', async () => {
        const res = await app.inject({
          method: method as any,
          url: `/api/submissions/${getTargetSubmissionId()}/${endpoint}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload
        });
        expect(res.statusCode).toBe(403);
      });
    });
  }
});
