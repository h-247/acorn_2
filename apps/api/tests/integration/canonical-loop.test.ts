import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

describe('Canonical Loop Integration Test', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let studentToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

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

  it('runs complete canonical loop: Material -> Assessment -> Assignment -> Submission -> Evaluation -> Evidence -> Learner State -> Recommendation -> Teacher Decision', async () => {
    // 1. Health check
    const healthRes = await app.inject({ method: 'GET', url: '/health' });
    expect(healthRes.statusCode).toBe(200);

    // 2. Query Material Library
    const matsRes = await app.inject({
      method: 'GET',
      url: '/api/materials',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(matsRes.statusCode).toBe(200);
    const materials = JSON.parse(matsRes.body);
    expect(materials.length).toBeGreaterThan(0);
    const urbanFarmingMat = materials.find((m: any) => m.title.includes('Urban Farming'));
    expect(urbanFarmingMat).toBeDefined();

    // 3. Question Bank check
    const qRes = await app.inject({
      method: 'GET',
      url: '/api/assessments/questions',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(qRes.statusCode).toBe(200);
    const questions = JSON.parse(qRes.body);
    expect(questions.length).toBeGreaterThan(0);

    const mcqs = questions.filter((q: any) => q.type === 'MCQ' && q.correctAnswer);
    expect(mcqs.length).toBeGreaterThanOrEqual(2);

    // 4. Create an Assessment Draft
    const createAssessRes = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        title: 'New IELTS Practice Checkpoint',
        description: 'Test assessment for integration test',
        level: 'B1',
        timeLimitMinutes: 15,
        questionIds: [mcqs[0].id, mcqs[1].id],
      },
    });
    expect(createAssessRes.statusCode).toBe(201);
    const assessment = JSON.parse(createAssessRes.body);
    expect(assessment.id).toBeDefined();

    // 5. Publish Assessment
    const publishRes = await app.inject({
      method: 'PUT',
      url: `/api/assessments/${assessment.id}/publish`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(publishRes.statusCode).toBe(200);

    // 6. Assign to class
    const assignRes = await app.inject({
      method: 'POST',
      url: `/api/assessments/${assessment.id}/assign`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        classId: '55555555-5555-5555-5555-555555555555',
      },
    });
    expect(assignRes.statusCode).toBe(201);

    // 7. Find submission for student Emma
    const subListRes = await app.inject({
      method: 'GET',
      url: '/api/submissions?learnerId=22222222-2222-2222-2222-222222222222',
      headers: { authorization: `Bearer ${studentToken}` },
    });
    expect(subListRes.statusCode).toBe(200);
    const subs = JSON.parse(subListRes.body);
    const emmaSub = subs.find((s: any) => s.assessmentId === assessment.id);
    expect(emmaSub).toBeDefined();

    // 8. Student autosaves an answer
    const autosaveRes = await app.inject({
      method: 'POST',
      url: `/api/submissions/${emmaSub.id}/autosave`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        questionId: mcqs[0].id,
        responsePayload: mcqs[0].correctAnswer,
      },
    });
    expect(autosaveRes.statusCode).toBe(200);

    // 9. Student submits the assessment
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/submissions/${emmaSub.id}/submit`,
      headers: { authorization: `Bearer ${studentToken}` },
      payload: {
        submissionId: emmaSub.id,
        answers: [
          { questionId: mcqs[0].id, responsePayload: mcqs[0].correctAnswer },
          { questionId: mcqs[1].id, responsePayload: mcqs[1].correctAnswer },
        ],
      },
    });
    expect(submitRes.statusCode).toBe(200);
    const evaluatedSub = JSON.parse(submitRes.body);
    expect(evaluatedSub.status).toBe('EVALUATED');

    // 10. Verify that Learning Evidence was recorded
    const evidenceRes = await app.inject({
      method: 'GET',
      url: `/api/evidence?learnerId=22222222-2222-2222-2222-222222222222`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(evidenceRes.statusCode).toBe(200);
    const evidenceList = JSON.parse(evidenceRes.body);
    expect(evidenceList.length).toBeGreaterThan(0);

    // 11. Verify Learner State
    const profileRes = await app.inject({
      method: 'GET',
      url: `/api/learners/22222222-2222-2222-2222-222222222222/profile`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(profileRes.statusCode).toBe(200);
    const profile = JSON.parse(profileRes.body);
    expect(profile.overallProficiency).toBeGreaterThan(0);
    expect(profile.skills.length).toBeGreaterThan(0);

    // 12. Fetch structured recommendation (Non-AI: REUSE / ADAPT / NO_MATCH)
    const recRes = await app.inject({
      method: 'GET',
      url: `/api/recommendations/learner/22222222-2222-2222-2222-222222222222`,
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(recRes.statusCode).toBe(200);
    const rec = JSON.parse(recRes.body);
    expect(rec.candidates.length).toBeGreaterThanOrEqual(1);
    expect(['REUSE', 'ADAPT', 'NO_MATCH']).toContain(rec.candidates[0].action);

    // 13. Teacher accepts recommendation
    const decisionRes = await app.inject({
      method: 'POST',
      url: `/api/recommendations/${rec.id}/decision`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        recommendationId: rec.id,
        decision: 'ACCEPT',
        teacherNotes: 'Approved for Emma during Thursday morning session.',
        selectedMaterialId: rec.candidates[0].materialId,
      },
    });
    expect(decisionRes.statusCode).toBe(200);
    const decision = JSON.parse(decisionRes.body);
    expect(decision.decision).toBe('ACCEPT');

    // 14. Verify Audit Event logged
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/audit/events',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const events = JSON.parse(auditRes.body);
    expect(events.some((e: any) => e.action === 'TEACHER_DECISION_RECORDED')).toBe(true);
  });
});
