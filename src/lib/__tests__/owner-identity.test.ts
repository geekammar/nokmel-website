import { afterEach, describe, expect, test } from 'vitest';
import { configuredOwnerEmail, isOwnerEmail } from '@/lib/owner-identity';

describe('owner identity normalization (fail closed)', () => {
  const original = process.env.OWNER_EMAIL;

  afterEach(() => {
    if (original === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = original;
  });

  test('compares normalized email identity', () => {
    process.env.OWNER_EMAIL = 'Owner@Nokmel.Tech';
    expect(isOwnerEmail('owner@nokmel.tech')).toBe(true);
    expect(isOwnerEmail('  OWNER@nokmel.tech  ')).toBe(true);
    expect(isOwnerEmail('someone.else@nokmel.tech')).toBe(false);
  });

  test('unconfigured owner email authorizes nobody', () => {
    delete process.env.OWNER_EMAIL;
    expect(configuredOwnerEmail()).toBeNull();
    expect(isOwnerEmail('owner@nokmel.tech')).toBe(false);
  });

  test('unconfigured owner email is treated as missing rather than defaulted', () => {
    process.env.OWNER_EMAIL = '   ';
    expect(configuredOwnerEmail()).toBeNull();
  });
});
