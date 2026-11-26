'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminNotificationUi, adminRequestsUi } from '@/content/ar/admin-requests';
import type { JoinNotificationStatus } from '@/lib/notifications/service';
import { formatCairoDateTime } from '@/lib/plans/promotion';
import { retryRequestNotificationAction } from '../actions';

const secondaryButton =
  'inline-flex min-h-control items-center justify-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background disabled:cursor-not-allowed disabled:opacity-60';

type Banner = { kind: 'success' | 'error' | 'warning'; text: string } | null;

function stateLabel(state: JoinNotificationStatus['state']): string {
  return adminNotificationUi.states[state ?? 'none'];
}

function errorLabel(code: string | null): string | null {
  if (!code) return null;
  const known = adminNotificationUi.errorLabels as Record<string, string>;
  return known[code] ?? adminNotificationUi.errorLabels.unknown;
}

function timestamp(value: string | null): string {
  if (!value) return adminRequestsUi.notProvided;
  return `${formatCairoDateTime(value) ?? value} (Africa/Cairo)`;
}

export function NotificationStatusPanel({
  id,
  notification,
}: {
  id: string;
  notification: JoinNotificationStatus;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    setBanner(null);
    try {
      const result = await retryRequestNotificationAction({ id });
      if (!result.ok) {
        setBanner({ kind: 'error', text: result.message });
        return;
      }
      const outcome = result.data;
      if (outcome.status === 'sent') {
        setBanner({ kind: 'success', text: adminNotificationUi.retrySuccess });
        router.refresh();
        return;
      }
      if (outcome.status === 'uncertain') {
        setBanner({ kind: 'warning', text: adminNotificationUi.retryUncertain });
        router.refresh();
        return;
      }
      if (outcome.status === 'skipped' && outcome.reason === 'disabled') {
        setBanner({ kind: 'error', text: adminNotificationUi.retryDisabled });
        return;
      }
      if (outcome.status === 'already_sent') {
        setBanner({ kind: 'warning', text: adminNotificationUi.alreadySent });
        return;
      }
      if (outcome.status === 'in_progress') {
        setBanner({ kind: 'warning', text: adminNotificationUi.retryInProgress });
        return;
      }
      if (outcome.status === 'not_attempted') {
        setBanner({ kind: 'warning', text: adminNotificationUi.retryNotAttempted });
        return;
      }
      if (outcome.status === 'failed') {
        setBanner({ kind: 'error', text: adminNotificationUi.retryFailed });
        router.refresh();
        return;
      }
      setBanner({ kind: 'warning', text: adminNotificationUi.retryFailed });
      router.refresh();
    } catch {
      setBanner({ kind: 'error', text: adminNotificationUi.retryFailed });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section
      aria-labelledby="request-notification-title"
      data-testid="request-notification"
      className="mt-4 rounded-card border border-border-subtle bg-surface p-4"
    >
      <h2 id="request-notification-title" className="text-base font-bold text-text-primary">
        {adminNotificationUi.title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-text-secondary">
        {adminNotificationUi.description}
      </p>

      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <div>
          <dt className="font-semibold text-text-secondary">الحالة</dt>
          <dd className="text-text-primary" data-testid="request-notification-state">
            {stateLabel(notification.state)}
          </dd>
        </div>
        {notification.state === 'sent' ? (
          <div>
            <dt className="font-semibold text-text-secondary">
              {adminNotificationUi.deliveredAt}
            </dt>
            <dd className="text-text-primary" dir="ltr">
              {timestamp(notification.deliveredAt)}
            </dd>
          </div>
        ) : null}
        {notification.attemptedAt ? (
          <div>
            <dt className="font-semibold text-text-secondary">
              {adminNotificationUi.attemptedAt}
            </dt>
            <dd className="text-text-primary" dir="ltr">
              {timestamp(notification.attemptedAt)}
            </dd>
          </div>
        ) : null}
        {notification.errorCode ? (
          <div>
            <dt className="font-semibold text-text-secondary">
              {adminNotificationUi.errorCode}
            </dt>
            <dd className="break-words text-text-primary">
              {errorLabel(notification.errorCode)}
            </dd>
          </div>
        ) : null}
      </dl>

      {notification.mayDuplicate ? (
        <p
          role="note"
          className="mt-3 rounded-card border-s-4 border-status-warning bg-background p-3 text-xs leading-6 text-text-primary"
        >
          {adminNotificationUi.duplicateWarning}
        </p>
      ) : null}

      {notification.canRetry ? (
        <button
          type="button"
          className={`${secondaryButton} mt-3`}
          onClick={handleRetry}
          disabled={retrying}
          data-testid="request-notification-retry"
        >
          {retrying ? adminNotificationUi.retrying : adminNotificationUi.retry}
        </button>
      ) : null}

      {banner ? (
        <p
          role={banner.kind === 'success' ? 'status' : 'alert'}
          data-testid="request-notification-banner"
          className={`mt-3 rounded-card border-s-4 p-3 text-sm leading-6 ${
            banner.kind === 'success'
              ? 'border-status-success bg-background text-text-primary'
              : banner.kind === 'warning'
                ? 'border-status-warning bg-background text-text-primary'
                : 'border-status-error bg-background text-text-primary'
          }`}
        >
          {banner.text}
        </p>
      ) : null}
    </section>
  );
}
