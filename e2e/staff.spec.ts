import { test, expect } from '@playwright/test';

// Runs with staff storageState (maria@vla.com)

test.describe('Staff access', () => {
  test('staff can access /dashboard/welcome', async ({ page }) => {
    await page.goto('/dashboard/welcome');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('staff is blocked from /dashboard/admin', async ({ page }) => {
    await page.goto('/dashboard/admin');
    // Staff should be redirected away from admin — either to /dashboard/welcome or /login
    await page.waitForURL(/\/dashboard\/welcome|\/login/, { timeout: 10_000 });
    expect(page.url()).not.toContain('/dashboard/admin');
  });

  test('staff can access the main dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
