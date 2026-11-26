import { describe, expect, it } from 'vitest';
import {
  JOIN_LIMITS,
  normalizePhone,
  parseJoinSubmission,
  sanitizeJoinSource,
  sanitizePlanQuery,
  sanitizeUtmValue,
} from '@/lib/join/validation';

const baseSubmission = {
  name: 'أحمد التاجر',
  phone: '01012345678',
  countryCode: '+20',
  email: '',
  businessActivity: '',
  source: 'pricing',
  submissionToken: 'synthetic-token-0123456789',
};

describe('phone normalization', () => {
  it('normalizes an Egyptian local number with an explicit calling code', () => {
    expect(normalizePhone('01012345678', '+20')).toEqual({
      ok: true,
      phone: '+201012345678',
    });
    expect(normalizePhone('١٠١٢٣٤٥٦٧٨', '+20')).toEqual({
      ok: true,
      phone: '+201012345678',
    });
    expect(normalizePhone('010 1234 5678', 'EG')).toEqual({
      ok: true,
      phone: '+201012345678',
    });
  });

  it('accepts explicit international numbers and 00 prefixes', () => {
    expect(normalizePhone('+966501234567', '')).toEqual({
      ok: true,
      phone: '+966501234567',
    });
    expect(normalizePhone('00966501234567', '')).toEqual({
      ok: true,
      phone: '+966501234567',
    });
    expect(normalizePhone('٠٠٩٦٦٥٠١٢٣٤٥٦٧', '')).toEqual({
      ok: true,
      phone: '+966501234567',
    });
  });

  it('does not guess a country for an ambiguous local number', () => {
    const result = normalizePhone('01012345678', '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('رمز الدولة');
  });

  it('rejects malformed numbers, letters and unsupported calling codes', () => {
    for (const value of ['abc', '++201012345678', '+20 10', '+', '123']) {
      expect(normalizePhone(value, '+20').ok, value).toBe(false);
    }
    expect(normalizePhone('01012345678', '+999').ok).toBe(false);
  });
});

describe('join submission validation', () => {
  it('accepts minimal required identity fields and normalizes phone/email', () => {
    const result = parseJoinSubmission({
      ...baseSubmission,
      email: ' Merchant@Example.COM ',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.submission.phone).toBe('+201012345678');
    expect(result.submission.email).toBe('merchant@example.com');
    expect(result.submission.businessActivity).toBeNull();
    expect(result.submission.source).toBe('pricing');
  });

  it('accepts an optional plan only with its effective-offer version', () => {
    const withPlan = parseJoinSubmission({
      ...baseSubmission,
      planSlug: 'starter-plan',
      offerVersion: 'w41-0123456789abcdef',
    });
    expect(withPlan.ok).toBe(true);
    if (withPlan.ok) {
      expect(withPlan.submission.planSlug).toBe('starter-plan');
      expect(withPlan.submission.offerVersion).toBe('w41-0123456789abcdef');
    }
    const missingVersion = parseJoinSubmission({
      ...baseSubmission,
      planSlug: 'starter-plan',
    });
    expect(missingVersion.ok).toBe(false);
    const versionWithoutPlan = parseJoinSubmission({
      ...baseSubmission,
      offerVersion: 'w41-0123456789abcdef',
    });
    expect(versionWithoutPlan.ok).toBe(false);
  });

  it('rejects administrative/client-controlled fields and oversized values', () => {
    for (const field of ['status', 'notes', 'id', 'createdAt', 'planNameSnapshot', 'price']) {
      expect(parseJoinSubmission({ ...baseSubmission, [field]: 'injected' }).ok, field).toBe(
        false,
      );
    }
    expect(
      parseJoinSubmission({ ...baseSubmission, businessActivity: 'x'.repeat(JOIN_LIMITS.businessActivity + 1) }).ok,
    ).toBe(false);
    expect(
      parseJoinSubmission({ ...baseSubmission, name: 'x'.repeat(JOIN_LIMITS.name + 1) }).ok,
    ).toBe(false);
    expect(parseJoinSubmission({ ...baseSubmission, email: 'not-an-email' }).ok).toBe(false);
    expect(
      parseJoinSubmission({ ...baseSubmission, submissionToken: 'short' }).ok,
    ).toBe(false);
  });

  it('treats acquisition parameters as bounded untrusted input', () => {
    const result = parseJoinSubmission({
      ...baseSubmission,
      source: 'attacker-controlled',
      utmSource: 'x'.repeat(JOIN_LIMITS.utm + 1),
      utmMedium: 'cpc',
      utmCampaign: 'launch-2026',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.submission.source).toBe('direct');
    expect(result.submission.utmSource).toBeNull();
    expect(result.submission.utmMedium).toBe('cpc');
    expect(result.submission.utmCampaign).toBe('launch-2026');
    expect(sanitizeUtmValue('<script>')).toBeNull();
    expect(sanitizeUtmValue('ok_value-1')).toBe('ok_value-1');
  });

  it('sanitizes plan/source query values without throwing on repeats or malformed input', () => {
    expect(sanitizePlanQuery('starter-plan')).toBe('starter-plan');
    expect(sanitizePlanQuery('INVALID')).toBeNull();
    expect(sanitizePlanQuery(['starter', 'pro'])).toBeNull();
    expect(sanitizePlanQuery('%3Cscript%3E')).toBeNull();
    expect(sanitizeJoinSource('pricing')).toBe('pricing');
    expect(sanitizeJoinSource(['pricing'])).toBe('direct');
    expect(sanitizeJoinSource('evil')).toBe('direct');
  });
});
