'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  ANALYTICS_EVENT,
  buildSanitizedPageView,
  clearFirstPartyAnalyticsCookies,
  parseConsent,
  readStoredConsent,
  sanitizeAnalyticsEvent,
  sanitizePublicPathname,
} from '@/lib/analytics/tracking';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const CONSENT_DENIED = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
} as const;

const CONSENT_GRANTED = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'granted',
} as const;

function setGaDisabled(measurementId: string, disabled: boolean): void {
  (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] =
    disabled;
}

/**
 * Consent-gated GA4 public tracker (W5-B/R03/R04).
 *
 * - No tag, dataLayer, cookie or event is created before explicit consent.
 * - Only the seven public routes are used. Page location/referrer are sanitized
 *   and also set as tag-level defaults so automatic events cannot inherit the
 *   raw query string.
 * - Withdrawal stops application-generated events immediately, updates Consent
 *   Mode, sets the documented ga-disable flag, and expires accessible
 *   first-party analytics cookies. A controlled reload is offered by the
 *   preferences UI to fully unload an already-loaded tag.
 * - The public layout unmounts on protected/admin navigation; cleanup disables
 *   the measurement property as an additional boundary. External GA4 property
 *   settings must still be verified (see docs/W5_INTEGRATIONS.md).
 */
export function AnalyticsTracker({
  measurementId,
  tagBase,
}: {
  measurementId: string;
  tagBase: string;
}) {
  const pathname = usePathname();
  const loadedRef = useRef(false);
  const consentGrantedRef = useRef(false);
  const lastPageRef = useRef<string | null>(null);
  const pathRef = useRef(pathname);

  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;

    function gtag(...args: unknown[]) {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push(args);
    }

    function currentPageView() {
      const previous = lastPageRef.current;
      const origin = window.location.origin;
      return buildSanitizedPageView({
        origin,
        pathname: pathRef.current,
        referrer: previous ? `${origin}${previous}` : document.referrer,
      });
    }

    function trackPage() {
      if (cancelled || !loadedRef.current || !consentGrantedRef.current) return;
      const path = sanitizePublicPathname(pathRef.current);
      if (!path || lastPageRef.current === path) return;
      const pageView = currentPageView();
      if (!pageView) return;
      lastPageRef.current = path;
      window.gtag?.('set', pageView);
      window.gtag?.('event', 'page_view', pageView);
    }

    function ensureTagLoaded() {
      if (cancelled) return;
      const wasGranted = loadedRef.current && consentGrantedRef.current;
      window.dataLayer = window.dataLayer ?? [];
      const gtagFn = window.gtag ?? gtag;
      window.gtag = gtagFn;
      setGaDisabled(measurementId, false);

      const pageView = currentPageView();
      const existing = document.querySelector(
        `script[data-nokmel-ga="${measurementId}"]`,
      );
      if (!existing) {
        gtagFn('consent', 'default', CONSENT_DENIED);
        gtagFn('set', {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          ads_data_redaction: true,
          url_passthrough: false,
          ...(pageView ?? {}),
        });
        const script = document.createElement('script');
        script.async = true;
        script.src = `${tagBase}/gtag/js?id=${encodeURIComponent(measurementId)}`;
        script.dataset.nokmelGa = measurementId;
        document.head.appendChild(script);
        gtagFn('js', new Date());
        gtagFn('config', measurementId, {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          ...(pageView ?? {}),
        });
      }
      gtagFn('consent', 'update', CONSENT_GRANTED);
      loadedRef.current = true;
      consentGrantedRef.current = true;
      if (!wasGranted) {
        lastPageRef.current = null;
        trackPage();
      }
    }

    function applyConsent(consent: 'granted' | 'denied' | null) {
      if (cancelled) return;
      if (consent === 'granted') {
        ensureTagLoaded();
        return;
      }
      consentGrantedRef.current = false;
      setGaDisabled(measurementId, true);
      clearFirstPartyAnalyticsCookies();
      if (loadedRef.current) {
        window.gtag?.('consent', 'update', CONSENT_DENIED);
      }
    }

    function onConsent(event: Event) {
      const detail = (event as CustomEvent<{ consent?: unknown }>).detail;
      if (detail?.consent === 'granted' || detail?.consent === 'denied') {
        applyConsent(detail.consent);
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
        applyConsent(parseConsent(event.newValue));
      }
    }

    function onCustomEvent(event: Event) {
      if (!loadedRef.current || !consentGrantedRef.current) return;
      const detail = (event as CustomEvent<{ name?: unknown; from?: unknown }>).detail;
      const sanitized = sanitizeAnalyticsEvent(detail?.name, { from: detail?.from });
      if (!sanitized) return;
      const page = currentPageView();
      window.gtag?.('event', sanitized.name, {
        ...sanitized.params,
        ...(page ?? {}),
      });
    }

    function onClick(event: MouseEvent) {
      if (!loadedRef.current || !consentGrantedRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor) return;
      let path: string | null = null;
      try {
        const url = new URL(anchor.getAttribute('href') ?? '', window.location.origin);
        if (url.origin !== window.location.origin) return;
        path = sanitizePublicPathname(url.pathname);
      } catch {
        return;
      }
      if (path !== '/join') return;
      const from = sanitizePublicPathname(pathRef.current);
      const sanitized = sanitizeAnalyticsEvent('join_cta_click', {
        from: from ?? undefined,
      });
      if (!sanitized) return;
      const page = currentPageView();
      window.gtag?.('event', sanitized.name, {
        ...sanitized.params,
        ...(page ?? {}),
      });
    }

    if (readStoredConsent() === 'granted') ensureTagLoaded();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    window.addEventListener('storage', onStorage);
    window.addEventListener(ANALYTICS_EVENT, onCustomEvent);
    document.addEventListener('click', onClick);
    return () => {
      cancelled = true;
      consentGrantedRef.current = false;
      // Safe boundary if the public layout unmounts for admin/protected routes.
      setGaDisabled(measurementId, true);
      window.gtag?.('consent', 'update', CONSENT_DENIED);
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ANALYTICS_EVENT, onCustomEvent);
      document.removeEventListener('click', onClick);
    };
  }, [measurementId, tagBase]);

  useEffect(() => {
    if (!loadedRef.current || !consentGrantedRef.current) return;
    const path = sanitizePublicPathname(pathname);
    if (!path || lastPageRef.current === path) return;
    const previous = lastPageRef.current;
    const origin = window.location.origin;
    const pageView = buildSanitizedPageView({
      origin,
      pathname: path,
      referrer: previous ? `${origin}${previous}` : document.referrer,
    });
    if (!pageView) return;
    lastPageRef.current = path;
    window.gtag?.('set', pageView);
    window.gtag?.('event', 'page_view', pageView);
  }, [pathname]);

  return null;
}
