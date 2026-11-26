import { generateKeyPairSync } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const adminE2eEnabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const e2eGaPrivateKey = adminE2eEnabled
  ? generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey
  : '';
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
      GA4_PROPERTY_ID: '123456789',
      GA4_CLIENT_EMAIL: 'e2e-reporter@nokmel-e2e.test',
      GA4_PRIVATE_KEY: e2eGaPrivateKey,
      GA4_API_BASE_URL: 'http://127.0.0.1:3300',
      GA4_TOKEN_ENDPOINT: 'http://127.0.0.1:3300/token',
      GA4_MEASUREMENT_ID: '',
      TELEGRAM_BOT_TOKEN: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij',
      TELEGRAM_API_BASE_URL: 'http://127.0.0.1:3301',
    }
  : { ...process.env, JOIN_INTAKE_ENABLED: joinIntakeEnabled };

const disabledWebServerEnv = {
  ...webServerEnv,
  BETTER_AUTH_URL: 'http://127.0.0.1:3200',
  TRUSTED_ORIGINS: 'http://127.0.0.1:3200',
  JOIN_INTAKE_ENABLED: '',
  GA4_PROPERTY_ID: '',
  GA4_CLIENT_EMAIL: '',
  GA4_PRIVATE_KEY: '',
  GA4_API_BASE_URL: '',
  GA4_TOKEN_ENDPOINT: '',
  GA4_MEASUREMENT_ID: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_API_BASE_URL: '',
};

/**
 * Tracking-enabled public fixture for reversible-consent tests. The GA tag
 * base is the loopback stub; no real Google endpoint is used. Analytics is
 * enabled only through disposable database settings inside the spec.
 */
const analyticsWebServerEnv = {
  ...webServerEnv,
  BETTER_AUTH_URL: 'http://127.0.0.1:3400',
  TRUSTED_ORIGINS: 'http://127.0.0.1:3400',
  GA4_MEASUREMENT_ID: 'G-E2ETEST01',
  GA4_TAG_BASE_URL: 'http://127.0.0.1:3300',
};

/**
 * Packaged next-start servers:
 * - 3100: normal public/admin fixture; join intake enabled only with the admin
 *   e2e environment (explicit disposable acceptance fixture).
 * - 3200: deliberately intake-disabled coverage.
 * - 3400: tracking-enabled public fixture using the loopback GA stub for
 *   reversible-consent tests; analytics is enabled via disposable DB settings.
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
      testIgnore: [
        /tests\/e2e\/setup\//,
        /join-intake-disabled\.spec\.ts/,
        /w5-analytics-consent\.spec\.ts/,
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'intake-disabled',
      testMatch: /join-intake-disabled\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3200' },
    },
    {
      name: 'analytics-consent',
      dependencies: ['admin-setup'],
      testMatch: /w5-analytics-consent\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3400' },
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
    {
      command: 'pnpm exec next start -p 3400 -H 127.0.0.1',
      url: 'http://127.0.0.1:3400',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: analyticsWebServerEnv as Record<string, string>,
    },
    {
      command: 'node tests/e2e/setup/ga-stub-server.mjs',
      url: 'http://127.0.0.1:3300/__health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'node tests/e2e/setup/telegram-stub-server.mjs',
      url: 'http://127.0.0.1:3301/__health',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
