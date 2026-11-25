import { afterEach, describe, expect, test } from 'vitest';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import { createAuth } from '@/lib/auth';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env.BETTER_AUTH_SECRET = originalEnv.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_URL = originalEnv.BETTER_AUTH_URL;
  process.env.TRUSTED_ORIGINS = originalEnv.TRUSTED_ORIGINS;
  process.env.DATABASE_URL = originalEnv.DATABASE_URL;
});

function clearAuthEnv(): void {
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.TRUSTED_ORIGINS;
  delete process.env.DATABASE_URL;
}

describe('auth configuration fails closed', () => {
  test('missing secret is refused, never defaulted', () => {
    clearAuthEnv();
    expect(() =>
      createAuth({ db: { __placeholder: true } as never }),
    ).toThrow(ConfigError);
  });

  test('short secret is refused', () => {
    clearAuthEnv();
    process.env.BETTER_AUTH_SECRET = 'short';
    process.env.BETTER_AUTH_URL = 'https://nokmel.tech';
    expect(() => createAuth({ db: { __placeholder: true } as never })).toThrow(ConfigError);
  });

  test('no trusted origins is refused rather than allowing any origin', () => {
    clearAuthEnv();
    process.env.BETTER_AUTH_SECRET = 'a-sufficiently-long-secret-value-0123456789';
    expect(() => createAuth({ db: { __placeholder: true } as never })).toThrow(ConfigError);
  });
});

describe('database configuration fails closed', () => {
  test('missing DATABASE_URL is refused, never defaulted', () => {
    delete process.env.DATABASE_URL;
    expect(() => getDb()).toThrow(ConfigError);
  });
});
