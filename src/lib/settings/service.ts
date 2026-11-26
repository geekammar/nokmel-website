import { sql } from 'drizzle-orm';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import { siteSettings } from '@/lib/db/schema';
import type { Db } from '@/lib/db/types';
import {
  SETTINGS_ROW_ID,
  assertRevision,
  emptyPublicSettingsForm,
  maskTelegramChatId,
  projectPublicSettings,
  validateAnalyticsSettingsInput,
  validateNotificationSettingsInput,
  validatePublicSettingsInput,
  type AnalyticsSettingsValues,
  type NotificationSettingsValues,
  type PublicSettings,
  type PublicSettingsFormValues,
  type SettingsStorageStatus,
} from './model';

/**
 * Server-only settings service (W5).
 *
 * Public reads use an explicit public-column projection. Private integration
 * preferences and the Telegram destination are only read by owner-authorized
 * pages, server actions and post-commit notification delivery. Each settings
 * group uses its own optimistic revision so unrelated groups cannot overwrite
 * each other. All writes run in one transaction with a row lock.
 */

export class SettingsConflictError extends Error {
  constructor() {
    super('Settings were changed by another session.');
    this.name = 'SettingsConflictError';
  }
}

export class SettingsValidationError extends Error {
  fieldErrors: Record<string, string>;
  constructor(fieldErrors: Record<string, string>) {
    super('Invalid settings input.');
    this.name = 'SettingsValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class SettingsStorageError extends Error {
  constructor() {
    super('Settings storage is unavailable.');
    this.name = 'SettingsStorageError';
  }
}

const STORAGE_MESSAGES: Record<Exclude<SettingsStorageStatus, 'ok'>, string> = {
  unconfigured: 'إعدادات الموقع غير مهيأة في هذه البيئة.',
  not_migrated: 'جدول إعدادات الموقع غير مهيأ في قاعدة البيانات بعد.',
  unavailable: 'تعذّر الوصول إلى إعدادات الموقع مؤقتاً.',
};

export type PublicSettingsResult =
  | { status: 'ok'; settings: PublicSettings }
  | { status: Exclude<SettingsStorageStatus, 'ok'>; settings: PublicSettings; message: string };

export type OwnerSettings = {
  public: PublicSettings;
  publicRevision: number;
  notificationsEnabled: boolean;
  telegramChatId: string | null;
  telegramChatIdMasked: string | null;
  telegramBotUsername: string | null;
  telegramBotName: string | null;
  notificationRevision: number;
  analyticsEnabled: boolean;
  analyticsRevision: number;
  lastNotificationTestAt: string | null;
  updatedAt: string | null;
};

export type OwnerSettingsResult =
  | { status: 'ok'; settings: OwnerSettings }
  | { status: Exclude<SettingsStorageStatus, 'ok'>; message: string };

export type IntegrationSettings = {
  notificationsEnabled: boolean;
  telegramChatId: string | null;
  telegramBotUsername: string | null;
  telegramBotName: string | null;
  analyticsEnabled: boolean;
};

const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  notificationsEnabled: false,
  telegramChatId: null,
  telegramBotUsername: null,
  telegramBotName: null,
  analyticsEnabled: false,
};

type SettingsServiceOptions = { db?: Db };

function resolveDb(options: SettingsServiceOptions = {}): Db {
  return options.db ?? getDb().db;
}

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function storageStatus(error: unknown): Exclude<SettingsStorageStatus, 'ok'> {
  if (error instanceof ConfigError) return 'unconfigured';
  if (postgresErrorCode(error) === '42P01') return 'not_migrated';
  return 'unavailable';
}

function logFailure(operation: string, error: unknown): void {
  console.error('[settings] operation failed', {
    operation,
    reason: storageStatus(error),
    error: error instanceof Error ? error.name : 'unknown',
  });
}

function emptyOwnerSettings(): OwnerSettings {
  return {
    public: projectPublicSettings(null),
    publicRevision: 0,
    notificationsEnabled: false,
    telegramChatId: null,
    telegramChatIdMasked: null,
    telegramBotUsername: null,
    telegramBotName: null,
    notificationRevision: 0,
    analyticsEnabled: false,
    analyticsRevision: 0,
    lastNotificationTestAt: null,
    updatedAt: null,
  };
}

export async function loadPublicSettings(
  options: SettingsServiceOptions = {},
): Promise<PublicSettingsResult> {
  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logFailure('public-load', error);
    return {
      status: 'unconfigured',
      settings: projectPublicSettings(null),
      message: STORAGE_MESSAGES.unconfigured,
    };
  }
  try {
    const rows = await db
      .select({
        contactEmail: siteSettings.contactEmail,
        contactPhone: siteSettings.contactPhone,
        contactTelegramUrl: siteSettings.contactTelegramUrl,
        contactWhatsappUrl: siteSettings.contactWhatsappUrl,
        socialInstagramUrl: siteSettings.socialInstagramUrl,
        socialFacebookUrl: siteSettings.socialFacebookUrl,
        socialXUrl: siteSettings.socialXUrl,
      })
      .from(siteSettings)
      .where(sql`${siteSettings.id} = ${SETTINGS_ROW_ID}`)
      .limit(1);
    return { status: 'ok', settings: projectPublicSettings(rows[0]) };
  } catch (error) {
    logFailure('public-load', error);
    const status = storageStatus(error);
    return { status, settings: projectPublicSettings(null), message: STORAGE_MESSAGES[status] };
  }
}

export async function loadOwnerSettings(
  options: SettingsServiceOptions = {},
): Promise<OwnerSettingsResult> {
  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logFailure('owner-load', error);
    return { status: 'unconfigured', message: STORAGE_MESSAGES.unconfigured };
  }
  try {
    const rows = await db
      .select()
      .from(siteSettings)
      .where(sql`${siteSettings.id} = ${SETTINGS_ROW_ID}`)
      .limit(1);
    const row = rows[0];
    if (!row) return { status: 'ok', settings: emptyOwnerSettings() };
    return {
      status: 'ok',
      settings: {
        public: projectPublicSettings(row),
        publicRevision: row.publicRevision,
        notificationsEnabled: row.notificationsEnabled,
        telegramChatId: row.telegramChatId,
        telegramChatIdMasked: maskTelegramChatId(row.telegramChatId),
        telegramBotUsername: row.telegramBotUsername,
        telegramBotName: row.telegramBotName,
        notificationRevision: row.notificationRevision,
        analyticsEnabled: row.analyticsEnabled,
        analyticsRevision: row.analyticsRevision,
        lastNotificationTestAt: row.lastNotificationTestAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    logFailure('owner-load', error);
    return { status: storageStatus(error), message: STORAGE_MESSAGES[storageStatus(error)] };
  }
}

/**
 * Server-only integration flags. Returns safe disabled defaults when settings
 * storage is unavailable; never includes credentials.
 */
export async function loadIntegrationSettings(
  options: SettingsServiceOptions = {},
): Promise<IntegrationSettings> {
  try {
    const db = resolveDb(options);
    const rows = await db
      .select({
        notificationsEnabled: siteSettings.notificationsEnabled,
        telegramChatId: siteSettings.telegramChatId,
        telegramBotUsername: siteSettings.telegramBotUsername,
        telegramBotName: siteSettings.telegramBotName,
        analyticsEnabled: siteSettings.analyticsEnabled,
      })
      .from(siteSettings)
      .where(sql`${siteSettings.id} = ${SETTINGS_ROW_ID}`)
      .limit(1);
    const row = rows[0];
    if (!row) return { ...DEFAULT_INTEGRATION_SETTINGS };
    return {
      notificationsEnabled: row.notificationsEnabled,
      telegramChatId: row.telegramChatId,
      telegramBotUsername: row.telegramBotUsername,
      telegramBotName: row.telegramBotName,
      analyticsEnabled: row.analyticsEnabled,
    };
  } catch {
    return { ...DEFAULT_INTEGRATION_SETTINGS };
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function ensureRow(tx: Tx): Promise<void> {
  await tx
    .insert(siteSettings)
    .values({ id: SETTINGS_ROW_ID })
    .onConflictDoNothing({ target: siteSettings.id });
}

async function readGroupRevision(
  tx: Tx,
  group: 'public' | 'notification' | 'analytics',
  expected: unknown,
): Promise<{ revision: number; telegramChatId: string | null }> {
  const expectedRevision = assertRevision(expected);
  const rows = await tx
    .select({
      publicRevision: siteSettings.publicRevision,
      notificationRevision: siteSettings.notificationRevision,
      analyticsRevision: siteSettings.analyticsRevision,
      telegramChatId: siteSettings.telegramChatId,
    })
    .from(siteSettings)
    .where(sql`${siteSettings.id} = ${SETTINGS_ROW_ID}`)
    .limit(1)
    .for('update');
  const row = rows[0];
  const current =
    group === 'public'
      ? row?.publicRevision ?? 0
      : group === 'notification'
        ? row?.notificationRevision ?? 0
        : row?.analyticsRevision ?? 0;
  if (current !== expectedRevision) throw new SettingsConflictError();
  return { revision: expectedRevision, telegramChatId: row?.telegramChatId ?? null };
}

export async function savePublicSettings(
  args: { expectedRevision: unknown; values: PublicSettingsFormValues },
  options: SettingsServiceOptions = {},
): Promise<{ revision: number; settings: PublicSettings }> {
  const validation = validatePublicSettingsInput(args.values);
  if (!validation.ok) throw new SettingsValidationError(validation.errors);
  const db = resolveDb(options);
  try {
    return await db.transaction(async (tx) => {
      await ensureRow(tx);
      const { revision } = await readGroupRevision(tx, 'public', args.expectedRevision);
      const values = validation.values;
      const updated = await tx
        .update(siteSettings)
        .set({
          contactEmail: values.contactEmail,
          contactPhone: values.contactPhone,
          contactTelegramUrl: values.contactTelegramUrl,
          contactWhatsappUrl: values.contactWhatsappUrl,
          socialInstagramUrl: values.socialInstagramUrl,
          socialFacebookUrl: values.socialFacebookUrl,
          socialXUrl: values.socialXUrl,
          publicRevision: revision + 1,
          updatedAt: new Date(),
        })
        .where(sql`${siteSettings.id} = ${SETTINGS_ROW_ID}`)
        .returning();
      return { revision: updated[0].publicRevision, settings: projectPublicSettings(updated[0]) };
    });
  } catch (error) {
    if (error instanceof SettingsConflictError || error instanceof SettingsValidationError) throw error;
    logFailure('public-save', error);
    throw new SettingsStorageError();
  }
}

export async function saveNotificationSettings(
  args: { expectedRevision: unknown; values: NotificationSettingsValues },
  options: SettingsServiceOptions = {},
): Promise<{
  revision: number;
  notificationsEnabled: boolean;
  telegramChatIdMasked: string | null;
}> {
  const validation = validateNotificationSettingsInput(args.values);
  if (!validation.ok) throw new SettingsValidationError(validation.errors);
  const db = resolveDb(options);
  try {
    return await db.transaction(async (tx) => {
      await ensureRow(tx);
      const { revision, telegramChatId: previousChatId } = await readGroupRevision(
        tx,
        'notification',
        args.expectedRevision,
      );
      const destinationChanged =
        validation.values.telegramChatId !== previousChatId;
      const updated = await tx
        .update(siteSettings)
        .set({
          notificationsEnabled: validation.values.notificationsEnabled,
          telegramChatId: validation.values.telegramChatId,
          ...(destinationChanged
            ? {
                /**
                 * Clear the verification identity, but keep the timestamp as
                 * the durable 30-second test rate-limit slot. The UI does not
                 * present a last-test value without a current verification
                 * identity, so an old destination is never shown as verified.
                 */
                telegramBotUsername: null,
                telegramBotName: null,
              }
            : {}),
          notificationRevision: revision + 1,
          updatedAt: new Date(),
        })
        .where(sql`${siteSettings.id} = ${SETTINGS_ROW_ID}`)
        .returning();
      return {
        revision: updated[0].notificationRevision,
        notificationsEnabled: updated[0].notificationsEnabled,
        telegramChatIdMasked: maskTelegramChatId(updated[0].telegramChatId),
      };
    });
  } catch (error) {
    if (error instanceof SettingsConflictError || error instanceof SettingsValidationError) throw error;
    logFailure('notification-save', error);
    throw new SettingsStorageError();
  }
}

export async function saveAnalyticsSettings(
  args: { expectedRevision: unknown; values: AnalyticsSettingsValues },
  options: SettingsServiceOptions = {},
): Promise<{ revision: number; settings: AnalyticsSettingsValues }> {
  const validation = validateAnalyticsSettingsInput(args.values);
  if (!validation.ok) throw new SettingsValidationError(validation.errors);
  const db = resolveDb(options);
  try {
    return await db.transaction(async (tx) => {
      await ensureRow(tx);
      const { revision } = await readGroupRevision(tx, 'analytics', args.expectedRevision);
      const updated = await tx
        .update(siteSettings)
        .set({
          analyticsEnabled: validation.values.analyticsEnabled,
          analyticsRevision: revision + 1,
          updatedAt: new Date(),
        })
        .where(sql`${siteSettings.id} = ${SETTINGS_ROW_ID}`)
        .returning();
      return {
        revision: updated[0].analyticsRevision,
        settings: { analyticsEnabled: updated[0].analyticsEnabled },
      };
    });
  } catch (error) {
    if (error instanceof SettingsConflictError || error instanceof SettingsValidationError) throw error;
    logFailure('analytics-save', error);
    throw new SettingsStorageError();
  }
}

/**
 * Atomically reserves the owner-only Telegram test slot (30 seconds). Returns
 * false when a test was requested too recently. This is durable across
 * serverless instances and does not create a new service.
 */
export async function claimNotificationTestSlot(
  options: SettingsServiceOptions = {},
): Promise<boolean> {
  const db = resolveDb(options);
  try {
    return await db.transaction(async (tx) => {
      await ensureRow(tx);
      const rows = await tx
        .update(siteSettings)
        .set({ lastNotificationTestAt: new Date(), updatedAt: new Date() })
        .where(
          sql`${siteSettings.id} = ${SETTINGS_ROW_ID} and (${siteSettings.lastNotificationTestAt} is null or ${siteSettings.lastNotificationTestAt} < now() - interval '30 seconds')`,
        )
        .returning({ id: siteSettings.id });
      return rows.length > 0;
    });
  } catch (error) {
    logFailure('test-slot', error);
    throw new SettingsStorageError();
  }
}

export async function recordTelegramBotIdentity(
  identity: { username: string | null; name: string | null },
  options: SettingsServiceOptions = {},
): Promise<void> {
  const db = resolveDb(options);
  try {
    await db
      .update(siteSettings)
      .set({
        telegramBotUsername: identity.username?.slice(0, 64) ?? null,
        telegramBotName: identity.name?.slice(0, 128) ?? null,
        updatedAt: new Date(),
      })
      .where(sql`${siteSettings.id} = ${SETTINGS_ROW_ID}`);
  } catch (error) {
    logFailure('bot-identity-save', error);
  }
}

export { emptyPublicSettingsForm };
