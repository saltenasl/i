import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(180_000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../..');
const distMain = path.resolve(repoRoot, 'apps/electron/dist/main/index.js');
const rendererDist = path.resolve(repoRoot, 'apps/renderer/dist');
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const launchApp = async (seedProfile: 'fresh' | 'baseline' = 'baseline') => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'repo-e2e-view-'));
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

test('navigates to view page from history and renders extraction view', async () => {
  const launched = await launchApp('baseline');

  try {
    const { page } = launched;

    // Wait for the baseline seed auto-redirect to the latest extraction
    await expect(page.getByTestId('extraction-v2-result')).toBeVisible({ timeout: 15_000 });

    // Go back to the main App
    await page.getByTestId('view-back-link').click();
    await expect(page.getByTestId('extract-text-input')).toBeVisible({ timeout: 10_000 });

    // Click on the historical extraction link
    const viewLink = page.locator('[data-testid^="history-view-link-"]').first();
    await expect(viewLink).toBeVisible();
    await viewLink.click();

    // Assert it successfully rendered the extraction view again
    await expect(page.getByTestId('extraction-v2-result')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('view-back-link')).toBeVisible();

    await page.getByTestId('view-back-link').click();
    await expect(page.getByTestId('extract-text-input')).toBeVisible({ timeout: 10_000 });

    await page.evaluate(() => {
      window.location.hash = '#/view/nonexistent-id';
    });

    const errorOrLoading = page.getByTestId('view-error').or(page.getByTestId('view-loading'));
    await expect(errorOrLoading).toBeVisible({ timeout: 10_000 });
  } finally {
    await launched.cleanup();
  }
});
