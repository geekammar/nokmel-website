import { describe, expect, it } from 'vitest';
import { currencyFractionDigits, formatMoneyMinor } from '@/lib/localization/format-money';
import { DEFAULT_MARKET, isMarketContext } from '@/lib/localization/market-context';

describe('market context', () => {
  it('exposes the Egyptian default market without coupling locale to currency', () => {
    expect(DEFAULT_MARKET).toEqual({ countryCode: 'EG', locale: 'ar-EG', currency: 'EGP' });
    expect(isMarketContext(DEFAULT_MARKET)).toBe(true);
    expect(isMarketContext({ countryCode: 'EG', locale: 'ar-EG', currency: 'egp' })).toBe(false);
    expect(isMarketContext({ countryCode: 'Egypt', locale: 'ar-EG', currency: 'EGP' })).toBe(
      false,
    );
  });
});

describe('Intl minor-unit money formatter', () => {
  it('formats EGP minor units using the market locale', () => {
    expect(currencyFractionDigits('EGP')).toBe(2);
    const formatted = formatMoneyMinor(65_000, DEFAULT_MARKET);
    expect(formatted).toContain('650');
    expect(formatted).toContain('ج.م');
    expect(formatted).not.toContain('650.00');
  });

  it('respects three-fractional-digit currencies', () => {
    expect(currencyFractionDigits('KWD')).toBe(3);
    const kuwait = { countryCode: 'KW', locale: 'ar-KW', currency: 'KWD' };
    const formatted = formatMoneyMinor(123_456, kuwait);
    expect(formatted).toContain('123.456');
    expect(formatted).toContain('د.ك');
  });

  it('keeps exact whole amounts free of forced trailing zeros', () => {
    const bahrain = { countryCode: 'BH', locale: 'ar-BH', currency: 'BHD' };
    expect(formatMoneyMinor(65_000, bahrain)).toContain('65');
    expect(formatMoneyMinor(65_000, bahrain)).not.toContain('65.000');
  });

  it('rejects unsafe amounts and invalid ISO currency codes', () => {
    expect(() => formatMoneyMinor(1.5, DEFAULT_MARKET)).toThrow();
    expect(() => formatMoneyMinor(Number.MAX_SAFE_INTEGER + 1, DEFAULT_MARKET)).toThrow();
    expect(() =>
      formatMoneyMinor(100, { countryCode: 'EG', locale: 'ar-EG', currency: 'NOT' }),
    ).toThrow();
  });
});
