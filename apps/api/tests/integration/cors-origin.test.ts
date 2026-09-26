import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { config } from '../../src/shared/config.js';
import { UserRole } from '@acorn/contracts';

describe('CORS & Cookie-Auth Origin Guard Integration', () => {
  let app: ReturnType<typeof buildApp>;
  let teacherToken: string;
  let teacherCookie: string;

  beforeAll(async () => {
    await seed();
    app = buildApp();

    teacherToken = generateToken({
      id: SEED_IDS.teacherTaylor,
      email: 'taylor@acorn.edu',
      name: 'Ms. Taylor',
      role: UserRole.TEACHER,
    });

    teacherCookie = `acorn_token=${encodeURIComponent(teacherToken)}`;
  });

  // =========================================================================
  // AC1: Only configured WEB_ORIGIN receives credentialed CORS allowance
  // =========================================================================

  it('allows preflight OPTIONS from configured WEB_ORIGIN with credentialed CORS headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/materials',
      headers: {
        origin: config.webOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(config.webOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('rejects preflight OPTIONS from different localhost port without credentialed CORS headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/materials',
      headers: {
        origin: 'http://localhost:3001',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('rejects preflight OPTIONS from 127.0.0.1 without credentialed CORS headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/materials',
      headers: {
        origin: 'http://127.0.0.1:9999',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('rejects preflight OPTIONS from arbitrary external origin without credentialed CORS headers', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/materials',
      headers: {
        origin: 'http://evil-attacker.example.com',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('attaches credentialed CORS headers for safe GET request only from configured WEB_ORIGIN', async () => {
    const allowedRes = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: config.webOrigin,
      },
    });
    expect(allowedRes.statusCode).toBe(200);
    expect(allowedRes.headers['access-control-allow-origin']).toBe(config.webOrigin);
    expect(allowedRes.headers['access-control-allow-credentials']).toBe('true');

    const disallowedRes = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:3001',
      },
    });
    expect(disallowedRes.statusCode).toBe(200);
    expect(disallowedRes.headers['access-control-allow-origin']).toBeUndefined();
    expect(disallowedRes.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not attach CORS headers for requests without Origin header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  // =========================================================================
  // AC2: Cross-origin unsafe cookie-auth write is denied, expected origin write succeeds,
  //      existing no-Origin tests still pass
  // =========================================================================

  it('denies cross-origin unsafe cookie-auth POST with 403 before mutation occurs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: {
        origin: 'http://localhost:3001',
        cookie: teacherCookie,
      },
      payload: {
        title: 'Unauthorized Cross-Origin Material',
        type: 'ARTICLE',
        primarySkillId: '33333333-3333-3333-3333-333333333301',
        level: 'B1',
        content: 'This mutation must be rejected with 403.',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toContain('Cross-origin mutation forbidden');
  });

  it('denies cross-origin unsafe cookie-auth PUT with 403', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/materials/11111111-1111-1111-1111-111111111101',
      headers: {
        origin: 'http://localhost:3001',
        cookie: teacherCookie,
      },
      payload: {
        title: 'Hacked Title via Cross-Origin PUT',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('denies cross-origin cookie-auth logout POST with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
      headers: {
        origin: 'http://localhost:3001',
        cookie: teacherCookie,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('denies external origin unsafe cookie-auth POST with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: {
        origin: 'https://malicious-site.com',
        cookie: teacherCookie,
      },
      payload: {
        title: 'Malicious External Material',
        type: 'ARTICLE',
        primarySkillId: '33333333-3333-3333-3333-333333333301',
        level: 'B1',
        content: 'Malicious content',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('FORBIDDEN');
  });

  it('succeeds on unsafe cookie-auth POST from expected WEB_ORIGIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: {
        origin: config.webOrigin,
        cookie: teacherCookie,
      },
      payload: {
        title: `Valid Web Origin Material ${Date.now()}`,
        type: 'ARTICLE',
        primarySkillId: SEED_IDS.skillReading,
        level: 'B1',
        content: 'Legitimate mutation from configured WEB_ORIGIN.',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.headers['access-control-allow-origin']).toBe(config.webOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
  });

  it('succeeds on cookie-auth logout from expected WEB_ORIGIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/logout',
      headers: {
        origin: config.webOrigin,
        cookie: teacherCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'] as string;
    expect(setCookie).toContain('acorn_token=;');
    expect(setCookie).toContain('Max-Age=0');
  });

  it('succeeds on trusted no-Origin API tests / CLI with cookie auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: {
        cookie: teacherCookie,
      },
      payload: {
        title: `No-Origin Cookie Material ${Date.now()}`,
        type: 'ARTICLE',
        primarySkillId: SEED_IDS.skillReading,
        level: 'B1',
        content: 'Trusted CLI/test mutation without Origin header.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
  });

  it('succeeds on trusted no-Origin API tests / CLI with Bearer token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: {
        authorization: `Bearer ${teacherToken}`,
      },
      payload: {
        title: `No-Origin Bearer Material ${Date.now()}`,
        type: 'ARTICLE',
        primarySkillId: SEED_IDS.skillReading,
        level: 'B1',
        content: 'Trusted CLI/test mutation with Bearer token.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
  });

  it('allows Bearer token write even with cross-origin header since it is not ambient cookie auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      headers: {
        origin: 'http://localhost:3001',
        authorization: `Bearer ${teacherToken}`,
      },
      payload: {
        title: `Bearer Cross-Origin Material ${Date.now()}`,
        type: 'ARTICLE',
        primarySkillId: SEED_IDS.skillReading,
        level: 'B1',
        content: 'Bearer tokens are explicit credentials, not vulnerable to CSRF.',
      },
    });

    expect(res.statusCode).toBe(201);
  });
});
