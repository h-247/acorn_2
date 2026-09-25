import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';

describe('Rubric Validation and Score Totals', () => {
  let app: any;
  let adminToken: string;
  let teacherToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    adminToken = generateToken({ id: SEED_IDS.adminUser, email: 'admin@acorn.edu', role: 'ADMIN', name: 'Admin' });
    teacherToken = generateToken({ id: SEED_IDS.teacherTaylor, email: 'taylor@acorn.edu', role: 'TEACHER', name: 'Taylor' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject WRITING question without a rubric', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'WRITING',
        prompt: 'Write an essay',
        difficulty: 'MEDIUM',
        level: 'B2',
        skills: [{ skillId: SEED_IDS.skillWriting, role: 'PRIMARY' }],
      }
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/Invalid request payload/);
  });

  it('should reject SPEAKING question without a rubric', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'SPEAKING',
        prompt: 'Speak a lot',
        difficulty: 'MEDIUM',
        level: 'B2',
        skills: [{ skillId: SEED_IDS.skillSpeaking, role: 'PRIMARY' }],
      }
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/Invalid request payload/);
  });

  it('should reject empty criterion text', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'WRITING',
        prompt: 'Write an essay',
        difficulty: 'MEDIUM',
        level: 'B2',
        skills: [{ skillId: SEED_IDS.skillWriting, role: 'PRIMARY' }],
        rubric: [{ criteria: '', maxScore: 5 }]
      }
    });
    expect(res.statusCode).toBe(400);
  });

  it('should reject zero, negative, null, and infinite maxScore', async () => {
    const invalidScores = [0, -5, null, Infinity];
    for (const score of invalidScores) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/assessments/questions',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          type: 'WRITING',
          prompt: 'Write an essay',
          difficulty: 'MEDIUM',
          level: 'B2',
          skills: [{ skillId: SEED_IDS.skillWriting, role: 'PRIMARY' }],
          rubric: [{ criteria: 'Score', maxScore: score }]
        }
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('should accept valid WRITING rubric and sum scores in assessment item', async () => {
    // 1. Create a question
    const qRes = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'WRITING',
        prompt: 'Valid essay prompt',
        difficulty: 'MEDIUM',
        level: 'B2',
        skills: [{ skillId: SEED_IDS.skillWriting, role: 'PRIMARY' }],
        rubric: [
          { criteria: 'Grammar', maxScore: 5 },
          { criteria: 'Vocab', maxScore: 10 },
        ]
      }
    });
    expect(qRes.statusCode).toBe(201);
    const qId = qRes.json().id;

    // 2. Add to an assessment
    const aRes = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Rubric Total Test',
        level: 'B2',
        questionIds: [qId],
      }
    });
    expect(aRes.statusCode).toBe(201);
    const aId = aRes.json().id;

    // 3. Fetch assessment to verify points = 15 (5 + 10)
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/assessments/${aId}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(getRes.statusCode).toBe(200);
    const item = getRes.json().items[0];
    expect(item.points).toBe(15);
  });

  it('should accept valid SPEAKING rubric and sum scores in assessment item', async () => {
    // 1. Create a question
    const qRes = await app.inject({
      method: 'POST',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        type: 'SPEAKING',
        prompt: 'Valid speaking prompt',
        difficulty: 'MEDIUM',
        level: 'B2',
        skills: [{ skillId: SEED_IDS.skillSpeaking, role: 'PRIMARY' }],
        rubric: [
          { criteria: 'Fluency', maxScore: 6 },
          { criteria: 'Pronunciation', maxScore: 8 },
        ]
      }
    });
    expect(qRes.statusCode).toBe(201);
    const qId = qRes.json().id;

    // 2. Add to an assessment
    const aRes = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Rubric Total Test Speaking',
        level: 'B2',
        questionIds: [qId],
      }
    });
    expect(aRes.statusCode).toBe(201);
    const aId = aRes.json().id;

    // 3. Fetch assessment to verify points = 14 (6 + 8)
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/assessments/${aId}`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(getRes.statusCode).toBe(200);
    const item = getRes.json().items[0];
    expect(item.points).toBe(14);
  });

});
