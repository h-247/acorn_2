import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// OVERRIDE API_BASE_URL FOR TESTS TO AVOID LOCALHOST:4000 FROM .ENV
process.env.API_PORT = process.env.API_PORT || '4100';
process.env.API_BASE_URL = `http://127.0.0.1:${process.env.API_PORT}`;

const defaultDbUrl = process.env.DATABASE_URL || 'postgresql://acorn:acorn_dev_only@localhost:5435/acorn';
const testDbUrl = defaultDbUrl.replace(/\/[^/?#]+([?#]|$)/, '/acorn_test$1');
const testBucket = 'acorn-test';

export default defineConfig({
  globalSetup: require.resolve('./playwright.global-setup'),
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
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
      command: `pnpm --filter @acorn/api dev`,
      url: `http://127.0.0.1:${process.env.API_PORT || '4100'}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: testDbUrl,
        OBJECT_STORAGE_BUCKET: testBucket,
        PORT: process.env.API_PORT || '4100',
      },
    },
    {
      command: 'pnpm dev',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
      env: {
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${process.env.API_PORT || '4100'}/api`,
      }
    },
  ],
});
