import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';

describe('Canonical Loop Integration Test', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    db.reset();
    app = buildApp();
  });

  it('runs complete canonical loop: Material -> Assessment -> Assignment -> Submission -> Evaluation -> Evidence -> Learner State -> Recommendation -> Teacher Decision', async () => {
    // 1. Health check
    const healthRes = await app.inject({ method: 'GET', url: '/health' });
    expect(healthRes.statusCode).toBe(200);

    // 2. Query Material Library
    const matsRes = await app.inject({
      method: 'GET',
      url: '/api/materials',
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
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
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
    });
    expect(qRes.statusCode).toBe(200);
    const questions = JSON.parse(qRes.body);
    expect(questions.length).toBeGreaterThan(0);

    // 4. Create an Assessment
    const createAssessRes = await app.inject({
      method: 'POST',
      url: '/api/assessments',
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
      payload: {
        title: 'New IELTS Practice Quiz',
        description: 'Test assessment for integration test',
        level: 'B1',
        timeLimitMinutes: 15,
        questionIds: [questions[0].id, questions[1].id],
      },
    });
    expect(createAssessRes.statusCode).toBe(201);
    const assessment = JSON.parse(createAssessRes.body);
    expect(assessment.id).toBeDefined();

    // 5. Assign to class
    const assignRes = await app.inject({
      method: 'POST',
      url: `/api/assessments/${assessment.id}/assign`,
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
      payload: {
        classId: '55555555-5555-5555-5555-555555555555',
      },
    });
    expect(assignRes.statusCode).toBe(201);
    const assignment = JSON.parse(assignRes.body);

    // 6. Find submission for student Emma
    const subListRes = await app.inject({
      method: 'GET',
      url: '/api/submissions?learnerId=22222222-2222-2222-2222-222222222222',
      headers: { authorization: 'Bearer 22222222-2222-2222-2222-222222222222' },
    });
    expect(subListRes.statusCode).toBe(200);
    const subs = JSON.parse(subListRes.body);
    const emmaSub = subs.find((s: any) => s.assessmentId === assessment.id);
    expect(emmaSub).toBeDefined();

    // 7. Student autosaves an answer
    const autosaveRes = await app.inject({
      method: 'POST',
      url: `/api/submissions/${emmaSub.id}/autosave`,
      headers: { authorization: 'Bearer 22222222-2222-2222-2222-222222222222' },
      payload: {
        questionId: questions[0].id,
        responsePayload: 'B. It is a promising long-term approach',
      },
    });
    expect(autosaveRes.statusCode).toBe(200);

    // 8. Student submits the assessment
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/submissions/${emmaSub.id}/submit`,
      headers: { authorization: 'Bearer 22222222-2222-2222-2222-222222222222' },
      payload: {
        submissionId: emmaSub.id,
        answers: [
          { questionId: questions[0].id, responsePayload: 'B. It is a promising long-term approach' },
          { questionId: questions[1].id, responsePayload: 'B. The definition and key benefits of growing food in cities' },
        ],
      },
    });
    expect(submitRes.statusCode).toBe(200);
    const evaluatedSub = JSON.parse(submitRes.body);
    expect(evaluatedSub.status).toBe('EVALUATED');

    // 9. Verify that Learning Evidence was recorded
    const evidenceRes = await app.inject({
      method: 'GET',
      url: `/api/evidence?learnerId=22222222-2222-2222-2222-222222222222`,
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
    });
    expect(evidenceRes.statusCode).toBe(200);
    const evidenceList = JSON.parse(evidenceRes.body);
    expect(evidenceList.length).toBeGreaterThan(0);

    // 10. Verify Learner State
    const profileRes = await app.inject({
      method: 'GET',
      url: `/api/learners/22222222-2222-2222-2222-222222222222/profile`,
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
    });
    expect(profileRes.statusCode).toBe(200);
    const profile = JSON.parse(profileRes.body);
    expect(profile.overallProficiency).toBeGreaterThan(0);
    expect(profile.skills.length).toBeGreaterThan(0);

    // 11. Fetch structured recommendation (Reuse -> Adapt -> Generate)
    const recRes = await app.inject({
      method: 'GET',
      url: `/api/recommendations/learner/22222222-2222-2222-2222-222222222222`,
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
    });
    expect(recRes.statusCode).toBe(200);
    const rec = JSON.parse(recRes.body);
    expect(rec.candidates.length).toBe(3);
    expect(rec.candidates[0].action).toBe('REUSE');
    expect(rec.candidates[1].action).toBe('ADAPT');
    expect(rec.candidates[2].action).toBe('GENERATE');

    // 12. Teacher accepts recommendation
    const decisionRes = await app.inject({
      method: 'POST',
      url: `/api/recommendations/${rec.id}/decision`,
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
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

    // 13. Verify Audit Event logged
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/audit/events',
      headers: { authorization: 'Bearer 11111111-1111-1111-1111-111111111111' },
    });
    expect(auditRes.statusCode).toBe(200);
    const events = JSON.parse(auditRes.body);
    expect(events.some((e: any) => e.action === 'TEACHER_DECISION_RECORDED')).toBe(true);
  });
});
