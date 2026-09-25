import { describe, it, expect } from 'vitest';
import { config } from '../src/shared/config.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Test Environment Isolation', () => {
  it('should be configured to use the test database', () => {
    expect(config.databaseUrl).toMatch(/\/acorn_test$/);
  });

  it('should be configured to use the test bucket', () => {
    expect(config.objectStorage.bucket).toBe('acorn-test');
  });

  it('should reject reset-db execution targeting demo database in test mode', async () => {
    try {
      await execAsync('pnpm exec tsx src/infrastructure/persistence/reset-db.ts', {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://acorn:acorn_dev_only@localhost:5435/acorn',
        }
      });
      expect.fail('Should have thrown an error');
    } catch (err: any) {
      expect(err.message).toMatch(/Refusing to run tests against database "acorn"/);
    }
  });

  it('should reject execution targeting arbitrary unsafe database', async () => {
    try {
      await execAsync('pnpm exec tsx src/infrastructure/persistence/reset-db.ts', {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://acorn:acorn_dev_only@localhost:5435/production_db',
        }
      });
      expect.fail('Should have thrown an error');
    } catch (err: any) {
      expect(err.message).toMatch(/Refusing to run tests against database "production_db"/);
    }
  });

  it('should reject execution targeting demo bucket', async () => {
    try {
      await execAsync('pnpm exec tsx src/infrastructure/persistence/reset-db.ts', {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://acorn:acorn_dev_only@localhost:5435/acorn_test',
          OBJECT_STORAGE_BUCKET: 'acorn-dev',
        }
      });
      expect.fail('Should have thrown an error');
    } catch (err: any) {
      expect(err.message).toMatch(/Refusing to run tests against bucket "acorn-dev"/);
    }
  });

  it('should reject seed execution targeting demo database in test mode', async () => {
    try {
      await execAsync('pnpm exec tsx src/infrastructure/persistence/seed.ts', {
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://acorn:acorn_dev_only@localhost:5435/acorn',
        }
      });
      expect.fail('Should have thrown an error');
    } catch (err: any) {
      expect(err.message).toMatch(/Refusing to run tests against database "acorn"/);
    }
  });
});
