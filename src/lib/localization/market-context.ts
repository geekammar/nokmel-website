/**
 * Localization boundary for illustrative product data.
 *
 * A market is deliberately separate from a locale and a currency: the country
 * identifies the market, the locale controls presentation, and the ISO currency
 * controls minor-unit conversion. This slice has one supported default market
 * and performs no GeoIP, country detection, visitor tracking or conversion.
 *
 * Future explicit market resolution (for example an approved owner-selected
 * market or a per-market plan availability record) can add markets here without
 * changing the visual data model: callers pass the resolved MarketContext
 * explicitly to the demo model.
 */

export type MarketContext = {
  countryCode: string;
  locale: string;
  currency: string;
};

export const DEFAULT_MARKET: MarketContext = Object.freeze({
  countryCode: 'EG',
  locale: 'ar-EG',
  currency: 'EGP',
});

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export function isMarketContext(value: unknown): value is MarketContext {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.countryCode === 'string' &&
    COUNTRY_CODE_PATTERN.test(record.countryCode) &&
    typeof record.locale === 'string' &&
    record.locale.length > 0 &&
    typeof record.currency === 'string' &&
    CURRENCY_CODE_PATTERN.test(record.currency)
  );
}
