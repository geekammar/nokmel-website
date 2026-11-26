import { createSign } from 'node:crypto';
import { z } from 'zod';
import {
  GA4_READONLY_SCOPE,
  reportingConfigReady,
  resolveAnalyticsReportingConfig,
  type AnalyticsReportingConfig,
} from './config';
import { PUBLIC_TRACKING_ROUTES, sanitizePublicPathname } from './tracking';

/**
 * Google Analytics 4 Data API adapter (W5).
 *
 * Official references:
 * - https://developers.google.com/analytics/devguides/reporting/data/v1
 * - https://developers.google.com/analytics/devguides/reporting/data/v1/basics
 * - https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
 * - https://developers.google.com/analytics/devguides/reporting/data/v1/quotas
 *
 * Only aggregate report calls are made server-side. The service account uses
 * the read-only `analytics.readonly` scope. Four bounded reports per dashboard
 * load (summary, public pages, sources, conversion events) plus one token
 * request. No real provider is called from CI; disposable tests use a local
 * stub through explicitly gated endpoint overrides.
 */

export type AnalyticsDateRange = { startDate: string; endDate: string };

export type AnalyticsTotals = {
  totalUsers: number;
  sessions: number;
  screenPageViews: number;
  sessionConversionRate: number | null;
};

export type AnalyticsReport = {
  totals: AnalyticsTotals;
  topPages: Array<{ path: string; pageViews: number }>;
  pricingPageViews: number | null;
  joinPageViews: number | null;
  sources: Array<{ sourceMedium: string; sessions: number }>;
  events: {
    joinCtaClicks: number;
    joinRequestSuccess: number;
  } | null;
  partial: boolean;
  warnings: string[];
  fetchedAt: string;
  cached: boolean;
};

export type AnalyticsProviderFailureReason =
  | 'configuration'
  | 'auth'
  | 'quota'
  | 'timeout'
  | 'network'
  | 'provider'
  | 'invalid_response';

export type AnalyticsProviderResult =
  | { status: 'ok'; report: AnalyticsReport }
  | { status: 'unavailable'; reason: AnalyticsProviderFailureReason };

type FetchLike = typeof fetch;

class ProviderError extends Error {
  reason: AnalyticsProviderFailureReason;
  constructor(reason: AnalyticsProviderFailureReason) {
    super(reason);
    this.name = 'AnalyticsProviderError';
    this.reason = reason;
  }
}

const REPORT_SCHEMA_VERSION = 1;
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

type TokenCacheEntry = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenCacheEntry>();

type ReportCacheEntry = { report: AnalyticsReport; expiresAt: number };
const reportCache = new Map<string, ReportCacheEntry>();

const gaResponseSchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            dimensionValues: z
              .array(z.object({ value: z.string() }))
              .optional(),
            metricValues: z.array(z.object({ value: z.string() })).optional(),
          })
          .passthrough(),
      )
      .optional(),
    error: z
      .object({
        code: z.number().optional(),
        message: z.string().optional(),
        status: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

type GaResponse = z.infer<typeof gaResponseSchema>;

function base64url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function fetchAccessToken(
  config: Extract<AnalyticsReportingConfig, { status: 'ready' }>,
  fetchImpl: FetchLike,
): Promise<string> {
  const cacheKey = `${config.clientEmail}|${config.tokenEndpoint}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: GA4_READONLY_SCOPE,
      aud: config.tokenEndpoint,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const signingInput = `${header}.${payload}`;
  let assertion: string;
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    assertion = `${signingInput}.${base64url(signer.sign(config.privateKey))}`;
  } catch {
    throw new ProviderError('configuration');
  }

  let response: Response;
  try {
    response = await fetchImpl(config.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    throw new ProviderError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network');
  }

  let rawText: string;
  try {
    rawText = await response.text();
  } catch {
    throw new ProviderError('network');
  }
  if (!response.ok) {
    if (response.status === 429) throw new ProviderError('quota');
    if (response.status === 401 || response.status === 403) throw new ProviderError('auth');
    throw new ProviderError('provider');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ProviderError('invalid_response');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { access_token?: unknown }).access_token !== 'string'
  ) {
    throw new ProviderError('invalid_response');
  }
  const expiresIn = Number((parsed as { expires_in?: unknown }).expires_in);
  const token = (parsed as { access_token: string }).access_token;
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000,
  });
  return token;
}

async function runReport(
  config: Extract<AnalyticsReportingConfig, { status: 'ready' }>,
  body: Record<string, unknown>,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<GaResponse> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${config.apiBase}/v1beta/properties/${config.propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      },
    );
  } catch (error) {
    throw new ProviderError(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network');
  }

  let rawText: string;
  try {
    rawText = await response.text();
  } catch {
    throw new ProviderError('network');
  }
  if (!response.ok) {
    if (response.status === 429) throw new ProviderError('quota');
    if (response.status === 401 || response.status === 403) throw new ProviderError('auth');
    throw new ProviderError('provider');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ProviderError('invalid_response');
  }
  const validated = gaResponseSchema.safeParse(parsed);
  if (!validated.success || validated.data.error) {
    throw new ProviderError('invalid_response');
  }
  return validated.data;
}

function metricNumber(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new ProviderError('invalid_response');
  return parsed;
}

function optionalMetricNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new ProviderError('invalid_response');
  return parsed;
}

function assertRange(range: AnalyticsDateRange): void {
  if (!DATE_PATTERN.test(range.startDate) || !DATE_PATTERN.test(range.endDate)) {
    throw new ProviderError('configuration');
  }
}

const TOP_PAGE_VALUES = PUBLIC_TRACKING_ROUTES.flatMap((route) =>
  route === '/' ? ['/', ''] : [route, `${route}/`],
);

function parseTopPages(response: GaResponse): Array<{ path: string; pageViews: number }> {
  const byPath = new Map<string, number>();
  for (const row of response.rows ?? []) {
    const rawPath = row.dimensionValues?.[0]?.value;
    const pageViews = metricNumber(row.metricValues?.[0]?.value);
    const path = sanitizePublicPathname(rawPath);
    if (!path) continue;
    byPath.set(path, (byPath.get(path) ?? 0) + pageViews);
  }
  return [...byPath.entries()]
    .map(([path, pageViews]) => ({ path, pageViews }))
    .sort((a, b) => b.pageViews - a.pageViews);
}

function parseSources(response: GaResponse): Array<{ sourceMedium: string; sessions: number }> {
  const rows: Array<{ sourceMedium: string; sessions: number }> = [];
  for (const row of response.rows ?? []) {
    const source = row.dimensionValues?.[0]?.value?.trim();
    if (!source) continue;
    rows.push({
      sourceMedium: source.slice(0, 100),
      sessions: metricNumber(row.metricValues?.[0]?.value),
    });
  }
  return rows.slice(0, 10);
}

function parseEvents(response: GaResponse): { joinCtaClicks: number; joinRequestSuccess: number } {
  let joinCtaClicks = 0;
  let joinRequestSuccess = 0;
  for (const row of response.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value;
    const count = metricNumber(row.metricValues?.[0]?.value);
    if (name === 'join_cta_click') joinCtaClicks += count;
    if (name === 'join_request_success') joinRequestSuccess += count;
  }
  return { joinCtaClicks, joinRequestSuccess };
}

async function fetchReport(
  config: Extract<AnalyticsReportingConfig, { status: 'ready' }>,
  range: AnalyticsDateRange,
  fetchImpl: FetchLike,
): Promise<AnalyticsReport> {
  assertRange(range);
  const accessToken = await fetchAccessToken(config, fetchImpl);
  const dateRanges = [{ startDate: range.startDate, endDate: range.endDate }];

  const [summary, pages, sources, events] = await Promise.allSettled([
    runReport(
      config,
      {
        dateRanges,
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'sessionConversionRate' },
        ],
        limit: 1,
      },
      accessToken,
      fetchImpl,
    ),
    runReport(
      config,
      {
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            inListFilter: { values: TOP_PAGE_VALUES, caseSensitive: true },
          },
        },
        limit: 50,
      },
      accessToken,
      fetchImpl,
    ),
    runReport(
      config,
      {
        dateRanges,
        dimensions: [{ name: 'sessionSourceMedium' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      },
      accessToken,
      fetchImpl,
    ),
    runReport(
      config,
      {
        dateRanges,
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: ['join_cta_click', 'join_request_success'],
              caseSensitive: true,
            },
          },
        },
        limit: 10,
      },
      accessToken,
      fetchImpl,
    ),
  ]);

  if (summary.status === 'rejected') throw summary.reason;
  const summaryRow = summary.value.rows?.[0];
  if (!summaryRow || !summaryRow.metricValues || summaryRow.metricValues.length < 4) {
    throw new ProviderError('invalid_response');
  }
  const totals: AnalyticsTotals = {
    totalUsers: metricNumber(summaryRow.metricValues[0]?.value),
    sessions: metricNumber(summaryRow.metricValues[1]?.value),
    screenPageViews: metricNumber(summaryRow.metricValues[2]?.value),
    sessionConversionRate: optionalMetricNumber(summaryRow.metricValues[3]?.value),
  };

  const warnings: string[] = [];
  let topPages: Array<{ path: string; pageViews: number }> = [];
  let pricingPageViews: number | null = null;
  let joinPageViews: number | null = null;
  if (pages.status === 'fulfilled') {
    const allPages = parseTopPages(pages.value);
    pricingPageViews = allPages
      .filter((page) => page.path === '/pricing')
      .reduce((sum, page) => sum + page.pageViews, 0);
    joinPageViews = allPages
      .filter((page) => page.path === '/join')
      .reduce((sum, page) => sum + page.pageViews, 0);
    topPages = allPages.slice(0, 7);
  } else {
    warnings.push('pages');
  }

  let sourceRows: Array<{ sourceMedium: string; sessions: number }> = [];
  if (sources.status === 'fulfilled') {
    sourceRows = parseSources(sources.value);
  } else {
    warnings.push('sources');
  }

  let eventCounts: AnalyticsReport['events'] = null;
  if (events.status === 'fulfilled') {
    eventCounts = parseEvents(events.value);
  } else {
    warnings.push('events');
  }

  return {
    totals,
    topPages,
    pricingPageViews,
    joinPageViews,
    sources: sourceRows,
    events: eventCounts,
    partial: warnings.length > 0,
    warnings,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };
}

export type AnalyticsFetchOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: FetchLike;
  now?: () => number;
};

export async function getAnalyticsReport(
  range: AnalyticsDateRange,
  options: AnalyticsFetchOptions = {},
): Promise<AnalyticsProviderResult> {
  const env = options.env ?? process.env;
  const config = resolveAnalyticsReportingConfig(env);
  if (!reportingConfigReady(config)) {
    return { status: 'unavailable', reason: 'configuration' };
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const cacheKey = [
    config.propertyId,
    config.clientEmail,
    config.apiBase,
    range.startDate,
    range.endDate,
    REPORT_SCHEMA_VERSION,
  ].join('|');
  const cached = reportCache.get(cacheKey);
  if (cached && cached.expiresAt > now()) {
    return { status: 'ok', report: { ...cached.report, cached: true } };
  }
  try {
    const report = await fetchReport(config, range, fetchImpl);
    if (!report.partial) {
      reportCache.set(cacheKey, { report, expiresAt: now() + CACHE_TTL_MS });
    }
    return { status: 'ok', report };
  } catch (error) {
    const reason =
      error instanceof ProviderError ? error.reason : 'provider';
    return { status: 'unavailable', reason };
  }
}

export function clearAnalyticsReportCache(): void {
  reportCache.clear();
  tokenCache.clear();
}
