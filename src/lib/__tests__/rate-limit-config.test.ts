import { describe, expect, test } from 'vitest';
import {
  DEFAULT_SIGNIN_RATE_LIMIT_MAX,
  DISPOSABLE_TEST_ENV_FLAG,
  resolveSignInRateLimitMax,
} from '@/lib/rate-limit-config';

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

function disposableEnv(
  values: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  return env({ ...values, [DISPOSABLE_TEST_ENV_FLAG]: '1' });
}

describe('sign-in rate-limit configuration', () => {
  test('defaults to five attempts per minute', () => {
    expect(resolveSignInRateLimitMax(env({}))).toBe(DEFAULT_SIGNIN_RATE_LIMIT_MAX);
    expect(DEFAULT_SIGNIN_RATE_LIMIT_MAX).toBe(5);
  });

  test('ignores overrides unless the disposable test flag is explicitly set', () => {
    expect(resolveSignInRateLimitMax(env({ RATE_LIMIT_SIGNIN_MAX: '50' }))).toBe(5);
    expect(
      resolveSignInRateLimitMax(
        env({ RATE_LIMIT_SIGNIN_MAX: '50', [DISPOSABLE_TEST_ENV_FLAG]: '0' }),
      ),
    ).toBe(5);
  });

  test('allows a bounded override in an explicitly marked disposable test environment', () => {
    expect(
      resolveSignInRateLimitMax(disposableEnv({ RATE_LIMIT_SIGNIN_MAX: '50' })),
    ).toBe(50);
    expect(
      resolveSignInRateLimitMax(disposableEnv({ RATE_LIMIT_SIGNIN_MAX: '2' })),
    ).toBe(2);
  });

  test('ignores invalid and excessive override values', () => {
    for (const value of ['0', '-1', 'abc', '5.5', '', '100000', '99999999999999999999']) {
      expect(
        resolveSignInRateLimitMax(disposableEnv({ RATE_LIMIT_SIGNIN_MAX: value })),
      ).toBe(5);
    }
  });

  test('ignores overrides on hosted Vercel environments even with the flag', () => {
    for (const vercelEnv of ['production', 'preview', 'PRODUCTION']) {
      expect(
        resolveSignInRateLimitMax(
          disposableEnv({ VERCEL_ENV: vercelEnv, RATE_LIMIT_SIGNIN_MAX: '50' }),
        ),
      ).toBe(5);
    }
  });
});
