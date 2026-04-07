import { defineConfig, devices } from '@playwright/test';

/**
 * Prerequisites before running:
 *   1. docker compose up -d          (postgres + redis)
 *   2. npm run db:push -w @vla/api   (schema sync)
 *   3. npm run db:seed -w @vla/api   (test users)
 *
 * Then: npm run test:e2e
 *
 * Credentials used by the suite:
 *   Admin : josue@vla.com   / admin123
 *   Staff : maria@vla.com   / staff123
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential while DB state matters
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── 1. Create saved auth sessions ────────────────────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },

    // ── 2. Tests that require an admin session ────────────────────────────────
    {
      name: 'admin',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      testMatch: /admin\.spec\.ts|plugins\.spec\.ts/,
    },

    // ── 3. Tests that require a staff session ─────────────────────────────────
    {
      name: 'staff',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/staff.json',
      },
      testMatch: /staff\.spec\.ts/,
    },

    // ── 4. Unauthenticated tests (login page, guards) ─────────────────────────
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /auth\.spec\.ts/,
    },
  ],

  // webServer is intentionally omitted for local development.
  // Run both servers manually before executing tests:
  //   Terminal 1: npm run dev:api
  //   Terminal 2: npm run dev:web
  //
  // For CI, uncomment and configure:
  // webServer: [
  //   { command: 'npm run dev:api', url: 'http://localhost:3001/api/docs', timeout: 60_000 },
  //   { command: 'npm run dev:web', url: 'http://localhost:3000/login',    timeout: 60_000 },
  // ],
});
