import type { MarketContext } from './market-context';

/**
 * Locale-aware money formatting for illustrative marketing data.
 *
 * Amounts are exact integer minor units. The currency's ISO minor-unit
 * exponent is read from Intl instead of a hand-maintained table, so currencies
 * with three fractional digits behave correctly. Latin numbering is used so
 * prices stay legible and deterministic in the Arabic UI, while the currency
 * symbol and group separators still come from the market locale.
 *
 * This is a presentation formatter only. It performs no conversion and does
 * not replace the authoritative website plan-price formatter.
 */

const fractionDigitsCache = new Map<string, number>();
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
let supportedCurrencyCodes: Set<string> | null = null;

function supportedCurrencies(): Set<string> {
  if (supportedCurrencyCodes) return supportedCurrencyCodes;
  supportedCurrencyCodes = new Set(
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('currency')
      : [],
  );
  return supportedCurrencyCodes;
}

function isSupportedCurrency(currency: string): boolean {
  if (!CURRENCY_CODE_PATTERN.test(currency)) return false;
  const supported = supportedCurrencies();
  return supported.size === 0 || supported.has(currency);
}

export function currencyFractionDigits(currency: string): number {
  if (!isSupportedCurrency(currency)) {
    throw new RangeError('Invalid ISO currency code');
  }
  const cached = fractionDigitsCache.get(currency);
  if (cached !== undefined) return cached;
  const resolved = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits;
  const digits = resolved ?? 2;
  fractionDigitsCache.set(currency, digits);
  return digits;
}

export function formatMoneyMinor(
  minor: number,
  market: MarketContext,
  options: { minimumFractionDigits?: number } = {},
): string {
  if (!Number.isSafeInteger(minor)) {
    throw new Error('Invalid minor-unit amount');
  }
  const exponent = currencyFractionDigits(market.currency);
  const major = minor / 10 ** exponent;
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
    numberingSystem: 'latn',
    minimumFractionDigits: Math.min(options.minimumFractionDigits ?? 0, exponent),
    maximumFractionDigits: exponent,
  }).format(major);
}
