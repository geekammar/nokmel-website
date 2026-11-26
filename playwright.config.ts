import { defineConfig, devices } from '@playwright/test';

const adminE2eEnabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const joinIntakeEnabled = adminE2eEnabled
  ? (process.env.JOIN_INTAKE_ENABLED ?? '1')
  : (process.env.JOIN_INTAKE_ENABLED ?? '');

const webServerEnv = adminE2eEnabled
  ? {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-only-secret-0123456789abcdef012345',
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://127.0.0.1:3100',
      TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS ?? 'http://127.0.0.1:3100',
      OWNER_EMAIL: process.env.OWNER_EMAIL ?? 'owner@nokmel-e2e.test',
      RATE_LIMIT_SIGNIN_MAX: process.env.RATE_LIMIT_SIGNIN_MAX ?? '50',
      JOIN_INTAKE_ENABLED: joinIntakeEnabled,
      NOKMEL_DISPOSABLE_TEST_ENV: process.env.NOKMEL_DISPOSABLE_TEST_ENV ?? '1',
      JOIN_RATE_LIMIT_MAX: process.env.JOIN_RATE_LIMIT_MAX ?? '100',
    }
  : { ...process.env, JOIN_INTAKE_ENABLED: joinIntakeEnabled };

const disabledWebServerEnv = {
  ...webServerEnv,
  BETTER_AUTH_URL: 'http://127.0.0.1:3200',
  TRUSTED_ORIGINS: 'http://127.0.0.1:3200',
  JOIN_INTAKE_ENABLED: '',
};

/**
 * Two packaged next-start servers:
 * - 3100: the normal public/admin fixture; join intake is enabled only when the
 *   admin e2e environment is configured (explicit disposable acceptance fixture).
 * - 3200: deliberately intake-disabled, used to keep disabled-state coverage.
 * `pnpm build` must run before `pnpm test:e2e` (CI does this explicitly).
 */
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
      testIgnore: [/tests\/e2e\/setup\//, /join-intake-disabled\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'intake-disabled',
      testMatch: /join-intake-disabled\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3200' },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec next start -p 3100 -H 127.0.0.1',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: webServerEnv as Record<string, string>,
    },
    {
      command: 'pnpm exec next start -p 3200 -H 127.0.0.1',
      url: 'http://127.0.0.1:3200',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: disabledWebServerEnv as Record<string, string>,
    },
  ],
});
