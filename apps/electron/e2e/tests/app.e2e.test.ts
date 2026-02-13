import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

const PERSONAL_TEXT = 'Personal note: I need quieter mornings, reference 42.';

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

const setupFakeAutoExtractAssets = async (homeDir: string): Promise<void> => {
  const autoExtractDir = path.join(homeDir, '.auto-extract');
  const llamaDir = path.join(autoExtractDir, 'llama');
  const llamaBinaryPath = path.join(llamaDir, 'llama-cli');
  const modelPath = path.join(autoExtractDir, 'model.gguf');

  await mkdir(llamaDir, { recursive: true });
  await writeFile(modelPath, 'GGUFTEST');

  const fakeLlamaScript = `#!/bin/sh
cat >/dev/null
printf '%s' '{"title":"Personal Ref 42","memory":"Personal preference note.","items":[{"label":"note_type","value":"Personal note","start":0,"end":13,"confidence":0.95},{"label":"reference","value":"reference 42","start":40,"end":52,"confidence":0.93}],"groups":[{"name":"personal_context","itemIndexes":[0,1]}]}'
`;

  await writeFile(llamaBinaryPath, fakeLlamaScript);
  await chmod(llamaBinaryPath, 0o755);
};

const launchApp = async (seedProfile: 'fresh' | 'baseline') => {
  const tempDir = await mkdtemp(path.join(tmpdir(), `repo-e2e-${seedProfile}-`));
  const dbPath = path.join(tempDir, 'e2e.sqlite');
  const homeDir = path.join(tempDir, 'home');

  await setupFakeAutoExtractAssets(homeDir);

  const app = await electron.launch({
    args: [distMain],
    cwd: repoRoot,
    env: {
      ...inheritedEnv,
      HOME: homeDir,
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

const assertExtractionIsInferred = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('extract-text-input')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('extract-submit-button')).toBeVisible();

  await page.getByTestId('extract-text-input').fill(PERSONAL_TEXT);
  await page.getByTestId('extract-text-input').press('Meta+Enter');

  await expect(page.getByTestId('extraction-result')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('extraction-title')).toHaveText('Personal Ref 42');
  await expect(
    page.getByTestId('extraction-items-table').getByRole('cell', { name: 'Personal note' }),
  ).toBeVisible();
  await expect(
    page.getByTestId('extraction-items-table').getByRole('cell', { name: 'reference 42' }),
  ).toBeVisible();
};

test('fresh profile infers extraction for personal note with reference 42', async () => {
  const launched = await launchApp('fresh');

  try {
    try {
      await assertExtractionIsInferred(launched.page);
    } catch (error) {
      await dumpPageState(launched.page);
      throw error;
    }
  } finally {
    await launched.cleanup();
  }
});

test('seeded profile infers extraction for personal note with reference 42', async () => {
  const launched = await launchApp('baseline');

  try {
    try {
      await assertExtractionIsInferred(launched.page);
    } catch (error) {
      await dumpPageState(launched.page);
      throw error;
    }
  } finally {
    await launched.cleanup();
  }
});
