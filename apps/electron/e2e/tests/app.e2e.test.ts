import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, _electron as electron, expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');
const distMain = path.resolve(repoRoot, 'apps/electron/dist/main/index.js');
const rendererDist = path.resolve(repoRoot, 'apps/renderer/dist');
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const dumpPageState = async (page: Page): Promise<void> => {
  const url = page.url();
  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '<body unavailable>');
  const hasApi = await page.evaluate(() => Boolean(window.appApi)).catch(() => false);
  console.error(`[e2e] page url: ${url}`);
  console.error(`[e2e] window.appApi available: ${hasApi}`);
  console.error(`[e2e] body text: ${body.slice(0, 500)}`);
};

const launchApp = async (seedProfile: 'fresh' | 'baseline') => {
  const tempDir = await mkdtemp(path.join(tmpdir(), `repo-e2e-${seedProfile}-`));
  const dbPath = path.join(tempDir, 'e2e.sqlite');

  const app = await electron.launch({
    args: [distMain],
    cwd: repoRoot,
    env: {
      ...inheritedEnv,
      APP_DB_PATH: dbPath,
      APP_DB_SEED_PROFILE: seedProfile,
      RENDERER_DIST: rendererDist,
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  const page = await app.firstWindow();

  return {
    app,
    page,
    cleanup: async () => {
      await app.close();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
};

test('fresh profile migrates and allows creating notes', async () => {
  const launched = await launchApp('fresh');

  try {
    try {
      await expect(launched.page.getByTestId('empty-state')).toBeVisible({ timeout: 15_000 });
    } catch (error) {
      await dumpPageState(launched.page);
      throw error;
    }

    await launched.page.getByTestId('title-input').fill('E2E note');
    await launched.page.getByTestId('body-input').fill('Created through full Electron IPC stack.');
    await launched.page.getByTestId('create-button').click();

    await expect(launched.page.getByText('E2E note')).toBeVisible();
  } finally {
    await launched.cleanup();
  }
});

test('seeded profile loads baseline data', async () => {
  const launched = await launchApp('baseline');

  try {
    try {
      await expect(launched.page.getByText('Seeded note')).toBeVisible({ timeout: 15_000 });
    } catch (error) {
      await dumpPageState(launched.page);
      throw error;
    }
  } finally {
    await launched.cleanup();
  }
});
