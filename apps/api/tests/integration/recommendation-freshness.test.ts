import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { db } from '../../src/infrastructure/persistence/db.js';
import * as schema from '../../src/infrastructure/persistence/schema.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';

describe('Recommendation Freshness and Evidence Grounding', () => {
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    adminToken = generateToken({ id: SEED_IDS.adminUser, email: 'admin@acorn.edu', role: 'ADMIN', name: 'Admin' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should mark recommendation stale on evidence change and generate fresh one', async () => {
    // 1. Get initial recommendation for studentEmma
    const getRecRes = await app.inject({
      method: 'GET',
      url: `/api/recommendations/learner/${SEED_IDS.studentEmma}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRecRes.statusCode).toBe(200);
    const initialRec = getRecRes.json();
    expect(initialRec).not.toBeNull();
    const initialRecId = initialRec.id;

    // 2. Teacher accepts the recommendation
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/recommendations/${initialRecId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        learnerId: SEED_IDS.studentEmma,
        decision: 'ACCEPT',
        teacherNotes: 'Looks good'
      }
    });
    if (acceptRes.statusCode !== 200) {
      console.log('ACCEPT FAILED:', acceptRes.json());
    }
    expect(acceptRes.statusCode).toBe(200);

    // Verify it is ACCEPT
    const verifyRecRes = await app.inject({
      method: 'GET',
      url: `/api/recommendations/learner/${SEED_IDS.studentEmma}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(verifyRecRes.json().id).toBe(initialRecId);
    expect(verifyRecRes.json().decisionStatus).toBe('ACCEPT');

    // 3. Change evidence for a different skill. This must still invalidate the
    // current recommendation because the learner's weakest skill may change.
    const targetSkillId = verifyRecRes.json().targetSkillId;
    const allSkills = await db.select().from(schema.skills);
    const changedSkillId = allSkills.find((skill) => skill.id !== targetSkillId)!.id;
    
    // First ensure there is at least one evidence to correct
    await db.insert(schema.learningEvidence).values({
      learnerId: SEED_IDS.studentEmma,
      skillId: changedSkillId,
      evidenceType: 'QUESTION_RESULT',
      evaluatorType: 'AUTO',
      normalizedScore: 0.5,
      difficulty: 'MEDIUM',
      observedAt: new Date(),
    });
    
    const getEvidenceRes = await app.inject({
      method: 'GET',
      url: `/api/evidence?learnerId=${SEED_IDS.studentEmma}&skillId=${changedSkillId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const evs = getEvidenceRes.json();
    expect(evs.length).toBeGreaterThan(0);
    const evToCorrect = evs[0];

    const evidenceRes = await app.inject({
      method: 'POST',
      url: `/api/evidence/${evToCorrect.id}/correct`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        correctedNormalizedScore: 0.95,
        reason: 'Testing staleness'
      }
    });
    expect(evidenceRes.statusCode).toBe(200);

    const staleDecisionRes = await app.inject({
      method: 'POST',
      url: `/api/recommendations/${initialRecId}/decision`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        learnerId: SEED_IDS.studentEmma,
        decision: 'ACCEPT',
        teacherNotes: 'This stale recommendation must be rejected'
      }
    });
    expect(staleDecisionRes.statusCode).toBe(400);
    expect(staleDecisionRes.json().message).toContain('STALE');

    // 4. Fetch recommendation again. The previous one must be stale, so a new one should be generated!
    const newRecRes = await app.inject({
      method: 'GET',
      url: `/api/recommendations/learner/${SEED_IDS.studentEmma}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(newRecRes.statusCode).toBe(200);
    const newRec = newRecRes.json();
    
    // It should be a new ID and PENDING
    expect(newRec.id).not.toBe(initialRecId);
    expect(newRec.decisionStatus).toBe('PENDING');

    // It should contain proper grounding data in rationale
    expect(newRec.rationale.grounding).toBeDefined();
    expect(newRec.rationale.grounding.effectiveEvidenceCount).toBeGreaterThanOrEqual(1);
    expect(newRec.rationale.grounding.timestamp).toBeDefined();
    expect(newRec.rationale.grounding.evidenceIds).toBeDefined();
    expect(newRec.rationale.grounding.evidenceIds.length).toBeGreaterThanOrEqual(1);
  });
});
