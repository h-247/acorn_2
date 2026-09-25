import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { resetDatabase } from '../../src/infrastructure/persistence/reset-db.js';
import { SEED_IDS } from '../../src/infrastructure/persistence/seed.js';

describe('Material Lifecycle Consistency', () => {
  let app: ReturnType<typeof buildApp>;
  let adminToken: string;

  beforeAll(async () => {
    await resetDatabase();
    app = buildApp();
    await app.ready();

    adminToken = generateToken({ id: SEED_IDS.adminUser, email: 'admin@acorn.edu', role: 'ADMIN', name: 'Admin' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should start a newly created material as DRAFT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Test Material',
        type: 'ARTICLE',
        level: 'B1',
        primarySkillId: SEED_IDS.skillReading,
        source: 'Custom',
        content: 'Test content',
      }
    });

    if (res.statusCode !== 201) console.error(res.json());
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('DRAFT');
  });

  it('should enforce valid state transitions', async () => {
    // 1. Create a DRAFT material
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Test Lifecycle',
        type: 'ARTICLE',
        level: 'B1',
        primarySkillId: SEED_IDS.skillReading,
        source: 'Custom',
        content: 'Test content',
      }
    });
    const materialId = createRes.json().id;

    // 2. DRAFT -> APPROVED should fail
    let res = await app.inject({
      method: 'PUT',
      url: `/api/materials/${materialId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'APPROVED' }
    });
    expect(res.statusCode).toBe(400);

    // 3. DRAFT -> UNDER_REVIEW should succeed
    res = await app.inject({
      method: 'PUT',
      url: `/api/materials/${materialId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'UNDER_REVIEW' }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('UNDER_REVIEW');

    // 4. UNDER_REVIEW -> APPROVED should succeed
    res = await app.inject({
      method: 'PUT',
      url: `/api/materials/${materialId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'APPROVED' }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('APPROVED');

    // 5. APPROVED -> DRAFT should fail
    res = await app.inject({
      method: 'PUT',
      url: `/api/materials/${materialId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'DRAFT' }
    });
    expect(res.statusCode).toBe(400);
    
    // 6. APPROVED -> ARCHIVED should succeed
    res = await app.inject({
      method: 'PUT',
      url: `/api/materials/${materialId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'ARCHIVED' }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ARCHIVED');

    // 7. ARCHIVED -> APPROVED should succeed
    res = await app.inject({
      method: 'PUT',
      url: `/api/materials/${materialId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'APPROVED' }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('APPROVED');
  });
});
