import { test, expect, request } from '@playwright/test';

// Runs with admin storageState (josue@vla.com)

test.describe('Plugin management', () => {
  test('admin panel loads without errors', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).not.toHaveURL(/\/login/);
    // No unhandled errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('API /plugins endpoint returns list', async ({ page }) => {
    const response = await page.request.get('/api/v1/plugins');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('API /plugins endpoint returns correct shape', async ({ page }) => {
    const response = await page.request.get('/api/v1/plugins');
    const plugins = await response.json();
    if (plugins.length > 0) {
      const plugin = plugins[0];
      expect(plugin).toHaveProperty('name');
      expect(plugin).toHaveProperty('version');
      expect(plugin).toHaveProperty('isActive');
    }
  });
});
