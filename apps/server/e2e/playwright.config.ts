import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
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
  testIgnore: '**/smoke.test.ts',
  webServer: {
    command: 'pnpm start',
    cwd: '../../..',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    env: {
      PRIMARY_DB_PATH: ':memory:',
      USER_DATA_DIR: '/tmp/users',
      NODE_ENV: 'production',
      ALLOW_MOCK_LOGIN: 'true',
    },
  },
});
