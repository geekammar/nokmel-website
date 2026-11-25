import { afterEach, describe, expect, test } from 'vitest';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import { createAuth } from '@/lib/auth';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env.BETTER_AUTH_SECRET = originalEnv.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_URL = originalEnv.BETTER_AUTH_URL;
  process.env.TRUSTED_ORIGINS = originalEnv.TRUSTED_ORIGINS;
  process.env.BETTER_AUTH_TRUSTED_ORIGINS = originalEnv.BETTER_AUTH_TRUSTED_ORIGINS;
  process.env.DATABASE_URL = originalEnv.DATABASE_URL;
});

function clearAuthEnv(): void {
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.TRUSTED_ORIGINS;
  delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  delete process.env.DATABASE_URL;
}

function createWithPlaceholderDb() {
  return createAuth({ db: { __placeholder: true } as never });
}

describe('auth configuration fails closed', () => {
  test('missing secret is refused, never defaulted', () => {
    clearAuthEnv();
    expect(() => createWithPlaceholderDb()).toThrow(ConfigError);
  });

  test('short secret is refused', () => {
    clearAuthEnv();
    process.env.BETTER_AUTH_SECRET = 'short';
    process.env.BETTER_AUTH_URL = 'https://nokmel.tech';
    expect(() => createWithPlaceholderDb()).toThrow(ConfigError);
  });

  test('missing BETTER_AUTH_URL is refused instead of deriving origins from requests', () => {
    clearAuthEnv();
    process.env.BETTER_AUTH_SECRET = 'a-sufficiently-long-secret-value-0123456789';
    expect(() => createWithPlaceholderDb()).toThrow(/BETTER_AUTH_URL is required/);
  });

  test('unsafe HTTP or wildcard origins are refused', () => {
    clearAuthEnv();
    process.env.BETTER_AUTH_SECRET = 'a-sufficiently-long-secret-value-0123456789';
    process.env.BETTER_AUTH_URL = 'http://nokmel.tech';
    expect(() => createWithPlaceholderDb()).toThrow(ConfigError);

    process.env.BETTER_AUTH_URL = 'https://*.vercel.app';
    expect(() => createWithPlaceholderDb()).toThrow(ConfigError);
  });

  test('implicit Better Auth trusted-origin env cannot bypass validation', () => {
    clearAuthEnv();
    process.env.BETTER_AUTH_SECRET = 'a-sufficiently-long-secret-value-0123456789';
    process.env.BETTER_AUTH_URL = 'https://nokmel.tech';
    process.env.BETTER_AUTH_TRUSTED_ORIGINS = 'https://attacker.example';
    expect(() => createWithPlaceholderDb()).toThrow(/BETTER_AUTH_TRUSTED_ORIGINS/);
  });
});

describe('database configuration fails closed', () => {
  test('missing DATABASE_URL is refused, never defaulted', () => {
    delete process.env.DATABASE_URL;
    expect(() => getDb()).toThrow(ConfigError);
  });
});
