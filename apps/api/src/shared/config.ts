import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load the nearest `.env` walking up from this file, not from the working
 * directory.
 *
 * `dotenv.config()` on its own resolves against `process.cwd()`, which is
 * `apps/api` however the app is started - while the file it wants is at the
 * root of the workspace. The result was an app that read none of its own
 * configuration and ran on the fallback literals below, which passed unnoticed
 * only because those literals happen to match compose.
 *
 * Searching upward works the same in `src` and in `dist`, and finds nothing in
 * a container, where the environment is passed in directly. Real environment
 * variables still win: dotenv does not overwrite what is already set.
 */
function loadEnvFile(): void {
  let dir = dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 8; depth++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  dotenv.config();
}

loadEnvFile();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'acorn_super_secret_jwt_key_for_dev_123',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://acorn:acorn_dev_only@localhost:5435/acorn',
  recentEvidenceCount: parseInt(process.env.RECENT_EVIDENCE_COUNT || '20', 10),
  webOrigin: (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/+$/, ''),
  objectStorage: {
    provider: process.env.OBJECT_STORAGE_PROVIDER || 'seaweedfs',
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT || 'http://localhost:8333',
    bucket: process.env.OBJECT_STORAGE_BUCKET || 'acorn-dev',
    accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY || 'acorn',
    secretKey: process.env.OBJECT_STORAGE_SECRET_KEY || 'acorn_dev_only',
    region: process.env.OBJECT_STORAGE_REGION || 'us-east-1',
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== 'false',
  },
};

if (process.env.VITEST || process.env.NODE_ENV === 'test') {
  const dbNameMatch = config.databaseUrl.match(/\/\/.*\/([^\/?#]+)/);
  const dbName = dbNameMatch ? dbNameMatch[1] : '';

  if (dbName !== 'acorn_test') {
    throw new Error(`Refusing to run tests against database "${dbName}". Must use exactly "acorn_test".`);
  }
  if (config.objectStorage.bucket !== 'acorn-test') {
    throw new Error(`Refusing to run tests against bucket "${config.objectStorage.bucket}". Must use exactly "acorn-test".`);
  }
}
