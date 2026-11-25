import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  DEFAULT_SIGN_IN_COOLDOWN_SECONDS,
  parseRetryAfterSeconds,
  remainingCooldownSeconds,
  resolveSignInCooldownSeconds,
} from '@/lib/login-cooldown';

afterEach(() => {
  vi.useRealTimers();
});

describe('sign-in cooldown policy', () => {
  test('uses a valid server retry value when available', () => {
    expect(parseRetryAfterSeconds('30')).toBe(30);
    expect(resolveSignInCooldownSeconds(30)).toBe(30);
    expect(resolveSignInCooldownSeconds(2)).toBe(2);
  });

  test('falls back to the conservative configured window when retry timing is absent or invalid', () => {
    expect(DEFAULT_SIGN_IN_COOLDOWN_SECONDS).toBe(60);
    for (const value of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveSignInCooldownSeconds(value)).toBe(60);
    }
    for (const header of [null, '', '0', '-3', '1.5', 'soon', 'Wed, 21 Oct 2015 07:28:00 GMT']) {
      expect(parseRetryAfterSeconds(header)).toBeNull();
    }
  });

  test('caps pathological retry values without creating a permanent lockout', () => {
    expect(parseRetryAfterSeconds('999999')).toBe(300);
    expect(resolveSignInCooldownSeconds(999999)).toBe(300);
  });

  test('remaining time uses controlled clock values and never goes negative', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T15:00:00Z'));
    const now = Date.now();
    expect(remainingCooldownSeconds(now + 60_000, now)).toBe(60);
    expect(remainingCooldownSeconds(now + 2_500, now)).toBe(3);
    vi.setSystemTime(new Date(now + 61_000));
    expect(remainingCooldownSeconds(now + 60_000, Date.now())).toBe(0);
  });
});
