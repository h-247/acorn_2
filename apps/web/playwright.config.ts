import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const defaultDbUrl = process.env.DATABASE_URL || 'postgresql://acorn:acorn_dev_only@localhost:5435/acorn';
const testDbUrl = defaultDbUrl.replace(/\/[^/?#]+([?#]|$)/, '/acorn_test$1');
const testBucket = 'acorn-test';

export default defineConfig({
  globalSetup: require.resolve('./playwright.global-setup'),
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @acorn/api dev',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: testDbUrl,
        OBJECT_STORAGE_BUCKET: testBucket,
      },
    },
    {
      command: 'pnpm build && pnpm start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        API_BASE_URL: 'http://localhost:4000',
      }
    },
  ],
});
