import { expect, test } from '@playwright/test';

test('app loads and shows welcome login page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Welcome/i)).toBeVisible();
  await expect(page.getByText(/Sign in with Google/i)).toBeVisible();
});

test('can login and navigate to notes', async ({ page }) => {
  await page.goto('/');

  // Trigger mock login
  await page.goto('/api/auth/mock-login');
  await expect(page.getByText(/mock-google-id/i)).toBeVisible();

  await page.goto('/');
  await page.getByTestId('nav-notes').click();
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
});
