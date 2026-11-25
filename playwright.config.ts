import { defineConfig, devices } from '@playwright/test';

const adminE2eEnabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);

const webServerEnv = adminE2eEnabled
  ? {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? '',
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-only-secret-0123456789abcdef012345',
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://127.0.0.1:3100',
      TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS ?? 'http://127.0.0.1:3100',
      OWNER_EMAIL: process.env.OWNER_EMAIL ?? 'owner@nokmel-e2e.test',
      RATE_LIMIT_SIGNIN_MAX: process.env.RATE_LIMIT_SIGNIN_MAX ?? '50',
    }
  : { ...process.env };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
  projects: [
    {
      name: 'admin-setup',
      testMatch: /tests\/e2e\/setup\/.*\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      dependencies: ['admin-setup'],
      testIgnore: /tests\/e2e\/setup\//,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm exec next start -p 3100 -H 127.0.0.1',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: webServerEnv as Record<string, string>,
  },
});
