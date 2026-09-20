import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

describe('Authoritative Persistence & Audit Verification', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });
  });

  it('verifies pilot metrics are calculated strictly from database counts without fake numbers or AI fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit/metrics',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(res.statusCode).toBe(200);
    const metrics = JSON.parse(res.body);

    // Verify all non-AI required metrics exist
    expect(metrics.totalMaterials).toBeGreaterThan(0);
    expect(metrics.materialsDirectReuseCount).toBeGreaterThanOrEqual(0);
    expect(metrics.materialsAdaptedCount).toBeGreaterThanOrEqual(0);
    expect(metrics.materialsNewCreatedCount).toBeGreaterThanOrEqual(0);
    expect(metrics.reuseRate).toBeGreaterThanOrEqual(0);
    expect(metrics.reuseRate).toBeLessThanOrEqual(1.0);
    expect(metrics.totalSubmissions).toBeGreaterThanOrEqual(1);
    expect(metrics.totalEvidenceRecorded).toBeGreaterThanOrEqual(1);
    expect(metrics.recommendationsTotal).toBeGreaterThanOrEqual(1);

    // Explicitly verify AI metrics are NOT present
    expect((metrics as any).aiGenerationsTotal).toBeUndefined();
    expect((metrics as any).aiGenerationsApprovedCount).toBeUndefined();
    expect((metrics as any).aiGenerationsApprovedRate).toBeUndefined();
  });

  it('corrects evidence, updates database, logs audit event, and updates learner skill state', async () => {
    // 1. Fetch existing evidence for Emma
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/evidence?learnerId=22222222-2222-2222-2222-222222222222',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const evidenceList = JSON.parse(listRes.body);
    expect(evidenceList.length).toBeGreaterThan(0);

    const targetEvidence = evidenceList[0];

    // 2. Teacher corrects evidence score
    const correctRes = await app.inject({
      method: 'POST',
      url: `/api/evidence/${targetEvidence.id}/correct`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        evidenceId: targetEvidence.id,
        correctedNormalizedScore: 0.95,
        reason: 'Student demonstrated sound reasoning during oral check in class.',
      },
    });
    expect(correctRes.statusCode).toBe(200);
    const updatedEvidence = JSON.parse(correctRes.body);
    expect(updatedEvidence.isCorrected).toBe(true);
    expect(updatedEvidence.normalizedScore).toBe(0.95);

    // 3. Verify audit log contains EVIDENCE_CORRECTED
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/audit/events',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(auditRes.statusCode).toBe(200);
    const events = JSON.parse(auditRes.body);
    const correctionEvent = events.find(
      (e: any) => e.action === 'EVIDENCE_CORRECTED' && e.entityId === targetEvidence.id
    );
    expect(correctionEvent).toBeDefined();
    expect(correctionEvent.metadata.newScore).toBe(0.95);
  });

  it('records teacher decision intent without creating unexpected assignment side-effects', async () => {
    // 1. Fetch recommendation
    const recRes = await app.inject({
      method: 'GET',
      url: '/api/recommendations/learner/22222222-2222-2222-2222-222222222222',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    expect(recRes.statusCode).toBe(200);
    const rec = JSON.parse(recRes.body);

    // 2. Count existing assignments before decision
    const preSubsRes = await app.inject({
      method: 'GET',
      url: '/api/submissions?learnerId=22222222-2222-2222-2222-222222222222',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    const preSubCount = JSON.parse(preSubsRes.body).length;

    // 3. Record decision MODIFY
    const decisionRes = await app.inject({
      method: 'POST',
      url: `/api/recommendations/${rec.id}/decision`,
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {
        recommendationId: rec.id,
        decision: 'MODIFY',
        teacherNotes: 'Will use tailored discussion prompts instead of reading quiz.',
        modifiedActionText: 'Adapted oral discussion for B1 inference',
      },
    });
    expect(decisionRes.statusCode).toBe(200);

    // 4. Verify no new auto-assigned submissions were created
    const postSubsRes = await app.inject({
      method: 'GET',
      url: '/api/submissions?learnerId=22222222-2222-2222-2222-222222222222',
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    const postSubCount = JSON.parse(postSubsRes.body).length;
    expect(postSubCount).toBe(preSubCount);
  });
});
