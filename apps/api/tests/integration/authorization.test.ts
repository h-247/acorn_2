import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infrastructure/persistence/db.js';

describe('Authorization & Error Boundaries', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    db.reset();
    app = buildApp();
  });

  it('rejects invalid login credentials with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/identity/login',
      payload: {
        email: 'nonexistent@acorn.edu',
        password: 'wrong',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for non-existent material', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/materials/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 validation error for malformed material creation payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials',
      payload: {
        // missing required title, type, primarySkillId, etc.
        title: '',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
