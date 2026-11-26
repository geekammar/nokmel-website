/**
 * Shared public analytics tracking contract (W5).
 *
 * Route identifiers are restricted to the seven known public routes. Query
 * strings, full URLs and personal data are never sent. Event names and payload
 * keys are allowlisted on the client and documented for the external setup.
 */

export const PUBLIC_TRACKING_ROUTES = [
  '/',
  '/features',
  '/pricing',
  '/join',
  '/contact',
  '/privacy',
  '/terms',
] as const;

export type PublicTrackingRoute = (typeof PUBLIC_TRACKING_ROUTES)[number];

const ROUTE_SET = new Set<string>(PUBLIC_TRACKING_ROUTES);

export const TRACKED_EVENTS = ['join_cta_click', 'join_request_success'] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

const EVENT_SET = new Set<string>(TRACKED_EVENTS);

export const ANALYTICS_CONSENT_STORAGE_KEY = 'nokmel.analytics-consent.v1';
export const ANALYTICS_CONSENT_EVENT = 'nokmel:analytics-consent';
export const ANALYTICS_EVENT = 'nokmel:analytics';

export type AnalyticsConsent = 'granted' | 'denied';

export function sanitizePublicPathname(raw: string | null | undefined): PublicTrackingRoute | null {
  if (typeof raw !== 'string') return null;
  let path = raw.trim();
  if (!path.startsWith('/')) return null;
  // Remove any accidental query/fragment before comparison.
  path = path.split('?')[0].split('#')[0];
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return ROUTE_SET.has(path) ? (path as PublicTrackingRoute) : null;
}

export type SanitizedAnalyticsEvent = {
  name: TrackedEvent;
  params: { from?: PublicTrackingRoute };
};

/**
 * Build a provider-safe `page_location`: deployment origin + one of the seven
 * allowed public paths. Query strings, fragments and unexpected routes never
 * reach GA4. Returning null means "do not send a pageview for this route".
 */
export function sanitizePageLocation(
  origin: string,
  pathname: string | null | undefined,
): string | null {
  const path = sanitizePublicPathname(pathname);
  if (!path) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    return `${parsed.origin}${path}`;
  } catch {
    return null;
  }
}

/**
 * Reduce a referrer to a safe value: a known public route on the same origin,
 * or only the external origin (no path/query). Admin/protected/preview paths
 * are never forwarded.
 */
export function sanitizePageReferrer(
  referrer: string | null | undefined,
  currentOrigin: string,
): string | null {
  if (!referrer) return null;
  try {
    const parsed = new URL(referrer);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.origin === currentOrigin) {
      const path = sanitizePublicPathname(parsed.pathname);
      return path ? `${parsed.origin}${path}` : null;
    }
    return `${parsed.origin}/`;
  } catch {
    return null;
  }
}

export type SanitizedPageView = {
  page_location: string;
  page_referrer: string;
};

export function buildSanitizedPageView(args: {
  origin: string;
  pathname: string | null | undefined;
  referrer: string | null | undefined;
}): SanitizedPageView | null {
  const pageLocation = sanitizePageLocation(args.origin, args.pathname);
  if (!pageLocation) return null;
  const pageReferrer = sanitizePageReferrer(args.referrer, args.origin);
  return { page_location: pageLocation, page_referrer: pageReferrer ?? '' };
}

/** Validates a custom browser event before it reaches the provider. */
export function sanitizeAnalyticsEvent(
  name: unknown,
  detail?: { from?: unknown },
): SanitizedAnalyticsEvent | null {
  if (typeof name !== 'string' || !EVENT_SET.has(name)) return null;
  const params: { from?: PublicTrackingRoute } = {};
  const from = sanitizePublicPathname(
    typeof detail?.from === 'string' ? detail.from : undefined,
  );
  if (from) params.from = from;
  return { name: name as TrackedEvent, params };
}

export function parseConsent(raw: string | null): AnalyticsConsent | null {
  return raw === 'granted' || raw === 'denied' ? raw : null;
}

export function readStoredConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseConsent(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeAnalyticsConsent(value: AnalyticsConsent): void {
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  } catch {
    // Storage may be unavailable; the in-page decision still applies.
  }
  window.dispatchEvent(
    new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: { consent: value } }),
  );
}

/** GA4 first-party cookies set by gtag.js on the current host. */
export function isAnalyticsCookieName(name: string): boolean {
  return name === '_ga' || name === '_gid' || name.startsWith('_ga_');
}

/**
 * Expire accessible first-party analytics cookies on the current host/path.
 * This does not claim to delete data already received by Google, nor cookies
 * set by provider code on paths/domains outside this document's control.
 */
export function clearFirstPartyAnalyticsCookies(): void {
  if (typeof document === 'undefined') return;
  const names = document.cookie
    .split(';')
    .map((entry) => entry.split('=')[0]?.trim() ?? '')
    .filter((name) => name && isAnalyticsCookieName(name));
  if (names.length === 0) return;
  const hostname = window.location.hostname;
  const domainCandidates = new Set<string>(['']);
  const labels = hostname.split('.');
  for (let index = 1; index < labels.length - 1; index += 1) {
    domainCandidates.add(labels.slice(index).join('.'));
  }
  for (const name of names) {
    for (const domain of domainCandidates) {
      const domainAttribute = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; Max-Age=0; path=/${domainAttribute}; SameSite=Lax`;
    }
  }
}
