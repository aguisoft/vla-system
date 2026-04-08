import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('admin login redirects to /dashboard/admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'josue@vla.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/admin', { timeout: 10_000 });
    expect(page.url()).toContain('/dashboard/admin');
  });

  test('staff login redirects to /dashboard/welcome', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'maria@vla.com');
    await page.fill('input[type="password"]', 'staff123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/welcome', { timeout: 10_000 });
    expect(page.url()).toContain('/dashboard/welcome');
  });

  test('invalid credentials shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@vla.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Email o contraseña incorrectos')).toBeVisible({ timeout: 8_000 });
    expect(page.url()).toContain('/login');
  });
});

test.describe('Route guards', () => {
  test('/dashboard/welcome redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard/welcome');
    // The layout shows a spinner while Zustand hydrates, then redirects
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('/dashboard/admin redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});
