'use client';

import { useEffect, useState } from 'react';
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  readStoredConsent,
  storeAnalyticsConsent,
  type AnalyticsConsent,
} from '@/lib/analytics/tracking';

const buttonClass =
  'inline-flex min-h-control items-center justify-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background disabled:cursor-not-allowed disabled:opacity-60';

export function AnalyticsPreferences({ available }: { available: boolean }) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);

  useEffect(() => {
    setConsent(readStoredConsent());
    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<{ consent?: unknown }>).detail;
      if (detail?.consent === 'granted' || detail?.consent === 'denied') {
        setConsent(detail.consent);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) {
        setConsent(readStoredConsent());
      }
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  if (!available) return null;

  const status =
    consent === 'granted'
      ? 'التحليلات مسموحة حالياً.'
      : consent === 'denied'
        ? 'التحليلات مرفوضة حالياً.'
        : 'لم تحدد تفضيل التحليلات بعد.';

  return (
    <div data-testid="analytics-preferences" className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="analytics-preferences-panel"
        data-testid="analytics-preferences-toggle"
        className={`${buttonClass} w-fit`}
      >
        تفضيلات التحليلات
      </button>
      {open ? (
        <section
          id="analytics-preferences-panel"
          aria-label="تفضيلات تحليلات الموقع"
          className="max-w-xl rounded-card border border-border-subtle bg-surface p-4"
        >
          <p className="text-sm font-semibold text-text-primary" data-testid="analytics-preferences-status">
            {status}
          </p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            التحليلات اختيارية. رفضها لا يمنعك من استخدام الموقع أو إرسال طلب
            الانضمام. لا يؤثر الرفض على بيانات أُرسلت إلى Google قبل الرفض.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={consent === 'granted'}
              onClick={() => storeAnalyticsConsent('granted')}
              data-testid="analytics-preferences-grant"
            >
              السماح بالتحليلات
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={consent === 'denied'}
              onClick={() => storeAnalyticsConsent('denied')}
              data-testid="analytics-preferences-deny"
            >
              رفض التحليلات
            </button>
            <button
              type="button"
              className="inline-flex min-h-control items-center justify-center rounded-control px-4 text-sm font-semibold text-action-secondary underline-offset-4 hover:underline"
              onClick={() => setOpen(false)}
            >
              إغلاق
            </button>
          </div>
          {consent === 'denied' ? (
            <div className="mt-3 rounded-control border-s-4 border-status-warning bg-background p-3">
              <p className="text-xs leading-6 text-text-primary">
                أوقفنا إرسال أحداث التحليلات التي يولّدها الموقع. قد تبقى أداة
                Google المحمّلة في هذه الصفحة حتى إعادة تحميلها؛ إعادة التحميل
                لن تعيد التتبع لأن اختيارك محفوظ.
              </p>
              <button
                type="button"
                className={`${buttonClass} mt-2`}
                onClick={() => window.location.reload()}
                data-testid="analytics-preferences-reload"
              >
                إعادة تحميل الصفحة لإيقاف الأداة
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
