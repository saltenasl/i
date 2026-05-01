import { expect, test } from '@playwright/test';

test('app loads and shows extract page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Auto Extract/i)).toBeVisible();
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
