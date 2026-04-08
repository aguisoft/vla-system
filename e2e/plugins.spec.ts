import { test, expect } from '@playwright/test';

// Runs with admin storageState (josue@vla.com)

test.describe('Plugin management', () => {
  test('admin panel loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/dashboard/admin');
    await expect(page).not.toHaveURL(/\/login/);
    await page.waitForTimeout(1500);

    // Filter out known non-critical warnings
    const critical = errors.filter(
      (e) => !e.includes('Warning:') && !e.includes('ResizeObserver'),
    );
    expect(critical).toHaveLength(0);
  });

  test('API /plugins endpoint returns list (via browser fetch)', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).not.toHaveURL(/\/login/);

    // Use page.evaluate so the request runs in the browser context with cookies
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/v1/plugins', { credentials: 'include' });
      return { status: res.status, data: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('API /plugins endpoint returns correct shape', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).not.toHaveURL(/\/login/);

    const result = await page.evaluate(async () => {
      const res = await fetch('/api/v1/plugins', { credentials: 'include' });
      return await res.json();
    });

    if (result.length > 0) {
      const plugin = result[0];
      expect(plugin).toHaveProperty('name');
      expect(plugin).toHaveProperty('version');
      expect(plugin).toHaveProperty('isActive');
    }
  });
});
