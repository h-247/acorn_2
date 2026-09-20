import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { seed, SEED_IDS } from '../../src/infrastructure/persistence/seed.js';
import { storage } from '../../src/infrastructure/object-storage/storage.js';
import { generateToken } from '../../src/infrastructure/auth/auth.js';
import { UserRole } from '@acorn/contracts';

describe('Object Storage Integration', () => {
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

  it('connects to SeaweedFS S3 storage and successfully writes and reads an object', async () => {
    const testKey = `test-artifacts/test-${Date.now()}.txt`;
    const content = Buffer.from('Acorn local SeaweedFS S3 storage test content');

    await storage.putObject(testKey, content, 'text/plain');

    const retrieved = await storage.getObject(testKey);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.toString('utf8')).toBe('Acorn local SeaweedFS S3 storage test content');

    const signedUrl = await storage.getSignedUrl(testKey, 3600);
    expect(signedUrl).toBeDefined();
    expect(signedUrl.length).toBeGreaterThan(10);
  });

  it('rejects file upload for non-existent material with 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/materials/00000000-0000-0000-0000-000000000000/files',
      headers: { authorization: `Bearer ${teacherToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });
});
