import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { joinRequests } from '@/lib/db/schema';
import type { Db } from '@/lib/db/types';
import { parseOfferSnapshot, type OfferSnapshot } from '@/lib/join/snapshot';
import type { JoinSource } from '@/lib/join/validation';
import {
  claimNotificationTestSlot,
  loadIntegrationSettings,
  recordTelegramBotIdentity,
  type IntegrationSettings,
} from '@/lib/settings/service';
import { resolveTelegramConfig } from './config';
import {
  TELEGRAM_TEST_MESSAGE,
  buildJoinNotificationMessage,
  type NotificationRequestContext,
} from './message';
import {
  getTelegramBotIdentity,
  sendTelegramMessage,
  type TelegramBotIdentity,
  type TelegramErrorCode,
  type TelegramSendResult,
} from './telegram';

/**
 * Durable owner-notification state machine for accepted join requests (W5).
 *
 * The accepted request is always persisted before delivery is attempted and a
 * delivery failure never rolls back or invalidates it. Delivery is synchronous
 * and bounded after commit; no worker/queue service is introduced. A database
 * claim prevents concurrent retries from sending simultaneously. Exactly-once
 * Telegram delivery is not claimed: `uncertain` records a timeout/ambiguous
 * provider result where a duplicate is possible on manual retry.
 */

export const NOTIFICATION_STATES = [
  'skipped',
  'pending',
  'sending',
  'sent',
  'failed',
  'uncertain',
] as const;
export type NotificationState = (typeof NOTIFICATION_STATES)[number];

export const NOTIFICATION_CLAIM_STALE_MS = 5 * 60 * 1000;

export type NotificationDeliveryOutcome =
  | { status: 'sent'; messageId: number }
  | { status: 'skipped'; reason: 'disabled' | 'already_processed' }
  | { status: 'failed'; code: TelegramErrorCode | 'not_configured' | 'invalid_configuration' }
  | { status: 'uncertain'; code: TelegramErrorCode }
  | { status: 'not_attempted' }
  | { status: 'already_sent' }
  | { status: 'in_progress' };

export type JoinNotificationStatus = {
  state: NotificationState | null;
  attemptedAt: string | null;
  deliveredAt: string | null;
  errorCode: string | null;
  canRetry: boolean;
  mayDuplicate: boolean;
};

type DbLike = Db;
type Deps = {
  db?: DbLike;
  env?: NodeJS.ProcessEnv;
  sendMessage?: typeof sendTelegramMessage;
  getBotIdentity?: typeof getTelegramBotIdentity;
  now?: () => Date;
};

type ClaimedRow = {
  id: string;
  planNameSnapshot: string | null;
  source: string;
  offerSnapshot: unknown;
  createdAt: Date;
};

function resolveDb(options: Deps): DbLike {
  return options.db ?? getDb().db;
}

function asSource(value: string): JoinSource {
  return value === 'pricing' || value === 'join' ? value : 'direct';
}

function contextFromRow(row: ClaimedRow): NotificationRequestContext {
  const parsed = parseOfferSnapshot(row.offerSnapshot);
  const snapshot: OfferSnapshot | null =
    parsed.status === 'valid' ? parsed.snapshot : null;
  return {
    id: row.id,
    planName: snapshot?.planName ?? row.planNameSnapshot,
    source: asSource(row.source),
    offerSnapshot: snapshot,
    offerSnapshotInvalid: parsed.status === 'invalid',
    createdAt: row.createdAt.toISOString(),
  };
}

async function markUnattempted(
  db: DbLike,
  id: string,
  state: NotificationState,
  errorCode: string,
): Promise<void> {
  const notificationState = joinRequests.notificationState;
  await db
    .update(joinRequests)
    .set({
      notificationState: state,
      notificationErrorCode: errorCode.slice(0, 40),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(joinRequests.id, id),
        or(isNull(notificationState), eq(notificationState, 'pending')),
      ),
    );
}

async function claimForSend(
  db: DbLike,
  id: string,
  attemptedAt: Date,
  mode: 'initial' | 'retry',
): Promise<ClaimedRow | null> {
  const state = joinRequests.notificationState;
  const initial = or(isNull(state), eq(state, 'pending'));
  const staleBefore = new Date(attemptedAt.getTime() - NOTIFICATION_CLAIM_STALE_MS);
  const retry = or(
    inArray(state, ['failed', 'uncertain', 'pending', 'skipped']),
    and(eq(state, 'sending'), lt(joinRequests.notificationAttemptedAt, staleBefore)),
  );
  const rows = await db
    .update(joinRequests)
    .set({
      notificationState: 'sending',
      notificationAttemptedAt: attemptedAt,
      notificationErrorCode: null,
      updatedAt: attemptedAt,
    })
    .where(and(eq(joinRequests.id, id), mode === 'initial' ? initial : retry))
    .returning({
      id: joinRequests.id,
      planNameSnapshot: joinRequests.planNameSnapshot,
      source: joinRequests.source,
      offerSnapshot: joinRequests.offerSnapshot,
      createdAt: joinRequests.createdAt,
    });
  return rows[0] ?? null;
}

async function currentState(
  db: DbLike,
  id: string,
): Promise<{ state: NotificationState | null; attemptedAt: Date | null } | null> {
  const rows = await db
    .select({
      notificationState: joinRequests.notificationState,
      notificationAttemptedAt: joinRequests.notificationAttemptedAt,
    })
    .from(joinRequests)
    .where(eq(joinRequests.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    state: (row.notificationState as NotificationState | null) ?? null,
    attemptedAt: row.notificationAttemptedAt,
  };
}

async function markSent(db: DbLike, id: string, deliveredAt: Date): Promise<void> {
  await db
    .update(joinRequests)
    .set({
      notificationState: 'sent',
      notificationDeliveredAt: deliveredAt,
      notificationErrorCode: null,
      updatedAt: deliveredAt,
    })
    .where(eq(joinRequests.id, id));
}

async function markFailure(
  db: DbLike,
  id: string,
  result: Exclude<TelegramSendResult, { kind: 'sent' }>,
): Promise<void> {
  await db
    .update(joinRequests)
    .set({
      notificationState: result.kind === 'failed' ? 'failed' : 'uncertain',
      notificationErrorCode: result.code.slice(0, 40),
      updatedAt: new Date(),
    })
    .where(eq(joinRequests.id, id));
}

async function deliver(
  row: ClaimedRow,
  integration: IntegrationSettings,
  deps: Deps,
  token: string,
  apiBase: string,
  chatId: string,
): Promise<NotificationDeliveryOutcome> {
  const db = resolveDb(deps);
  const env = deps.env ?? process.env;
  const send = deps.sendMessage ?? sendTelegramMessage;
  const now = deps.now ?? (() => new Date());
  const message = buildJoinNotificationMessage(contextFromRow(row), env);
  if (!message) {
    await markFailure(db, row.id, { kind: 'failed', code: 'rejected' });
    return { status: 'failed', code: 'invalid_configuration' };
  }
  const result = await send({ token, chatId, text: message, apiBase });
  if (result.kind === 'sent') {
    await markSent(db, row.id, now());
    return { status: 'sent', messageId: result.messageId };
  }
  await markFailure(db, row.id, result);
  return result.kind === 'failed'
    ? { status: 'failed', code: result.code }
    : { status: 'uncertain', code: result.code };
}

type DeliveryReady = {
  integration: IntegrationSettings;
  tokenConfig: ReturnType<typeof resolveTelegramConfig>;
};

function readiness(integration: IntegrationSettings, env: NodeJS.ProcessEnv): DeliveryReady {
  return { integration, tokenConfig: resolveTelegramConfig(env) };
}

/** Called after the join transaction commits. Never throws to the caller. */
export async function deliverNewJoinRequestNotification(
  requestId: string,
  deps: Deps = {},
): Promise<NotificationDeliveryOutcome> {
  const env = deps.env ?? process.env;
  let db: DbLike;
  try {
    db = resolveDb(deps);
  } catch {
    return { status: 'skipped', reason: 'disabled' };
  }

  try {
    const integration = await loadIntegrationSettings({ db });
    const { tokenConfig } = readiness(integration, env);
    if (!integration.notificationsEnabled) {
      await markUnattempted(db, requestId, 'skipped', 'disabled');
      return { status: 'skipped', reason: 'disabled' };
    }
    if (!integration.telegramChatId) {
      await markUnattempted(db, requestId, 'failed', 'not_configured');
      return { status: 'failed', code: 'not_configured' };
    }
    if (tokenConfig.status !== 'configured') {
      await markUnattempted(db, requestId, 'failed', 'not_configured');
      return { status: 'failed', code: 'not_configured' };
    }
    const now = deps.now ?? (() => new Date());
    const row = await claimForSend(db, requestId, now(), 'initial');
    if (!row) return { status: 'skipped', reason: 'already_processed' };
    return await deliver(
      row,
      integration,
      deps,
      tokenConfig.token,
      tokenConfig.apiBase,
      integration.telegramChatId,
    );
  } catch (error) {
    console.error('[notifications] delivery failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return { status: 'failed', code: 'not_configured' };
  }
}

/** Owner-triggered retry. Concurrent calls are serialized by the DB claim. */
export async function retryJoinRequestNotification(
  requestId: string,
  deps: Deps = {},
): Promise<NotificationDeliveryOutcome> {
  const env = deps.env ?? process.env;
  const db = resolveDb(deps);
  try {
    const integration = await loadIntegrationSettings({ db });
    if (!integration.notificationsEnabled || !integration.telegramChatId) {
      return { status: 'skipped', reason: 'disabled' };
    }
    const tokenConfig = resolveTelegramConfig(env);
    if (tokenConfig.status !== 'configured') {
      return { status: 'failed', code: 'not_configured' };
    }
    const now = deps.now ?? (() => new Date());
    const row = await claimForSend(db, requestId, now(), 'retry');
    if (!row) {
      const state = await currentState(db, requestId);
      if (!state) return { status: 'not_attempted' };
      if (state.state === 'sent') return { status: 'already_sent' };
      if (state.state === 'sending') return { status: 'in_progress' };
      if (state.state === null) return { status: 'not_attempted' };
      return { status: 'skipped', reason: 'already_processed' };
    }
    return await deliver(
      row,
      integration,
      deps,
      tokenConfig.token,
      tokenConfig.apiBase,
      integration.telegramChatId,
    );
  } catch (error) {
    console.error('[notifications] retry failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return { status: 'failed', code: 'not_configured' };
  }
}

export type NotificationTestResult =
  | { ok: true; botUsername: string | null; botName: string | null }
  | {
      ok: false;
      code:
        | 'disabled'
        | 'not_configured'
        | 'invalid_configuration'
        | 'rate_limited'
        | 'unauthorized'
        | 'timeout'
        | 'transport'
        | 'rejected'
        | 'http_error'
        | 'invalid_response'
        | 'storage';
    };

/** Owner-only explicit test message to the fixed configured destination. */
export async function sendOwnerTestNotification(
  deps: Deps = {},
): Promise<NotificationTestResult> {
  const env = deps.env ?? process.env;
  const db = resolveDb(deps);
  const send = deps.sendMessage ?? sendTelegramMessage;
  const getMe = deps.getBotIdentity ?? getTelegramBotIdentity;
  try {
    const integration = await loadIntegrationSettings({ db });
    if (!integration.notificationsEnabled || !integration.telegramChatId) {
      return { ok: false, code: 'disabled' };
    }
    const tokenConfig = resolveTelegramConfig(env);
    if (tokenConfig.status !== 'configured') {
      return { ok: false, code: 'not_configured' };
    }
    const claimed = await claimNotificationTestSlot({ db });
    if (!claimed) return { ok: false, code: 'rate_limited' };

    const me = await getMe({
      token: tokenConfig.token,
      apiBase: tokenConfig.apiBase,
    });
    if (me.kind !== 'ok') {
      const code = me.code === 'invalid_response' ? 'invalid_response' : me.code;
      return { ok: false, code };
    }
    const result = await send({
      token: tokenConfig.token,
      chatId: integration.telegramChatId,
      text: TELEGRAM_TEST_MESSAGE,
      apiBase: tokenConfig.apiBase,
    });
    if (result.kind !== 'sent') {
      return { ok: false, code: result.code };
    }
    await recordTelegramBotIdentity(
      { username: me.bot.username, name: me.bot.name },
      { db },
    );
    return { ok: true, botUsername: me.bot.username, botName: me.bot.name };
  } catch {
    return { ok: false, code: 'storage' };
  }
}

export function joinNotificationStatus(
  row: {
    notificationState: string | null;
    notificationAttemptedAt: Date | null;
    notificationDeliveredAt: Date | null;
    notificationErrorCode: string | null;
  },
  now: Date = new Date(),
): JoinNotificationStatus {
  const state =
    row.notificationState &&
    (NOTIFICATION_STATES as readonly string[]).includes(row.notificationState)
      ? (row.notificationState as NotificationState)
      : null;
  const staleSending =
    state === 'sending' &&
    row.notificationAttemptedAt !== null &&
    now.getTime() - row.notificationAttemptedAt.getTime() > NOTIFICATION_CLAIM_STALE_MS;
  const mayDuplicate = state === 'uncertain' || staleSending;
  return {
    state,
    attemptedAt: row.notificationAttemptedAt?.toISOString() ?? null,
    deliveredAt: row.notificationDeliveredAt?.toISOString() ?? null,
    errorCode: row.notificationErrorCode,
    canRetry:
      state === 'failed' ||
      state === 'uncertain' ||
      state === 'skipped' ||
      state === 'pending' ||
      staleSending,
    mayDuplicate,
  };
}

export type { TelegramBotIdentity };
