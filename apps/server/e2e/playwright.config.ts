import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm --filter @repo/server dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    env: {
      PRIMARY_DB_PATH: ':memory:',
      USER_DATA_DIR: '/tmp/users',
      NODE_ENV: 'production',
    },
  },
});
