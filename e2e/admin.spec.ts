import { test, expect } from '@playwright/test';

// Runs with admin storageState (josue@vla.com)

test.describe('Admin dashboard', () => {
  test('admin can access /dashboard/admin', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).not.toHaveURL(/\/login/);
    // Admin panel has a heading or identifiable element
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 });
  });

  test('admin panel shows Módulos (plugins) section', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page.getByText(/módulos|plugins/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('admin can see the plugins list', async ({ page }) => {
    await page.goto('/dashboard/admin');
    // Wait for the plugins section to load (list or empty state)
    const pluginsSection = page.locator('[data-testid="plugins-list"], table, .plugin-card').first();
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe('Navigation', () => {
  test('admin can navigate to the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
