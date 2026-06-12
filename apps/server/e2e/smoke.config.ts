import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.ts';

export default defineConfig({
  ...baseConfig,
  testMatch: '**/smoke.test.ts',
  testIgnore: [],
  use: {
    ...baseConfig.use,
    baseURL: 'http://127.0.0.1:5173',
  },
  webServer: {
    command: 'pnpm dev',
    cwd: '../../..',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      PRIMARY_DB_PATH: ':memory:',
      USER_DATA_DIR: '/tmp/users',
      NODE_ENV: 'development',
    },
  },
});
