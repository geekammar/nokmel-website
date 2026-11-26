import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  clearAnalyticsReportCache,
  getAnalyticsReport,
} from '@/lib/analytics/ga4';
import {
  resolveAnalyticsReportingConfig,
  resolveAnalyticsTrackingConfig,
} from '@/lib/analytics/config';
import {
  buildSanitizedPageView,
  isAnalyticsCookieName,
  sanitizeAnalyticsEvent,
  sanitizePageLocation,
  sanitizePageReferrer,
  sanitizePublicPathname,
} from '@/lib/analytics/tracking';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const baseEnv = {
  GA4_PROPERTY_ID: '123456789',
  GA4_CLIENT_EMAIL: 'reporter@nokmel.iam.gserviceaccount.com',
  GA4_PRIVATE_KEY: privateKey,
  GA4_MEASUREMENT_ID: 'G-TEST12345',
  BETTER_AUTH_URL: 'https://nokmel.tech',
} as unknown as NodeJS.ProcessEnv;

type ReportBody = { dimensions?: Array<{ name: string }>; metrics?: Array<{ name: string }> };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeGaFetch(options: {
  failPages?: boolean;
  failSummary?: boolean;
  failToken?: boolean;
  failConversion?: boolean;
} = {}) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/token')) {
      if (options.failToken) return jsonResponse({ error: 'invalid_grant' }, 401);
      return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
    }
    const body = JSON.parse(String(init?.body ?? '{}')) as ReportBody;
    const dimension = body.dimensions?.[0]?.name;
    const metric = body.metrics?.[0]?.name;
    if (metric?.startsWith('sessionKeyEventRate:')) {
      if (options.failConversion) {
        return jsonResponse({ error: { code: 400, message: 'unknown metric' } }, 400);
      }
      return jsonResponse({
        rows: [{ metricValues: [{ value: '0.25' }] }],
      });
    }
    if (!dimension) {
      if (options.failSummary) return jsonResponse({ error: { code: 500 } }, 500);
      return jsonResponse({
        rows: [
          {
            metricValues: [
              { value: '10' },
              { value: '20' },
              { value: '30' },
            ],
          },
        ],
      });
    }
    if (dimension === 'pagePath') {
      if (options.failPages) return jsonResponse({ error: { code: 500 } }, 500);
      return jsonResponse({
        rows: [
          { dimensionValues: [{ value: '/' }], metricValues: [{ value: '5' }] },
          { dimensionValues: [{ value: '/pricing' }], metricValues: [{ value: '4' }] },
          { dimensionValues: [{ value: '/join' }], metricValues: [{ value: '3' }] },
          { dimensionValues: [{ value: '/admin' }], metricValues: [{ value: '99' }] },
        ],
      });
    }
    if (dimension === 'sessionSourceMedium') {
      return jsonResponse({
        rows: [
          { dimensionValues: [{ value: 'google / organic' }], metricValues: [{ value: '12' }] },
        ],
      });
    }
    if (dimension === 'eventName') {
      return jsonResponse({
        rows: [
          { dimensionValues: [{ value: 'join_cta_click' }], metricValues: [{ value: '2' }] },
          {
            dimensionValues: [{ value: 'join_request_success' }],
            metricValues: [{ value: '1' }],
          },
        ],
      });
    }
    return jsonResponse({ error: { code: 400 } }, 400);
  };
}

beforeEach(() => {
  clearAnalyticsReportCache();
});

describe('GA4 configuration', () => {
  test('reports not configured, invalid and ready states without exposing secrets', () => {
    expect(resolveAnalyticsReportingConfig({} as NodeJS.ProcessEnv)).toEqual({
      status: 'not_configured',
      reason: 'credentials',
    });
    expect(
      resolveAnalyticsReportingConfig({
        ...baseEnv,
        GA4_PROPERTY_ID: 'not-a-property',
      }),
    ).toEqual({ status: 'invalid', reason: 'property_id' });
    expect(
      resolveAnalyticsReportingConfig({ ...baseEnv, GA4_PRIVATE_KEY: 'bad-key' }),
    ).toEqual({ status: 'invalid', reason: 'private_key' });
    const ready = resolveAnalyticsReportingConfig(baseEnv);
    expect(ready.status).toBe('ready');
    if (ready.status === 'ready') {
      expect(ready.propertyId).toBe('123456789');
      expect(ready.apiBase).toBe('https://analyticsdata.googleapis.com');
      expect(ready.clientEmail).toContain('@nokmel.iam.gserviceaccount.com');
    }
  });

  test('endpoint overrides are ignored outside disposable test runs', () => {
    const config = resolveAnalyticsReportingConfig({
      ...baseEnv,
      GA4_API_BASE_URL: 'http://127.0.0.1:3300',
      VERCEL_ENV: 'preview',
    });
    expect(config.status).toBe('ready');
    if (config.status === 'ready') {
      expect(config.apiBase).toBe('https://analyticsdata.googleapis.com');
    }
    const testConfig = resolveAnalyticsReportingConfig({
      ...baseEnv,
      GA4_API_BASE_URL: 'http://127.0.0.1:3300',
      NOKMEL_DISPOSABLE_TEST_ENV: '1',
    });
    if (testConfig.status === 'ready') {
      expect(testConfig.apiBase).toBe('http://127.0.0.1:3300');
    }
  });

  test('measurement id is validated separately from reporting credentials', () => {
    expect(resolveAnalyticsTrackingConfig({} as NodeJS.ProcessEnv)).toEqual({
      status: 'not_configured',
      reason: 'measurement_id',
    });
    expect(resolveAnalyticsTrackingConfig({ GA4_MEASUREMENT_ID: 'UA-123' } as unknown as NodeJS.ProcessEnv)).toEqual({
      status: 'invalid',
      reason: 'measurement_id',
    });
    expect(
      resolveAnalyticsTrackingConfig({ GA4_MEASUREMENT_ID: 'G-ABC12345' } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      status: 'ready',
      measurementId: 'G-ABC12345',
      tagBase: 'https://www.googletagmanager.com',
    });
  });
});

describe('tracking payload sanitization', () => {
  test('only the seven known public routes are accepted', () => {
    expect(sanitizePublicPathname('/pricing')).toBe('/pricing');
    expect(sanitizePublicPathname('/pricing/')).toBe('/pricing');
    expect(sanitizePublicPathname('/pricing?x=secret')).toBe('/pricing');
    expect(sanitizePublicPathname('/admin')).toBeNull();
    expect(sanitizePublicPathname('/admin/requests/123')).toBeNull();
    expect(sanitizePublicPathname('https://nokmel.tech/pricing')).toBeNull();
    expect(sanitizePublicPathname('/unknown')).toBeNull();
    expect(sanitizePublicPathname('')).toBeNull();
  });

  test('page locations never carry query strings, fragments or unknown routes', () => {
    expect(sanitizePageLocation('https://nokmel.tech', '/pricing?utm_source=secret')).toBe(
      'https://nokmel.tech/pricing',
    );
    expect(sanitizePageLocation('https://nokmel.tech', '/join#phone')).toBe(
      'https://nokmel.tech/join',
    );
    expect(sanitizePageLocation('https://nokmel.tech', '/admin/requests/secret')).toBeNull();
    expect(sanitizePageLocation('https://nokmel.tech', '/unknown?email=a@b.c')).toBeNull();
    expect(sanitizePageLocation('javascript:alert(1)', '/')).toBeNull();
    expect(sanitizePageLocation('https://user:pass@nokmel.tech', '/')).toBeNull();
    expect(sanitizePageLocation('ftp://nokmel.tech', '/')).toBeNull();
  });

  test('referrers are reduced to safe same-origin routes or an external origin', () => {
    expect(
      sanitizePageReferrer('https://nokmel.tech/pricing?phone=secret', 'https://nokmel.tech'),
    ).toBe('https://nokmel.tech/pricing');
    expect(
      sanitizePageReferrer(
        'https://nokmel.tech/admin/requests/private-id',
        'https://nokmel.tech',
      ),
    ).toBeNull();
    expect(
      sanitizePageReferrer(
        'https://google.com/search?q=private+query',
        'https://nokmel.tech',
      ),
    ).toBe('https://google.com/');
    expect(sanitizePageReferrer('javascript:alert(1)', 'https://nokmel.tech')).toBeNull();
    expect(sanitizePageReferrer('', 'https://nokmel.tech')).toBeNull();
  });

  test('pageview payload contains only sanitized location and referrer', () => {
    expect(
      buildSanitizedPageView({
        origin: 'https://nokmel.tech',
        pathname: '/join?plan=secret&phone=+2010',
        referrer: 'https://nokmel.tech/pricing?utm=secret',
      }),
    ).toEqual({
      page_location: 'https://nokmel.tech/join',
      page_referrer: 'https://nokmel.tech/pricing',
    });
    expect(
      buildSanitizedPageView({
        origin: 'https://nokmel.tech',
        pathname: '/join',
        referrer: null,
      }),
    ).toEqual({
      page_location: 'https://nokmel.tech/join',
      page_referrer: '',
    });
    expect(
      buildSanitizedPageView({
        origin: 'https://nokmel.tech',
        pathname: '/admin',
        referrer: null,
      }),
    ).toBeNull();
  });

  test('only known first-party analytics cookies are cleared on withdrawal', () => {
    expect(isAnalyticsCookieName('_ga')).toBe(true);
    expect(isAnalyticsCookieName('_ga_ABC123')).toBe(true);
    expect(isAnalyticsCookieName('_gid')).toBe(true);
    expect(isAnalyticsCookieName('nokmel.analytics-consent.v1')).toBe(false);
    expect(isAnalyticsCookieName('_gac_123')).toBe(false);
    expect(isAnalyticsCookieName('session')).toBe(false);
  });

  test('event names and payload keys are allowlisted', () => {
    expect(sanitizeAnalyticsEvent('join_cta_click', { from: '/pricing' })).toEqual({
      name: 'join_cta_click',
      params: { from: '/pricing' },
    });
    expect(sanitizeAnalyticsEvent('join_cta_click', { from: '/admin' })).toEqual({
      name: 'join_cta_click',
      params: {},
    });
    expect(sanitizeAnalyticsEvent('join_request_success')).toEqual({
      name: 'join_request_success',
      params: {},
    });
    expect(sanitizeAnalyticsEvent('purchase', { from: '/pricing' })).toBeNull();
    const withExtra = { from: '/x', email: 'a@b.c' };
    expect(sanitizeAnalyticsEvent('join_cta_click', withExtra)).toEqual({
      name: 'join_cta_click',
      params: {},
    });
  });
});

describe('GA4 aggregate reports', () => {
  test('validates and maps the documented reports', async () => {
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      { env: baseEnv, fetchImpl: fakeGaFetch() as unknown as typeof fetch },
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.report.totals).toEqual({
      totalUsers: 10,
      sessions: 20,
      screenPageViews: 30,
    });
    expect(result.report.topPages).toEqual([
      { path: '/', pageViews: 5 },
      { path: '/pricing', pageViews: 4 },
      { path: '/join', pageViews: 3 },
    ]);
    expect(result.report.pricingPageViews).toBe(4);
    expect(result.report.joinPageViews).toBe(3);
    expect(result.report.events).toEqual({ joinCtaClicks: 2, joinRequestSuccess: 1 });
    expect(result.report.conversion).toEqual({ status: 'available', rate: 0.25 });
    expect(result.report.sources).toEqual([
      { sourceMedium: 'google / organic', sessions: 12 },
    ]);
    expect(result.report.partial).toBe(false);
  });

  test('the generic session conversion rate is never requested or labelled as join conversion', async () => {
    const requestedMetrics: string[] = [];
    let reportCalls = 0;
    const wrapped = fakeGaFetch();
    const trackingFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.endsWith('/token')) {
        reportCalls += 1;
        const body = JSON.parse(String(init?.body ?? '{}')) as ReportBody;
        for (const metric of body.metrics ?? []) requestedMetrics.push(metric.name);
      }
      return wrapped(input, init);
    }) as unknown as typeof fetch;
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      { env: baseEnv, fetchImpl: trackingFetch },
    );
    expect(result.status).toBe('ok');
    expect(requestedMetrics).not.toContain('sessionConversionRate');
    expect(requestedMetrics).toContain('sessionKeyEventRate:join_request_success');
    expect(reportCalls).toBeLessThanOrEqual(5);
  });

  test('a malformed optional conversion response is unavailable while traffic stays valid', async () => {
    const wrapped = fakeGaFetch();
    const malformedConversionFetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (!url.endsWith('/token')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as ReportBody;
        if (body.metrics?.[0]?.name === 'sessionKeyEventRate:join_request_success') {
          return jsonResponse({
            rows: [{ metricValues: [{ value: 'not-a-number' }] }],
          });
        }
      }
      return wrapped(input, init);
    }) as unknown as typeof fetch;
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      { env: baseEnv, fetchImpl: malformedConversionFetch },
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.report.totals.totalUsers).toBe(10);
    expect(result.report.conversion).toEqual({
      status: 'unavailable',
      reason: 'invalid_response',
    });
  });

  test('an unavailable event-specific conversion does not hide valid traffic totals', async () => {
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      {
        env: baseEnv,
        fetchImpl: fakeGaFetch({ failConversion: true }) as unknown as typeof fetch,
      },
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.report.totals).toEqual({
      totalUsers: 10,
      sessions: 20,
      screenPageViews: 30,
    });
    expect(result.report.events).toEqual({ joinCtaClicks: 2, joinRequestSuccess: 1 });
    expect(result.report.conversion).toEqual({
      status: 'unavailable',
      reason: 'provider',
    });
    expect(result.report.partial).toBe(false);
  });

  test('a documented zero is a real zero, while a missing report stays unknown', async () => {
    const zeroFetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(_input);
      if (url.endsWith('/token')) {
        return jsonResponse({ access_token: 'test-access-token', expires_in: 3600 });
      }
      const body = JSON.parse(String(init?.body ?? '{}')) as ReportBody;
      if (!body.dimensions?.[0]?.name) {
        return jsonResponse({
          rows: [
            {
              metricValues: [
                { value: '0' },
                { value: '0' },
                { value: '0' },
              ],
            },
          ],
        });
      }
      return jsonResponse({ rows: [] });
    };
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      { env: baseEnv, fetchImpl: zeroFetch as unknown as typeof fetch },
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.report.totals).toEqual({
      totalUsers: 0,
      sessions: 0,
      screenPageViews: 0,
    });
    expect(result.report.pricingPageViews).toBe(0);
    expect(result.report.joinPageViews).toBe(0);
    expect(result.report.events).toEqual({ joinCtaClicks: 0, joinRequestSuccess: 0 });
    expect(result.report.conversion).toEqual({
      status: 'unavailable',
      reason: 'not_configured',
    });
  });

  test('a dimensional report failure yields an honest partial result', async () => {
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      { env: baseEnv, fetchImpl: fakeGaFetch({ failPages: true }) as unknown as typeof fetch },
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.report.partial).toBe(true);
    expect(result.report.warnings).toContain('pages');
    expect(result.report.pricingPageViews).toBeNull();
    expect(result.report.totals.totalUsers).toBe(10);
  });

  test('malformed provider data is rejected, not rendered', async () => {
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      { env: baseEnv, fetchImpl: fakeGaFetch({ failSummary: true }) as unknown as typeof fetch },
    );
    expect(result).toEqual({ status: 'unavailable', reason: 'provider' });
  });

  test('authentication failure is reported without leaking errors', async () => {
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      { env: baseEnv, fetchImpl: fakeGaFetch({ failToken: true }) as unknown as typeof fetch },
    );
    expect(result).toEqual({ status: 'unavailable', reason: 'auth' });
  });

  test('timeouts are bounded and reported as unavailable', async () => {
    const timeoutFetch = async (): Promise<Response> => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      throw error;
    };
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      { env: baseEnv, fetchImpl: timeoutFetch as unknown as typeof fetch },
    );
    expect(result).toEqual({ status: 'unavailable', reason: 'timeout' });
  });

  test('the provider is not called when credentials are not configured', async () => {
    let called = false;
    const result = await getAnalyticsReport(
      { startDate: '2026-11-20', endDate: '2026-11-26' },
      {
        env: {} as unknown as NodeJS.ProcessEnv,
        fetchImpl: (async () => {
          called = true;
          return jsonResponse({});
        }) as unknown as typeof fetch,
      },
    );
    expect(called).toBe(false);
    expect(result).toEqual({ status: 'unavailable', reason: 'configuration' });
  });
});
