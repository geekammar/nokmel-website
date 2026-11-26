import { AnalyticsConsent } from '@/components/analytics/AnalyticsConsent';
import { AnalyticsTracker } from '@/components/analytics/AnalyticsTracker';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ar } from '@/i18n/messages/ar';
import { loadPublicTrackingGate } from '@/lib/analytics/service';

/**
 * Public pages render per request so a published CMS change is visible
 * immediately without a deployment. The published loader performs at most two
 * small queries per page and always falls back to approved defaults; no
 * cross-request content cache is maintained.
 */
export const dynamic = 'force-dynamic';

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const tracking = await loadPublicTrackingGate();
  return (
    <>
      <a
        href="#main-content"
        className="skip-link rounded-control bg-action-primary-bg px-4 py-2 text-sm font-semibold"
        style={{ color: 'var(--action-primary-fg)' }}
      >
        {ar.common.skipLink}
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      {tracking.enabled && tracking.measurementId && tracking.tagBase ? (
        <>
          <AnalyticsConsent />
          <AnalyticsTracker
            measurementId={tracking.measurementId}
            tagBase={tracking.tagBase}
          />
        </>
      ) : null}
    </>
  );
}
