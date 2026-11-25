import { describe, expect, test } from 'vitest';
import { resolveAuthOriginConfig } from '@/lib/auth-origins';

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe('authentication origin policy', () => {
  test('requires BETTER_AUTH_URL', () => {
    expect(() => resolveAuthOriginConfig(env({}))).toThrow(/BETTER_AUTH_URL is required/);
  });

  test('accepts an exact HTTPS origin and normalizes the trailing slash', () => {
    const config = resolveAuthOriginConfig(
      env({ BETTER_AUTH_URL: 'https://nokmel.tech/', TRUSTED_ORIGINS: 'https://nokmel.tech' }),
    );
    expect(config.baseURL).toBe('https://nokmel.tech');
    expect(config.trustedOrigins).toEqual(['https://nokmel.tech']);
  });

  test('accepts explicit loopback HTTP origins for development and tests', () => {
    for (const origin of ['http://127.0.0.1:3100', 'http://localhost:3000', 'http://[::1]:3100']) {
      const config = resolveAuthOriginConfig(env({ BETTER_AUTH_URL: origin }));
      expect(config.baseURL).toBe(origin.replace(/\/$/, ''));
    }
  });

  test('rejects plain HTTP for non-loopback hosts', () => {
    expect(() =>
      resolveAuthOriginConfig(env({ BETTER_AUTH_URL: 'http://nokmel.tech' })),
    ).toThrow(/HTTPS/);
    expect(() =>
      resolveAuthOriginConfig(
        env({ BETTER_AUTH_URL: 'https://nokmel.tech', TRUSTED_ORIGINS: 'http://preview.vercel.app' }),
      ),
    ).toThrow(/HTTPS/);
  });

  test('rejects wildcard, credential-bearing, path, query, and fragment origins', () => {
    const invalid = [
      '*',
      'https://*.vercel.app',
      'https://user:pass@nokmel.tech',
      'https://nokmel.tech/admin',
      'https://nokmel.tech?redirect=https://attacker.example',
      'https://nokmel.tech#fragment',
      'nokmel.tech',
      'ftp://nokmel.tech',
    ];
    for (const value of invalid) {
      expect(() => resolveAuthOriginConfig(env({ BETTER_AUTH_URL: value }))).toThrow();
    }
  });

  test('supports exact immutable preview aliases but never all vercel.app hosts', () => {
    const preview = 'https://nokmel-website-git-w31-owner-auth-ammarjaberd.vercel.app';
    const config = resolveAuthOriginConfig(
      env({
        BETTER_AUTH_URL: preview,
        TRUSTED_ORIGINS: `https://nokmel.tech,${preview}`,
      }),
    );
    expect(config.trustedOrigins).toEqual([preview, 'https://nokmel.tech']);

    expect(() =>
      resolveAuthOriginConfig(
        env({
          BETTER_AUTH_URL: 'https://nokmel.tech',
          TRUSTED_ORIGINS: 'https://attacker.vercel.app',
        }),
      ),
    ).not.toThrow();
    expect(() =>
      resolveAuthOriginConfig(
        env({ BETTER_AUTH_URL: 'https://nokmel.tech', TRUSTED_ORIGINS: 'https://*.vercel.app' }),
      ),
    ).toThrow(/wildcard/i);
  });

  test('rejects the implicit BETTER_AUTH_TRUSTED_ORIGINS bypass input', () => {
    expect(() =>
      resolveAuthOriginConfig(
        env({
          BETTER_AUTH_URL: 'https://nokmel.tech',
          BETTER_AUTH_TRUSTED_ORIGINS: 'https://attacker.example',
        }),
      ),
    ).toThrow(/BETTER_AUTH_TRUSTED_ORIGINS/);
  });

  test('rejects any trusted origin that is not an exact safe origin', () => {
    for (const value of ['https://attacker.example/path', 'https://user:pass@attacker.example', 'http://attacker.example']) {
      expect(() =>
        resolveAuthOriginConfig(
          env({ BETTER_AUTH_URL: 'https://nokmel.tech', TRUSTED_ORIGINS: value }),
        ),
      ).toThrow();
    }
  });
});
