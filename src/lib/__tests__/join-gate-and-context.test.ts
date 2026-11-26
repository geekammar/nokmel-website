import { describe, expect, it } from 'vitest';
import { resolveJoinIntakeEnabled } from '@/lib/join/intake-gate';
import { resolveJoinRateLimitConfig } from '@/lib/join/rate-limit';
import {
  checkJoinRequestOrigin,
  deriveJoinBucketKey,
  resolveForwardedIdentity,
  resolveJoinHmacSecret,
  resolveJoinOriginPolicy,
} from '@/lib/join/request-context';

const baseEnv = {
  BETTER_AUTH_URL: 'https://nokmel.tech',
  TRUSTED_ORIGINS: 'https://preview.example',
  BETTER_AUTH_SECRET: 'join-intake-test-secret-0123456789abcdef',
} as unknown as NodeJS.ProcessEnv;

describe('join intake gate', () => {
  it('is disabled by default and for invalid values', () => {
    expect(resolveJoinIntakeEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    for (const value of ['', '0', 'false', 'yes', 'enabled']) {
      expect(resolveJoinIntakeEnabled({ JOIN_INTAKE_ENABLED: value } as unknown as NodeJS.ProcessEnv), value).toBe(
        false,
      );
    }
  });

  it('enables only explicit values', () => {
    expect(resolveJoinIntakeEnabled({ JOIN_INTAKE_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(resolveJoinIntakeEnabled({ JOIN_INTAKE_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(resolveJoinIntakeEnabled({ JOIN_INTAKE_ENABLED: ' True ' } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe('join rate-limit configuration', () => {
  it('uses five attempts per ten minutes by default', () => {
    expect(resolveJoinRateLimitConfig({} as unknown as NodeJS.ProcessEnv)).toEqual({
      max: 5,
      windowSeconds: 600,
    });
  });

  it('honors the override only in explicitly disposable non-hosted environments', () => {
    const env = {
      JOIN_RATE_LIMIT_MAX: '100',
      NOKMEL_DISPOSABLE_TEST_ENV: '1',
    } as unknown as NodeJS.ProcessEnv;
    expect(resolveJoinRateLimitConfig(env).max).toBe(100);
    expect(resolveJoinRateLimitConfig({ ...env, VERCEL_ENV: 'preview' } as unknown as NodeJS.ProcessEnv).max).toBe(5);
    expect(resolveJoinRateLimitConfig({ ...env, VERCEL_ENV: 'production' } as unknown as NodeJS.ProcessEnv).max).toBe(5);
    expect(resolveJoinRateLimitConfig({ JOIN_RATE_LIMIT_MAX: '100' } as unknown as NodeJS.ProcessEnv).max).toBe(5);
    expect(resolveJoinRateLimitConfig({ ...env, JOIN_RATE_LIMIT_MAX: '-1' } as unknown as NodeJS.ProcessEnv).max).toBe(5);
  });
});

describe('join origin and request identity policy', () => {
  it('requires exact trusted origins when configured', () => {
    const policy = resolveJoinOriginPolicy(baseEnv);
    expect(policy.configured).toBe(true);
    expect(checkJoinRequestOrigin(new Headers({ origin: 'https://nokmel.tech' }), policy).ok).toBe(true);
    expect(checkJoinRequestOrigin(new Headers({ origin: 'https://preview.example' }), policy).ok).toBe(true);
    expect(checkJoinRequestOrigin(new Headers({ origin: 'https://attacker.example' }), policy).ok).toBe(false);
    expect(checkJoinRequestOrigin(new Headers({ origin: 'https://nokmel.tech/evil' }), policy).ok).toBe(false);
    expect(
      checkJoinRequestOrigin(
        new Headers({ origin: 'https://nokmel.tech', 'sec-fetch-site': 'cross-site' }),
        policy,
      ).ok,
    ).toBe(false);
  });

  it('fails closed when origin configuration is missing, even without an Origin header', () => {
    const policy = resolveJoinOriginPolicy({} as unknown as NodeJS.ProcessEnv);
    expect(policy.configured).toBe(false);
    expect(checkJoinRequestOrigin(new Headers({ origin: 'https://nokmel.tech' }), policy).ok).toBe(false);
    expect(checkJoinRequestOrigin(new Headers(), policy).ok).toBe(false);
  });

  it('rejects an invalid origin configuration (wildcard)', () => {
    const policy = resolveJoinOriginPolicy({
      ...baseEnv,
      TRUSTED_ORIGINS: 'https://*.vercel.app',
    } as unknown as NodeJS.ProcessEnv);
    expect(policy.configured).toBe(false);
    expect(checkJoinRequestOrigin(new Headers(), policy).ok).toBe(false);
  });

  it('requires a valid HMAC secret and never falls back to a constant', () => {
    expect(resolveJoinHmacSecret({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(
      resolveJoinHmacSecret({ BETTER_AUTH_SECRET: 'short' } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(
      resolveJoinHmacSecret({
        BETTER_AUTH_SECRET: '  synthetic-secret-0123456789abcdef0123456789  ',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe('synthetic-secret-0123456789abcdef0123456789');
    expect(() => deriveJoinBucketKey('203.0.113.7', '')).toThrow();
    expect(() => deriveJoinBucketKey('203.0.113.7', 'short')).toThrow();
  });

  it('uses only single-value parseable forwarded identities and never stores raw values', () => {
    expect(resolveForwardedIdentity(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe(
      '203.0.113.7',
    );
    expect(
      resolveForwardedIdentity(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })),
    ).toBe('unknown');
    expect(resolveForwardedIdentity(new Headers({ 'x-forwarded-for': '203.0.113.7,' }))).toBe(
      'unknown',
    );
    expect(resolveForwardedIdentity(new Headers({ 'x-forwarded-for': '203.0.113.7,, ' }))).toBe(
      'unknown',
    );
    expect(resolveForwardedIdentity(new Headers({ 'x-forwarded-for': 'spoofed' }))).toBe('unknown');
    expect(resolveForwardedIdentity(new Headers())).toBe('unknown');
    const secret = resolveJoinHmacSecret(baseEnv);
    if (!secret) throw new Error('synthetic secret missing');
    const key = deriveJoinBucketKey('203.0.113.7', secret);
    expect(key.startsWith('join-intake:v1:')).toBe(true);
    expect(key).not.toContain('203.0.113.7');
    expect(key).toBe(deriveJoinBucketKey('203.0.113.7', secret));
    expect(key).not.toBe(deriveJoinBucketKey('203.0.113.8', secret));
  });
});
