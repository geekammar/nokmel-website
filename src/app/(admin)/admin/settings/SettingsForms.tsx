'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { adminSettingsUi } from '@/content/ar/admin-settings';
import {
  emptyPublicSettingsForm,
  type PublicSettingsFormValues,
} from '@/lib/settings/model';
import type { AnalyticsConfigurationSummary } from '@/lib/analytics/service';
import {
  saveAnalyticsSettingsAction,
  saveNotificationSettingsAction,
  savePublicSettingsAction,
  sendNotificationTestAction,
} from './actions';

type Banner = { kind: 'success' | 'error' | 'conflict'; text: string } | null;

const secondaryButton =
  'inline-flex min-h-control items-center justify-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background disabled:cursor-not-allowed disabled:opacity-60';

function BannerBox({
  banner,
  onReload,
}: {
  banner: Banner;
  onReload: () => void;
}) {
  if (!banner) return null;
  return (
    <div
      role={banner.kind === 'success' ? 'status' : 'alert'}
      className={`rounded-card border-s-4 p-3 text-sm leading-6 ${
        banner.kind === 'success'
          ? 'border-status-success bg-background text-text-primary'
          : banner.kind === 'conflict'
            ? 'border-status-warning bg-background text-text-primary'
            : 'border-status-error bg-background text-text-primary'
      }`}
    >
      <p>{banner.text}</p>
      {banner.kind === 'conflict' ? (
        <button type="button" className={`${secondaryButton} mt-2`} onClick={onReload}>
          {adminSettingsUi.messages.reload}
        </button>
      ) : null}
    </div>
  );
}

function GroupCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border-subtle bg-surface p-5">
      <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function SettingsForms({
  initialPublic,
  publicRevision,
  initialNotificationsEnabled,
  initialChatId,
  notificationRevision,
  initialAnalyticsEnabled,
  analyticsRevision,
  telegramServerConfigured,
  destinationMasked,
  botUsername,
  botName,
  lastTestAt,
  analyticsSummary,
}: {
  initialPublic?: PublicSettingsFormValues;
  publicRevision: number;
  initialNotificationsEnabled: boolean;
  initialChatId: string | null;
  notificationRevision: number;
  initialAnalyticsEnabled: boolean;
  analyticsRevision: number;
  telegramServerConfigured: boolean;
  destinationMasked: string | null;
  botUsername: string | null;
  botName: string | null;
  lastTestAt: string | null;
  analyticsSummary: AnalyticsConfigurationSummary;
}) {
  const router = useRouter();

  const [publicValues, setPublicValues] = useState<PublicSettingsFormValues>(
    initialPublic ?? emptyPublicSettingsForm(),
  );
  const [publicRev, setPublicRev] = useState(publicRevision);
  const [publicSaving, setPublicSaving] = useState(false);
  const [publicBanner, setPublicBanner] = useState<Banner>(null);
  const [publicErrors, setPublicErrors] = useState<Record<string, string>>({});

  const [notificationsEnabled, setNotificationsEnabled] = useState(initialNotificationsEnabled);
  const [chatId, setChatId] = useState(initialChatId ?? '');
  const [notificationRev, setNotificationRev] = useState(notificationRevision);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationBanner, setNotificationBanner] = useState<Banner>(null);
  const [notificationErrors, setNotificationErrors] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);

  const [analyticsEnabled, setAnalyticsEnabled] = useState(initialAnalyticsEnabled);
  const [analyticsRev, setAnalyticsRev] = useState(analyticsRevision);
  const [analyticsSaving, setAnalyticsSaving] = useState(false);
  const [analyticsBanner, setAnalyticsBanner] = useState<Banner>(null);

  function updatePublic<K extends keyof PublicSettingsFormValues>(
    key: K,
    value: PublicSettingsFormValues[K],
  ) {
    setPublicValues((current) => ({ ...current, [key]: value }));
    setPublicErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function savePublic() {
    if (publicSaving) return;
    setPublicSaving(true);
    setPublicBanner(null);
    try {
      const result = await savePublicSettingsAction({
        expectedRevision: publicRev,
        values: publicValues,
      });
      if (!result.ok) {
        setPublicBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        if (result.fieldErrors) setPublicErrors(result.fieldErrors);
        return;
      }
      setPublicRev(result.data.revision);
      setPublicBanner({ kind: 'success', text: adminSettingsUi.publicGroup.saved });
      router.refresh();
    } catch {
      setPublicBanner({ kind: 'error', text: adminSettingsUi.messages.unexpected });
    } finally {
      setPublicSaving(false);
    }
  }

  async function saveNotifications() {
    if (notificationSaving) return;
    setNotificationSaving(true);
    setNotificationBanner(null);
    try {
      const result = await saveNotificationSettingsAction({
        expectedRevision: notificationRev,
        values: { notificationsEnabled, telegramChatId: chatId },
      });
      if (!result.ok) {
        setNotificationBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        if (result.fieldErrors) setNotificationErrors(result.fieldErrors);
        return;
      }
      setNotificationRev(result.data.revision);
      setNotificationsEnabled(result.data.notificationsEnabled);
      /**
       * The destination is intentionally not echoed back after a mutation.
       * Keep the owner-entered value (already local to this protected form);
       * a server readback exposes only the masked destination.
       */
      setChatId((current) => current.trim());
      setNotificationBanner({
        kind: 'success',
        text: adminSettingsUi.notificationsGroup.saved,
      });
      router.refresh();
    } catch {
      setNotificationBanner({ kind: 'error', text: adminSettingsUi.messages.unexpected });
    } finally {
      setNotificationSaving(false);
    }
  }

  async function sendTest() {
    if (testing) return;
    setTesting(true);
    setNotificationBanner(null);
    try {
      const result = await sendNotificationTestAction();
      if (!result.ok) {
        setNotificationBanner({ kind: 'error', text: result.message });
        return;
      }
      const outcome = result.data;
      if (outcome.ok) {
        setNotificationBanner({
          kind: 'success',
          text: adminSettingsUi.notificationsGroup.testSuccess,
        });
        router.refresh();
        return;
      }
      const message =
        outcome.code === 'rate_limited'
          ? adminSettingsUi.notificationsGroup.testRateLimited
          : outcome.code === 'configuration_changed'
            ? adminSettingsUi.notificationsGroup.testConfigurationChanged
            : outcome.code === 'not_configured' || outcome.code === 'invalid_configuration'
              ? adminSettingsUi.notificationsGroup.testNotConfigured
              : outcome.code === 'storage'
                ? adminSettingsUi.notificationsGroup.testStorage
                : adminSettingsUi.notificationsGroup.testFailed;
      setNotificationBanner({ kind: 'error', text: message });
    } catch {
      setNotificationBanner({
        kind: 'error',
        text: adminSettingsUi.notificationsGroup.testFailed,
      });
    } finally {
      setTesting(false);
    }
  }

  async function saveAnalytics() {
    if (analyticsSaving) return;
    setAnalyticsSaving(true);
    setAnalyticsBanner(null);
    try {
      const result = await saveAnalyticsSettingsAction({
        expectedRevision: analyticsRev,
        values: { analyticsEnabled },
      });
      if (!result.ok) {
        setAnalyticsBanner({
          kind: result.code === 'conflict' ? 'conflict' : 'error',
          text: result.message,
        });
        return;
      }
      setAnalyticsRev(result.data.revision);
      setAnalyticsEnabled(result.data.analyticsEnabled);
      setAnalyticsBanner({ kind: 'success', text: adminSettingsUi.analyticsGroup.saved });
      router.refresh();
    } catch {
      setAnalyticsBanner({ kind: 'error', text: adminSettingsUi.messages.unexpected });
    } finally {
      setAnalyticsSaving(false);
    }
  }

  const settings = adminSettingsUi;

  return (
    <div className="flex flex-col gap-5">
      <GroupCard
        title={settings.publicGroup.title}
        description={settings.publicGroup.description}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="settings-contact-email"
            label={settings.publicGroup.email}
            type="email"
            dir="ltr"
            value={publicValues.contactEmail}
            onChange={(event) => updatePublic('contactEmail', event.target.value)}
            error={publicErrors.contactEmail}
          />
          <Input
            id="settings-contact-phone"
            label={settings.publicGroup.phone}
            type="tel"
            dir="ltr"
            value={publicValues.contactPhone}
            onChange={(event) => updatePublic('contactPhone', event.target.value)}
            aria-describedby="settings-contact-phone-help"
            error={publicErrors.contactPhone}
          />
        </div>
        <p id="settings-contact-phone-help" className="-mt-2 text-xs leading-5 text-text-secondary">
          {settings.publicGroup.phoneHelp}
        </p>
        <p className="text-xs leading-5 text-text-secondary">{settings.publicGroup.urlHelp}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="settings-contact-telegram"
            label={settings.publicGroup.telegram}
            dir="ltr"
            placeholder="https://t.me/nokmel"
            value={publicValues.contactTelegramUrl}
            onChange={(event) => updatePublic('contactTelegramUrl', event.target.value)}
            error={publicErrors.contactTelegramUrl}
          />
          <Input
            id="settings-contact-whatsapp"
            label={settings.publicGroup.whatsapp}
            dir="ltr"
            placeholder="https://wa.me/201234567890"
            value={publicValues.contactWhatsappUrl}
            onChange={(event) => updatePublic('contactWhatsappUrl', event.target.value)}
            error={publicErrors.contactWhatsappUrl}
          />
          <Input
            id="settings-social-instagram"
            label={settings.publicGroup.instagram}
            dir="ltr"
            placeholder="https://instagram.com/nokmel.store"
            value={publicValues.socialInstagramUrl}
            onChange={(event) => updatePublic('socialInstagramUrl', event.target.value)}
            aria-describedby="settings-instagram-help"
            error={publicErrors.socialInstagramUrl}
          />
          <Input
            id="settings-social-facebook"
            label={settings.publicGroup.facebook}
            dir="ltr"
            placeholder="https://facebook.com/nokmel"
            value={publicValues.socialFacebookUrl}
            onChange={(event) => updatePublic('socialFacebookUrl', event.target.value)}
            error={publicErrors.socialFacebookUrl}
          />
          <Input
            id="settings-social-x"
            label={settings.publicGroup.x}
            dir="ltr"
            placeholder="https://x.com/nokmel"
            value={publicValues.socialXUrl}
            onChange={(event) => updatePublic('socialXUrl', event.target.value)}
            error={publicErrors.socialXUrl}
          />
        </div>
        <p id="settings-instagram-help" className="-mt-2 text-xs leading-5 text-text-secondary">
          {settings.publicGroup.instagramHelp}
        </p>
        <div>
          <Button type="button" onClick={savePublic} disabled={publicSaving} data-testid="settings-public-save">
            {publicSaving ? settings.publicGroup.saving : settings.publicGroup.save}
          </Button>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            {settings.publicGroup.revision}: {publicRev}
          </p>
        </div>
        <BannerBox banner={publicBanner} onReload={() => window.location.reload()} />
      </GroupCard>

      <GroupCard
        title={settings.notificationsGroup.title}
        description={settings.notificationsGroup.description}
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-text-secondary">
              {settings.notificationsGroup.serverStatus}
            </dt>
            <dd className="text-text-primary" data-testid="settings-telegram-server-status">
              {telegramServerConfigured
                ? settings.notificationsGroup.serverConfigured
                : settings.notificationsGroup.serverNotConfigured}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-secondary">
              {settings.notificationsGroup.destinationStatus}
            </dt>
            <dd className="text-text-primary" data-testid="settings-telegram-destination">
              {destinationMasked
                ? `${settings.notificationsGroup.destinationConfigured} (${destinationMasked})`
                : settings.notificationsGroup.destinationMissing}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-secondary">
              {settings.notificationsGroup.botIdentity}
            </dt>
            <dd
              className="break-all text-text-primary"
              dir="ltr"
              data-testid="settings-bot-identity"
            >
              {botUsername
                ? `@${botUsername}${botName ? ` — ${botName}` : ''}`
                : settings.notificationsGroup.botIdentityNone}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-secondary">
              {settings.notificationsGroup.lastTest}
            </dt>
            <dd className="text-text-primary" dir="ltr" data-testid="settings-last-test">
              {botUsername && lastTestAt
                ? `${lastTestAt.slice(0, 16).replace('T', ' ')} UTC`
                : '—'}
            </dd>
          </div>
        </dl>

        <label className="flex items-start gap-3 text-sm font-semibold text-text-primary">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={notificationsEnabled}
            onChange={(event) => setNotificationsEnabled(event.target.checked)}
            data-testid="settings-notifications-enabled"
          />
          <span>{settings.notificationsGroup.enabled}</span>
        </label>
        <p className="-mt-2 text-xs leading-5 text-text-secondary">
          {settings.notificationsGroup.enabledHint}
        </p>

        <Input
          id="settings-telegram-chat-id"
          label={settings.notificationsGroup.chatId}
          dir="ltr"
          inputMode="numeric"
          value={chatId}
          onChange={(event) => setChatId(event.target.value)}
          aria-describedby="settings-telegram-chat-help"
          error={notificationErrors.telegramChatId}
        />
        <p id="settings-telegram-chat-help" className="-mt-2 text-xs leading-5 text-text-secondary">
          {settings.notificationsGroup.chatIdHelp}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={saveNotifications}
            disabled={notificationSaving}
            data-testid="settings-notifications-save"
          >
            {notificationSaving
              ? settings.notificationsGroup.saving
              : settings.notificationsGroup.save}
          </Button>
          <button
            type="button"
            className={secondaryButton}
            onClick={sendTest}
            disabled={testing}
            data-testid="settings-notifications-test"
          >
            {testing ? settings.notificationsGroup.testing : settings.notificationsGroup.test}
          </button>
        </div>
        <p className="text-xs leading-5 text-text-secondary">
          {settings.notificationsGroup.testHint}
        </p>
        <p className="text-xs leading-5 text-text-secondary">
          {settings.notificationsGroup.revision}: {notificationRev}
        </p>
        <BannerBox banner={notificationBanner} onReload={() => window.location.reload()} />
        <p className="text-xs leading-5 text-text-secondary">
          {settings.notificationsGroup.privacyNote}
        </p>
      </GroupCard>

      <GroupCard
        title={settings.analyticsGroup.title}
        description={settings.analyticsGroup.description}
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-text-secondary">
              {settings.analyticsGroup.reportingStatus}
            </dt>
            <dd className="text-text-primary" data-testid="settings-analytics-reporting">
              {analyticsSummary.reporting.status === 'ready'
                ? settings.analyticsGroup.reportingReady
                : analyticsSummary.reporting.status === 'invalid'
                  ? settings.analyticsGroup.reportingInvalid
                  : settings.analyticsGroup.reportingNotConfigured}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-text-secondary">
              {settings.analyticsGroup.trackingStatus}
            </dt>
            <dd className="text-text-primary" data-testid="settings-analytics-tracking">
              {analyticsSummary.tracking.status === 'ready'
                ? settings.analyticsGroup.trackingReady
                : analyticsSummary.tracking.status === 'invalid'
                  ? settings.analyticsGroup.trackingInvalid
                  : settings.analyticsGroup.trackingNotConfigured}
            </dd>
          </div>
        </dl>
        <label className="flex items-start gap-3 text-sm font-semibold text-text-primary">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={analyticsEnabled}
            onChange={(event) => setAnalyticsEnabled(event.target.checked)}
            data-testid="settings-analytics-enabled"
          />
          <span>{settings.analyticsGroup.enabled}</span>
        </label>
        <p className="text-xs leading-5 text-text-secondary">
          {settings.analyticsGroup.enableHint}
        </p>
        <div>
          <Button
            type="button"
            onClick={saveAnalytics}
            disabled={analyticsSaving}
            data-testid="settings-analytics-save"
          >
            {analyticsSaving
              ? settings.analyticsGroup.saving
              : settings.analyticsGroup.save}
          </Button>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            {settings.analyticsGroup.revision}: {analyticsRev}
          </p>
        </div>
        <BannerBox banner={analyticsBanner} onReload={() => window.location.reload()} />
        <p className="text-xs leading-5 text-text-secondary">
          {settings.analyticsGroup.privacyNote}
        </p>
      </GroupCard>
    </div>
  );
}
