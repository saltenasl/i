import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(180_000);

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
  console.error(`[e2e] body text: ${body.slice(0, 1000)}`);
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

const assertExtractSmoke = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('extract-text-input')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('extract-submit-button')).toBeVisible();
  await expect(page.getByTestId('extract-compare-button')).toBeVisible();
};

test('fresh profile shows extract input and submit controls', async () => {
  const launched = await launchApp('fresh');

  try {
    try {
      await assertExtractSmoke(launched.page);
    } catch (error) {
      await dumpPageState(launched.page);
      throw error;
    }
  } finally {
    await launched.cleanup();
  }
});

test('seeded profile shows extract input and submit controls', async () => {
  const launched = await launchApp('baseline');

  try {
    try {
      await assertExtractSmoke(launched.page);
    } catch (error) {
      await dumpPageState(launched.page);
      throw error;
    }
  } finally {
    await launched.cleanup();
  }
});
