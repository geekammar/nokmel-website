'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  parseConsent,
  type AnalyticsConsent as ConsentValue,
} from '@/lib/analytics/tracking';

export function AnalyticsConsent() {
  const [decision, setDecision] = useState<ConsentValue | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDecision(parseConsent(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)));
    } catch {
      setDecision(null);
    }
    setReady(true);
  }, []);

  function decide(value: ConsentValue) {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
    } catch {
      // Storage may be unavailable; the in-page decision still applies.
    }
    setDecision(value);
    window.dispatchEvent(
      new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: { consent: value } }),
    );
  }

  if (!ready || decision !== null) return null;

  return (
    <div
      role="region"
      aria-label="موافقة التحليلات"
      data-testid="analytics-consent"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-card border border-border-subtle bg-surface p-4 shadow-lg"
    >
      <p className="text-sm leading-6 text-text-primary">
        نستخدم تحليلات زيارات مجهولة الهوية (Google Analytics) لفهم استخدام الموقع
        وتحسينه. لا نرسل بيانات التواصل أو الطلبات إلى خدمة التحليلات.
      </p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">
        لن تُحمَّل التحليلات قبل موافقتك. يمكنك الرفض والمتابعة بشكل طبيعي.{' '}
        <Link href="/privacy" className="font-semibold text-action-secondary underline-offset-4 hover:underline">
          سياسة الخصوصية
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide('granted')}
          data-testid="analytics-consent-accept"
          className="min-h-control rounded-control bg-action-primary-bg px-4 text-sm font-semibold text-action-primary-fg"
        >
          موافقة
        </button>
        <button
          type="button"
          onClick={() => decide('denied')}
          data-testid="analytics-consent-decline"
          className="min-h-control rounded-control border border-border-interactive bg-transparent px-4 text-sm font-semibold text-text-primary"
        >
          رفض
        </button>
      </div>
    </div>
  );
}
