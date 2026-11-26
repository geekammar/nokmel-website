import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  applyMigrations,
  emptyDatabase,
  getDisposablePostgres,
} from './helpers';
import {
  SettingsConflictError,
  SettingsValidationError,
  loadIntegrationSettings,
  loadOwnerSettings,
  loadPublicSettings,
  saveAnalyticsSettings,
  saveNotificationSettings,
  savePublicSettings,
} from '@/lib/settings/service';
import {
  emptyPublicSettingsForm,
  publicSettingsFormFrom,
} from '@/lib/settings/model';

/**
 * W5 owner settings on disposable PostgreSQL:
 * fresh safe defaults, explicit public projection, independent group
 * revisions, stale-write rejection and persistence. Never hosted Neon.
 */

const pg = await getDisposablePostgres();

beforeAll(async () => {
  await applyMigrations(pg);
});

beforeEach(async () => {
  await emptyDatabase(pg);
});

afterAll(async () => {
  await pg.stop();
});

describe('W5 settings persistence and projection', () => {
  test('fresh storage is safe: empty public settings and disabled integrations', async () => {
    const publicResult = await loadPublicSettings({ db: pg.db });
    expect(publicResult.status).toBe('ok');
    expect(publicResult.settings).toEqual(publicSettingsFormToPublic(emptyPublicSettingsForm()));

    const owner = await loadOwnerSettings({ db: pg.db });
    expect(owner.status).toBe('ok');
    if (owner.status !== 'ok') return;
    expect(owner.settings.notificationsEnabled).toBe(false);
    expect(owner.settings.analyticsEnabled).toBe(false);
    expect(owner.settings.telegramChatId).toBeNull();
    expect(owner.settings.publicRevision).toBe(0);
    expect(owner.settings.notificationRevision).toBe(0);
    expect(owner.settings.analyticsRevision).toBe(0);

    const integration = await loadIntegrationSettings({ db: pg.db });
    expect(integration).toMatchObject({
      notificationsEnabled: false,
      analyticsEnabled: false,
      telegramChatId: null,
    });
  });

  test('saves public contact/social data and never projects private columns', async () => {
    const values = {
      ...emptyPublicSettingsForm(),
      contactEmail: 'hello@nokmel.tech',
      contactPhone: '+201234567890',
      contactTelegramUrl: 'https://t.me/nokmel',
    };
    const saved = await savePublicSettings(
      { expectedRevision: 0, values },
      { db: pg.db },
    );
    expect(saved.revision).toBe(1);
    expect(saved.settings.contactEmail).toBe('hello@nokmel.tech');

    const publicResult = await loadPublicSettings({ db: pg.db });
    expect(publicResult.status).toBe('ok');
    expect(publicResult.settings).toEqual({
      contactEmail: 'hello@nokmel.tech',
      contactPhone: '+201234567890',
      contactTelegramUrl: 'https://t.me/nokmel',
      contactWhatsappUrl: null,
      socialInstagramUrl: null,
      socialFacebookUrl: null,
      socialXUrl: null,
    });
    expect(Object.keys(publicResult.settings).sort()).toEqual([
      'contactEmail',
      'contactPhone',
      'contactTelegramUrl',
      'contactWhatsappUrl',
      'socialFacebookUrl',
      'socialInstagramUrl',
      'socialXUrl',
    ]);

    await saveNotificationSettings(
      {
        expectedRevision: 0,
        values: { notificationsEnabled: true, telegramChatId: '9876543210123' },
      },
      { db: pg.db },
    );
    await saveAnalyticsSettings(
      { expectedRevision: 0, values: { analyticsEnabled: true } },
      { db: pg.db },
    );

    const publicAfterPrivate = await loadPublicSettings({ db: pg.db });
    expect(JSON.stringify(publicAfterPrivate)).not.toContain('9876543210123');
    expect(JSON.stringify(publicAfterPrivate)).not.toContain('analyticsEnabled');
    expect(JSON.stringify(publicAfterPrivate)).not.toContain('notificationsEnabled');

    const owner = await loadOwnerSettings({ db: pg.db });
    expect(owner.status).toBe('ok');
    if (owner.status !== 'ok') return;
    expect(owner.settings.telegramChatIdMasked).toBe('••••0123');
    expect(owner.settings.telegramChatId).toBe('9876543210123');
    expect(owner.settings.analyticsEnabled).toBe(true);
    expect(owner.settings.publicRevision).toBe(1);
    expect(owner.settings.notificationRevision).toBe(1);
    expect(owner.settings.analyticsRevision).toBe(1);
  });

  test('groups have independent stale revisions', async () => {
    await savePublicSettings(
      {
        expectedRevision: 0,
        values: { ...emptyPublicSettingsForm(), contactEmail: 'first@nokmel.tech' },
      },
      { db: pg.db },
    );
    const notification = await saveNotificationSettings(
      {
        expectedRevision: 0,
        values: { notificationsEnabled: false, telegramChatId: '123456' },
      },
      { db: pg.db },
    );
    expect(notification.revision).toBe(1);
    const analytics = await saveAnalyticsSettings(
      { expectedRevision: 0, values: { analyticsEnabled: false } },
      { db: pg.db },
    );
    expect(analytics.revision).toBe(1);

    // A stale public write is rejected without changing any group.
    await expect(
      savePublicSettings(
        {
          expectedRevision: 0,
          values: { ...emptyPublicSettingsForm(), contactEmail: 'stale@nokmel.tech' },
        },
        { db: pg.db },
      ),
    ).rejects.toBeInstanceOf(SettingsConflictError);

    const owner = await loadOwnerSettings({ db: pg.db });
    expect(owner.status).toBe('ok');
    if (owner.status !== 'ok') return;
    expect(owner.settings.public.contactEmail).toBe('first@nokmel.tech');
    expect(owner.settings.notificationRevision).toBe(1);
    expect(owner.settings.analyticsRevision).toBe(1);

    // A stale notification write is also rejected independently.
    await expect(
      saveNotificationSettings(
        {
          expectedRevision: 0,
          values: { notificationsEnabled: true, telegramChatId: '999999' },
        },
        { db: pg.db },
      ),
    ).rejects.toBeInstanceOf(SettingsConflictError);
  });

  test('invalid contact/social values are rejected before persistence', async () => {
    await expect(
      savePublicSettings(
        {
          expectedRevision: 0,
          values: {
            ...emptyPublicSettingsForm(),
            contactEmail: 'not-an-email',
            socialXUrl: 'javascript:alert(1)',
          },
        },
        { db: pg.db },
      ),
    ).rejects.toBeInstanceOf(SettingsValidationError);

    const owner = await loadOwnerSettings({ db: pg.db });
    expect(owner.status).toBe('ok');
    if (owner.status !== 'ok') return;
    expect(owner.settings.publicRevision).toBe(0);
    expect(owner.settings.updatedAt).toBeNull();
    const count = await pg.pool.query('select count(*)::int as count from site_settings');
    expect(count.rows[0].count).toBe(0);
  });

  test('persisted public values survive reload and invalid legacy values are hidden', async () => {
    await pg.pool.query(
      `insert into site_settings (id, contact_email, contact_phone, social_x_url)
       values ('default', 'hello@nokmel.tech', '+201234567890', 'javascript:alert(1)')`,
    );
    const publicResult = await loadPublicSettings({ db: pg.db });
    expect(publicResult.status).toBe('ok');
    expect(publicResult.settings.contactEmail).toBe('hello@nokmel.tech');
    expect(publicResult.settings.contactPhone).toBe('+201234567890');
    expect(publicResult.settings.socialXUrl).toBeNull();
  });

  test('form projection round-trips validated public values', async () => {
    const owner = await loadOwnerSettings({ db: pg.db });
    expect(owner.status).toBe('ok');
    if (owner.status !== 'ok') return;
    expect(publicSettingsFormFrom(owner.settings.public)).toEqual(
      emptyPublicSettingsForm(),
    );
  });
});

function publicSettingsFormToPublic(values: ReturnType<typeof emptyPublicSettingsForm>) {
  return {
    contactEmail: values.contactEmail || null,
    contactPhone: values.contactPhone || null,
    contactTelegramUrl: values.contactTelegramUrl || null,
    contactWhatsappUrl: values.contactWhatsappUrl || null,
    socialInstagramUrl: values.socialInstagramUrl || null,
    socialFacebookUrl: values.socialFacebookUrl || null,
    socialXUrl: values.socialXUrl || null,
  };
}
