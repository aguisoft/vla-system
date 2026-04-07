import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.join(__dirname, '.auth');

setup.beforeAll(() => {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
});

setup('create admin session', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'josue@vla.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard/admin', { timeout: 10_000 });
  await page.context().storageState({ path: path.join(AUTH_DIR, 'admin.json') });
});

setup('create staff session', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'maria@vla.com');
  await page.fill('input[type="password"]', 'staff123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard/welcome', { timeout: 10_000 });
  await page.context().storageState({ path: path.join(AUTH_DIR, 'staff.json') });
});
