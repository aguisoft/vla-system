import { test, expect } from '@playwright/test';

// Runs with staff storageState (maria@vla.com)

test.describe('Staff access', () => {
  test('staff can access /dashboard/welcome', async ({ page }) => {
    await page.goto('/dashboard/welcome');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('staff is redirected away from /dashboard/admin', async ({ page }) => {
    await page.goto('/dashboard/admin');
    // Should be redirected — not stay on admin page
    await page.waitForURL(/\/dashboard\/(?!admin)/, { timeout: 5_000 });
    expect(page.url()).not.toContain('/dashboard/admin');
  });

  test('staff can access the main dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
