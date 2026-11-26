'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  ANALYTICS_EVENT,
  buildSanitizedPageView,
  parseConsent,
  sanitizeAnalyticsEvent,
  sanitizePublicPathname,
} from '@/lib/analytics/tracking';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Consent-gated GA4 public tracker (W5-B). The script is loaded only after an
 * explicit stored consent decision. Admin, login, preview, API and request
 * detail routes never include this component. Only allowlisted public paths
 * and event names are sent; no query strings, URLs, request IDs or personal
 * data are included. Advertising features and Google Signals are disabled.
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
  const lastPageRef = useRef<string | null>(null);
  const pathRef = useRef(pathname);

  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;

    function gtag(...args: unknown[]) {
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push(args);
    }

    function trackPage() {
      if (cancelled || !loadedRef.current) return;
      const path = sanitizePublicPathname(pathRef.current);
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
      window.gtag?.('event', 'page_view', pageView);
    }

    function eventPageParams(): { page_location: string; page_referrer: string } | null {
      return buildSanitizedPageView({
        origin: window.location.origin,
        pathname: pathRef.current,
        referrer: document.referrer,
      });
    }

    function load() {
      if (cancelled || loadedRef.current) return;
      loadedRef.current = true;
      window.dataLayer = window.dataLayer ?? [];
      window.gtag = window.gtag ?? gtag;
      const script = document.createElement('script');
      script.async = true;
      script.src = `${tagBase}/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
      window.gtag?.('js', new Date());
      window.gtag?.('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'granted',
      });
      window.gtag?.('config', measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      lastPageRef.current = null;
      trackPage();
    }

    function hasConsent(): boolean {
      try {
        return parseConsent(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)) === 'granted';
      } catch {
        return false;
      }
    }

    function onConsent(event: Event) {
      const detail = (event as CustomEvent<{ consent?: unknown }>).detail;
      if (detail?.consent === 'granted' && hasConsent()) load();
    }

    function onCustomEvent(event: Event) {
      if (!loadedRef.current) return;
      const detail = (event as CustomEvent<{ name?: unknown; from?: unknown }>).detail;
      const sanitized = sanitizeAnalyticsEvent(detail?.name, { from: detail?.from });
      if (!sanitized) return;
      const page = eventPageParams();
      window.gtag?.('event', sanitized.name, {
        ...sanitized.params,
        ...(page ?? {}),
      });
    }

    function onClick(event: MouseEvent) {
      if (!loadedRef.current) return;
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
      const sanitized = sanitizeAnalyticsEvent('join_cta_click', { from: from ?? undefined });
      if (!sanitized) return;
      const page = eventPageParams();
      window.gtag?.('event', sanitized.name, {
        ...sanitized.params,
        ...(page ?? {}),
      });
    }

    if (hasConsent()) load();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    window.addEventListener(ANALYTICS_EVENT, onCustomEvent);
    document.addEventListener('click', onClick);
    return () => {
      cancelled = true;
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
      window.removeEventListener(ANALYTICS_EVENT, onCustomEvent);
      document.removeEventListener('click', onClick);
    };
  }, [measurementId, tagBase]);

  useEffect(() => {
    if (!loadedRef.current) return;
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
    window.gtag?.('event', 'page_view', pageView);
  }, [pathname]);

  return null;
}
