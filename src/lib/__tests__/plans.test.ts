import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  formatPriceMinor,
  normalizeNumericInputDigits,
  parsePriceInput,
  planPriceLabel,
  planSlugSchema,
  priceInputFromMinor,
  validatePlanForm,
  type PlanFormValues,
} from '@/lib/plans/model';

const baseValues: PlanFormValues = {
  name: 'باقة البداية',
  description: 'باقة تعريفية لمرحلة الانضمام المبكر.',
  features: ['متابعة الطلبات', 'كتالوج المنتجات'],
  monthlyPrice: '199.00',
  yearlyPrice: '',
  currency: 'EGP',
  ctaLabel: 'اطلب الانضمام',
  featured: false,
  displayOrder: 1,
};

describe('plan slug validation', () => {
  it('accepts stable URL-safe slugs and rejects unsafe values', () => {
    expect(planSlugSchema.parse('starter-plan')).toBe('starter-plan');
    expect(planSlugSchema.parse('plan2')).toBe('plan2');
    for (const invalid of ['Starter', 'plan_1', '-plan', 'plan-', 'plan--x', 'خطة', 'a', 'x'.repeat(61)]) {
      expect(planSlugSchema.safeParse(invalid).success).toBe(false);
    }
  });
});

describe('exact price parsing and formatting', () => {
  it('distinguishes no price from an explicit zero price', () => {
    expect(parsePriceInput('', 'EGP')).toEqual({ ok: true, minor: null });
    expect(parsePriceInput('   ', 'EGP')).toEqual({ ok: true, minor: null });
    expect(parsePriceInput('0', 'EGP')).toEqual({ ok: true, minor: 0 });
    expect(parsePriceInput('0.00', 'EGP')).toEqual({ ok: true, minor: 0 });
  });

  it('converts major units to exact minor units without floating point', () => {
    expect(parsePriceInput('199', 'EGP')).toEqual({ ok: true, minor: 19_900 });
    expect(parsePriceInput('199.9', 'EGP')).toEqual({ ok: true, minor: 19_990 });
    expect(parsePriceInput('199.99', 'EGP')).toEqual({ ok: true, minor: 19_999 });
    expect(parsePriceInput('1.234', 'KWD')).toEqual({ ok: true, minor: 1_234 });
    expect(parsePriceInput('99999999.99', 'EGP')).toEqual({ ok: true, minor: 9_999_999_999 });
  });

  it('accepts Arabic-Indic and extended Arabic-Indic digits', () => {
    expect(normalizeNumericInputDigits('١٩٩٫٥٠')).toBe('199٫50');
    expect(parsePriceInput('١٩٩٫٥٠', 'EGP')).toEqual({ ok: true, minor: 19_950 });
    expect(parsePriceInput('۱۹۹', 'EGP')).toEqual({ ok: true, minor: 19_900 });
  });

  it('rejects negative, malformed, excessive-precision and oversized amounts', () => {
    for (const invalid of ['-1', '1,200', '1.2.3', 'abc', '+5', '1.999', '99999999999']) {
      expect(parsePriceInput(invalid, 'EGP').ok, invalid).toBe(false);
    }
  });

  it('formats exact minor units with the currency exponent', () => {
    expect(formatPriceMinor(19_900, 'EGP')).toBe('199.00 EGP');
    expect(formatPriceMinor(123_456, 'KWD')).toBe('123.456 KWD');
    expect(formatPriceMinor(0, 'EGP')).toBe('0.00 EGP');
    expect(formatPriceMinor(1_250_000, 'SAR')).toBe('12,500.00 SAR');
    expect(formatPriceMinor(null, 'EGP')).toBeNull();
    expect(priceInputFromMinor(19_950, 'EGP')).toBe('199.50');
    expect(priceInputFromMinor(null, 'EGP')).toBe('');
  });

  it('uses monthly price first and falls back to yearly without inventing discounts', () => {
    expect(
      planPriceLabel({ monthlyPriceMinor: 19_900, yearlyPriceMinor: 199_000, currency: 'EGP' }),
    ).toBe('199.00 EGP');
    expect(
      planPriceLabel({ monthlyPriceMinor: null, yearlyPriceMinor: 199_000, currency: 'EGP' }),
    ).toBe('1,990.00 EGP');
    expect(
      planPriceLabel({ monthlyPriceMinor: null, yearlyPriceMinor: null, currency: 'EGP' }),
    ).toBeNull();
  });
});

describe('plan form validation', () => {
  it('accepts a valid plan and normalizes prices', () => {
    const result = validatePlanForm(baseValues);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.monthlyPriceMinor).toBe(19_900);
    expect(result.values.yearlyPriceMinor).toBeNull();
    expect(result.values.features).toEqual(['متابعة الطلبات', 'كتالوج المنتجات']);
  });

  it('allows a plan without any numerical price and a featured flag', () => {
    const result = validatePlanForm({
      ...baseValues,
      monthlyPrice: '',
      yearlyPrice: '',
      featured: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.monthlyPriceMinor).toBeNull();
    expect(result.values.featured).toBe(true);
  });

  it('rejects a yearly price without a monthly price', () => {
    const result = validatePlanForm({
      ...baseValues,
      monthlyPrice: '',
      yearlyPrice: '1990',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.yearlyPrice).toBeTruthy();
  });

  it('requires an explicit supported currency and rejects unknown fields', () => {
    expect(validatePlanForm({ ...baseValues, currency: '' }).ok).toBe(false);
    const unsafe = { ...baseValues, currency: 'USD' };
    expect(validatePlanForm(unsafe).ok).toBe(false);
    const extra = { ...baseValues, entitlement: 'all' };
    expect(validatePlanForm(extra).ok).toBe(false);
  });

  it('enforces feature/text limits and display order bounds', () => {
    expect(
      validatePlanForm({ ...baseValues, features: ['x'.repeat(PLAN_LIMITS.feature + 1)] }).ok,
    ).toBe(false);
    expect(
      validatePlanForm({
        ...baseValues,
        features: new Array(PLAN_LIMITS.features + 1).fill('ميزة'),
      }).ok,
    ).toBe(false);
    expect(validatePlanForm({ ...baseValues, name: '' }).ok).toBe(false);
    expect(validatePlanForm({ ...baseValues, displayOrder: -1 }).ok).toBe(false);
    expect(validatePlanForm({ ...baseValues, displayOrder: PLAN_LIMITS.displayOrder + 1 }).ok).toBe(
      false,
    );
  });
});
