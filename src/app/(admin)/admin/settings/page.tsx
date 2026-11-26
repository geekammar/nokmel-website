import type { Metadata } from 'next';
import Link from 'next/link';
import { adminSettingsUi } from '@/content/ar/admin-settings';
import { analyticsConfigurationSummary } from '@/lib/analytics/service';
import { resolveTelegramConfig } from '@/lib/notifications/config';
import { requireOwner } from '@/lib/owner';
import { pageMetadata } from '@/lib/seo';
import { publicSettingsFormFrom } from '@/lib/settings/model';
import { loadOwnerSettings } from '@/lib/settings/service';
import { SettingsForms } from './SettingsForms';

export const metadata: Metadata = pageMetadata({
  title: adminSettingsUi.sectionTitle,
  description: adminSettingsUi.sectionDescription,
  path: '/admin/settings',
});

export const dynamic = 'force-dynamic';

function formatTimestamp(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export default async function AdminSettingsPage() {
  const [owner, result] = await Promise.all([requireOwner(), loadOwnerSettings()]);
  const analyticsSummary = analyticsConfigurationSummary();
  const telegram = resolveTelegramConfig();
  const telegramServerConfigured = telegram.status === 'configured';

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {adminSettingsUi.sectionTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            {adminSettingsUi.sectionDescription}
          </p>
        </div>
        <Link
          href="/contact"
          className="text-sm font-semibold text-action-secondary underline-offset-4 hover:underline"
        >
          {adminSettingsUi.publicPageLink}
        </Link>
      </div>

      {result.status !== 'ok' ? (
        <div
          role="alert"
          className="mt-5 rounded-card border-s-4 border-status-warning bg-surface p-4"
        >
          <h2 className="text-base font-bold text-text-primary">
            {adminSettingsUi.storageTitle}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {adminSettingsUi.storageUnavailable}
          </p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{result.message}</p>
        </div>
      ) : (
        <div className="mt-5">
          <SettingsForms
            initialPublic={publicSettingsFormFrom(result.settings.public)}
            publicRevision={result.settings.publicRevision}
            initialNotificationsEnabled={result.settings.notificationsEnabled}
            initialChatId={result.settings.telegramChatId}
            notificationRevision={result.settings.notificationRevision}
            initialAnalyticsEnabled={result.settings.analyticsEnabled}
            analyticsRevision={result.settings.analyticsRevision}
            telegramServerConfigured={telegramServerConfigured}
            destinationMasked={result.settings.telegramChatIdMasked}
            botUsername={result.settings.telegramBotUsername}
            botName={result.settings.telegramBotName}
            lastTestAt={result.settings.lastNotificationTestAt}
            analyticsSummary={analyticsSummary}
          />
        </div>
      )}

      <section className="mt-5 rounded-card border border-border-subtle bg-surface p-5">
        <h2 className="text-lg font-bold text-text-primary">
          {adminSettingsUi.ownerGroup.title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {adminSettingsUi.ownerGroup.description}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-text-secondary">
              {adminSettingsUi.ownerGroup.name}
            </dt>
            <dd className="text-text-primary">{owner.user.name}</dd>
          </div>
          <div>
            <dt className="font-semibold text-text-secondary">
              {adminSettingsUi.ownerGroup.email}
            </dt>
            <dd className="break-all text-text-primary" dir="ltr">
              {owner.user.email}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-secondary">
              {adminSettingsUi.ownerGroup.sessionExpires}
            </dt>
            <dd className="text-text-primary" dir="ltr">
              {formatTimestamp(owner.session.expiresAt)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-secondary">
              {adminSettingsUi.ownerGroup.accountCreated}
            </dt>
            <dd className="text-text-primary" dir="ltr">
              {formatTimestamp(owner.user.createdAt)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-text-secondary">
          {adminSettingsUi.ownerGroup.securityNote}
        </p>
      </section>
    </div>
  );
}
