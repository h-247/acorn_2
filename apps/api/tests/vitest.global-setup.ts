import { execSync } from 'child_process';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const defaultDbUrl = process.env.DATABASE_URL || 'postgresql://acorn:acorn_dev_only@localhost:5435/acorn';
const testDbUrl = defaultDbUrl.replace(/\/[^/?#]+([?#]|$)/, '/acorn_test$1');
const testBucket = 'acorn-test';

export default async function globalSetup() {
  console.log('Running global setup for Vitest (provisioning test resources and resetting test database)...');
  
  execSync('pnpm exec tsx tests/provision-resources.ts', {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
      OBJECT_STORAGE_BUCKET: testBucket,
    }
  });

  console.log('Running database migrations...');
  execSync('pnpm db:migrate', {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
    }
  });

  execSync('pnpm exec tsx src/infrastructure/persistence/reset-db.ts', {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: testDbUrl,
      OBJECT_STORAGE_BUCKET: testBucket,
    }
  });
}
