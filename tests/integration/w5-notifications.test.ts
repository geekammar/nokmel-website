import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  applyMigrations,
  emptyDatabase,
  getDisposablePostgres,
} from './helpers';
import {
  deliverNewJoinRequestNotification,
  retryJoinRequestNotification,
  joinNotificationStatus,
  sendOwnerTestNotification,
} from '@/lib/notifications/service';
import type {
  sendTelegramMessage,
  TelegramGetMeResult,
  TelegramSendResult,
} from '@/lib/notifications/telegram';
import { createJoinRequest, getJoinRequest } from '@/lib/join/service';
import { parseJoinSubmission } from '@/lib/join/validation';
import type { Db } from '@/lib/db/types';

/**
 * W5 durable notification state on disposable PostgreSQL:
 * accepted request survives delivery failure, disabled integrations make no
 * external call, duplicate delivery is suppressed, concurrent retry sends once,
 * and historical request fields are never rewritten. Never hosted Neon.
 */

const pg = await getDisposablePostgres();

const env = {
  BETTER_AUTH_URL: 'https://nokmel.tech',
  TELEGRAM_BOT_TOKEN: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij',
} as unknown as NodeJS.ProcessEnv;

const offerSnapshot = {
  version: 1,
  capturedAt: '2026-11-26T10:00:00.000Z',
  planId: 'notify-plan',
  planSlug: 'notify-plan',
  planName: 'باقة الإشعارات',
  currency: 'EGP',
  publishedRevision: 2,
  promotionState: 'active',
  effectiveOfferVersion: 'w41-0123456789abcdef',
  baseMonthlyPriceMinor: 19900,
  baseYearlyPriceMinor: 199000,
  effectiveMonthlyPriceMinor: 15920,
  effectiveYearlyPriceMinor: 159200,
  promotion: {
    label: 'عرض الإشعار',
    discountType: 'percentage',
    target: 'both',
    percentageBps: 2000,
    fixedMonthlyMinor: null,
    fixedYearlyMinor: null,
    startsAt: '2026-11-20T00:00:00.000Z',
    endsAt: '2026-12-01T00:00:00.000Z',
    monthlySavedMinor: 3980,
    yearlySavedMinor: 39800,
    monthlySavedPercentBps: 2000,
    yearlySavedPercentBps: 2000,
  },
};

type SentMessage = { token: string; chatId: string; text: string; apiBase: string };

function mockSend(result: Awaited<ReturnType<typeof sendTelegramMessage>>, sent: SentMessage[]) {
  return (async (args: SentMessage) => {
    sent.push(args);
    return result;
  }) as unknown as typeof sendTelegramMessage;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function startedSignal() {
  const signal = deferred<void>();
  return {
    markStarted: () => signal.resolve(),
    started: signal.promise,
  };
}

/**
 * Simulates failure to persist a completion result while keeping claim reads
 * and the claim update itself functional. Completion updates are the only
 * join_requests updates whose notification state is not 'sending'.
 */
function failingCompletionDb(
  base: Db,
  options: { failures?: number } = {},
): Db {
  let remaining = options.failures ?? Number.POSITIVE_INFINITY;
  return new Proxy(base, {
    get(target, property, receiver) {
      if (property === 'update') {
        return (table: Parameters<Db['update']>[0]) => {
          const builder = target.update(table) as unknown as {
            set: (values: Record<string, unknown>) => unknown;
          };
          const originalSet = builder.set.bind(builder);
          builder.set = (values: Record<string, unknown>) => {
            const next = originalSet(values) as {
              where: (...args: unknown[]) => unknown;
            };
            if (
              values &&
              (values.notificationState === 'sent' ||
                values.notificationState === 'failed' ||
                values.notificationState === 'uncertain') &&
              remaining > 0
            ) {
              remaining -= 1;
              return new Proxy(next, {
                get(nextTarget, nextProperty, nextReceiver) {
                  if (nextProperty === 'where') {
                    return () => {
                      throw new Error('simulated completion storage failure');
                    };
                  }
                  return Reflect.get(nextTarget, nextProperty, nextReceiver);
                },
              });
            }
            return next;
          };
          return builder;
        };
      }
      return Reflect.get(target, property, receiver);
    },
  }) as Db;
}

function successfulBotIdentity(): TelegramGetMeResult {
  return {
    kind: 'ok',
    bot: { id: '42', username: 'nokmel_test_bot', name: 'Nokmel Test' },
  };
}

beforeAll(async () => {
  await applyMigrations(pg);
});

beforeEach(async () => {
  await emptyDatabase(pg);
  await pg.pool.query(
    `insert into plans (id, slug, draft_name, draft_description, draft_currency, draft_cta_label, draft_revision)
     values ('notify-plan', 'notify-plan', 'باقة الإشعارات', 'وصف', 'EGP', 'اطلب الانضمام', 1)`,
  );
  await pg.pool.query(
    `insert into join_requests (
       id, name, phone, email, business_activity, plan_id, plan_name_snapshot,
       plan_currency_snapshot, offer_snapshot, source, status, notes,
       submission_token, revision, created_at, updated_at
     ) values (
       'notify-request', 'Private Trader', '+201000000001', 'private@example.com',
       'ملاحظات خاصة', 'notify-plan', 'باقة الإشعارات', 'EGP', $1::jsonb,
       'pricing', 'new', 'داخلية سرية', 'notify-token', 2, now(), now()
     )`,
    [JSON.stringify(offerSnapshot)],
  );
  await pg.pool.query(
    `insert into site_settings (id, notifications_enabled, telegram_chat_id)
     values ('default', true, '9876543210123')`,
  );
});

afterAll(async () => {
  await pg.stop();
});

describe('W5 owner notification delivery', () => {
  test('sends a bounded message, marks sent, and leaves the request untouched', async () => {
    const sent: SentMessage[] = [];
    const before = await getJoinRequest('notify-request', { db: pg.db });
    const outcome = await deliverNewJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 7 }, sent),
    });
    expect(outcome).toEqual({ status: 'sent', messageId: 7 });
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe('9876543210123');
    expect(sent[0].text).toContain('طلب انضمام جديد');
    expect(sent[0].text).toContain('باقة الإشعارات');
    expect(sent[0].text).toContain('https://nokmel.tech/admin/requests/notify-request');
    expect(sent[0].text).not.toContain('Private Trader');
    expect(sent[0].text).not.toContain('+201000000001');
    expect(sent[0].text).not.toContain('private@example.com');
    expect(sent[0].text).not.toContain('ملاحظات خاصة');
    expect(sent[0].text).not.toContain('داخلية سرية');

    const after = await getJoinRequest('notify-request', { db: pg.db });
    expect(after.status).toBe('ok');
    if (after.status !== 'ok' || before.status !== 'ok') return;
    expect(after.request.status).toBe('new');
    expect(after.request.revision).toBe(2);
    expect(after.request.notes).toBe('داخلية سرية');
    expect(after.request.offerSnapshot).toEqual(before.request.offerSnapshot);
    expect(after.request.name).toBe('Private Trader');
    expect(after.request.notification.state).toBe('sent');
    expect(after.request.notification.deliveredAt).not.toBeNull();
  });

  test('an accepted join commits independently of Telegram failure and same-token replay stays single-row', async () => {
    const parsed = parseJoinSubmission({
      name: 'Synthetic Accepted Trader',
      phone: '+201000000321',
      source: 'direct',
      submissionToken: 'w5-integration-accepted-token',
    });
    if (!parsed.ok) throw new Error('synthetic submission must validate');

    const created = await createJoinRequest(parsed.submission, { db: pg.db });
    expect(created.created).toBe(true);
    if (!created.created) return;

    const beforeDelivery = await pg.pool.query(
      'select notification_state, status from join_requests where id = $1',
      [created.id],
    );
    expect(beforeDelivery.rows[0]).toEqual({
      notification_state: 'pending',
      status: 'new',
    });

    const sent: SentMessage[] = [];
    const failed = await deliverNewJoinRequestNotification(created.id, {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'failed', code: 'rejected' }, sent),
    });
    expect(failed).toEqual({ status: 'failed', code: 'rejected' });

    const after = await getJoinRequest(created.id, { db: pg.db });
    if (after.status !== 'ok') throw new Error('accepted request must remain stored');
    expect(after.request.status).toBe('new');
    expect(after.request.name).toBe('Synthetic Accepted Trader');
    expect(after.request.notification.state).toBe('failed');

    const replay = await createJoinRequest(parsed.submission, { db: pg.db });
    expect(replay).toEqual({ created: false, duplicate: true });
    const count = await pg.pool.query(
      'select count(*)::int as count from join_requests where submission_token = $1',
      [parsed.submission.submissionToken],
    );
    expect(count.rows[0].count).toBe(1);
  });

  test('owner test succeeds while automatic delivery is disabled, never enables it, and stays rate-limited', async () => {
    await pg.pool.query(
      "update site_settings set notifications_enabled = false, last_notification_test_at = null where id = 'default'",
    );
    const sent: SentMessage[] = [];
    let getMeCalls = 0;
    const result = await sendOwnerTestNotification({
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 5 }, sent),
      getBotIdentity: (async () => {
        getMeCalls += 1;
        return successfulBotIdentity();
      }) as unknown as typeof import('@/lib/notifications/telegram').getTelegramBotIdentity,
    });
    expect(result).toEqual({
      ok: true,
      botUsername: 'nokmel_test_bot',
      botName: 'Nokmel Test',
    });
    expect(getMeCalls).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe('9876543210123');
    expect(sent[0].text).toContain('رسالة تجريبية');
    expect(sent[0].text).not.toContain('Private Trader');
    expect(sent[0].text).not.toContain('+201');

    const settings = await pg.pool.query(
      "select notifications_enabled, telegram_bot_username from site_settings where id = 'default'",
    );
    expect(settings.rows[0]).toEqual({
      notifications_enabled: false,
      telegram_bot_username: 'nokmel_test_bot',
    });

    const second = await sendOwnerTestNotification({
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 6 }, sent),
      getBotIdentity: (async () => successfulBotIdentity()) as unknown as typeof import('@/lib/notifications/telegram').getTelegramBotIdentity,
    });
    expect(second).toEqual({ ok: false, code: 'rate_limited' });
    expect(sent).toHaveLength(1);

    // A new accepted request while automatic delivery is disabled makes no
    // external call and records the truthful skipped state.
    const notifications: SentMessage[] = [];
    const delivery = await deliverNewJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 7 }, notifications),
    });
    expect(delivery).toEqual({ status: 'skipped', reason: 'disabled' });
    expect(notifications).toHaveLength(0);

    await pg.pool.query(
      "update site_settings set telegram_chat_id = null where id = 'default'",
    );
    const missingDestination = await sendOwnerTestNotification({
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 8 }, sent),
      getBotIdentity: (async () => successfulBotIdentity()) as unknown as typeof import('@/lib/notifications/telegram').getTelegramBotIdentity,
    });
    expect(missingDestination).toEqual({ ok: false, code: 'not_configured' });
    expect(sent).toHaveLength(1);
  });

  test('disabled notifications are skipped without any external call', async () => {
    await pg.pool.query('delete from site_settings');
    let calls = 0;
    const outcome = await deliverNewJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: (async () => {
        calls += 1;
        return { kind: 'sent', messageId: 1 };
      }) as unknown as typeof sendTelegramMessage,
    });
    expect(outcome).toEqual({ status: 'skipped', reason: 'disabled' });
    expect(calls).toBe(0);
    const detail = await getJoinRequest('notify-request', { db: pg.db });
    if (detail.status !== 'ok') throw new Error('missing request');
    expect(detail.request.notification.state).toBe('skipped');
    expect(detail.request.notification.errorCode).toBe('disabled');
  });

  test('a delivery failure never loses the accepted request and supports manual retry', async () => {
    const sent: SentMessage[] = [];
    const failed = await deliverNewJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'failed', code: 'rejected' }, sent),
    });
    expect(failed).toEqual({ status: 'failed', code: 'rejected' });

    const afterFailure = await getJoinRequest('notify-request', { db: pg.db });
    if (afterFailure.status !== 'ok') throw new Error('missing request');
    expect(afterFailure.request.status).toBe('new');
    expect(afterFailure.request.notification.state).toBe('failed');
    expect(afterFailure.request.notification.canRetry).toBe(true);
    const count = await pg.pool.query(
      "select count(*)::int as count from join_requests where id = 'notify-request'",
    );
    expect(count.rows[0].count).toBe(1);

    const retried = await retryJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 9 }, sent),
    });
    expect(retried).toEqual({ status: 'sent', messageId: 9 });
    const afterRetry = await getJoinRequest('notify-request', { db: pg.db });
    if (afterRetry.status !== 'ok') throw new Error('missing request');
    expect(afterRetry.request.notification.state).toBe('sent');
  });

  test('an ambiguous provider result is recorded as uncertain and warns about duplicates', async () => {
    const sent: SentMessage[] = [];
    const outcome = await deliverNewJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'uncertain', code: 'http_error' }, sent),
    });
    expect(outcome).toEqual({ status: 'uncertain', code: 'http_error' });
    const detail = await getJoinRequest('notify-request', { db: pg.db });
    if (detail.status !== 'ok') throw new Error('missing request');
    expect(detail.request.notification.state).toBe('uncertain');
    expect(detail.request.notification.mayDuplicate).toBe(true);
    expect(detail.request.notification.canRetry).toBe(true);
  });

  test('duplicate delivery calls are suppressed after the first claim', async () => {
    const sent: SentMessage[] = [];
    const sendMessage = mockSend({ kind: 'sent', messageId: 3 }, sent);
    const first = await deliverNewJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage,
    });
    const second = await deliverNewJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage,
    });
    expect(first).toEqual({ status: 'sent', messageId: 3 });
    expect(second).toEqual({ status: 'skipped', reason: 'already_processed' });
    expect(sent).toHaveLength(1);
  });

  test('concurrent retry claims send only one Telegram message', async () => {
    await pg.pool.query(
      "update join_requests set notification_state = 'failed' where id = 'notify-request'",
    );
    let calls = 0;
    const slowSend = (async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 60));
      return { kind: 'sent', messageId: 11 };
    }) as unknown as typeof sendTelegramMessage;

    const outcomes = await Promise.all([
      retryJoinRequestNotification('notify-request', {
        db: pg.db,
        env,
        sendMessage: slowSend,
      }),
      retryJoinRequestNotification('notify-request', {
        db: pg.db,
        env,
        sendMessage: slowSend,
      }),
    ]);
    expect(calls).toBe(1);
    expect(outcomes.filter((outcome) => outcome.status === 'sent')).toHaveLength(1);
    expect(
      outcomes.some(
        (outcome) =>
          outcome.status === 'in_progress' ||
          (outcome.status === 'skipped' && outcome.reason === 'already_processed'),
      ),
    ).toBe(true);
  });

  test('an old failed attempt cannot overwrite a newer successful claim', async () => {
    await pg.pool.query(
      "update join_requests set notification_state = 'failed' where id = 'notify-request'",
    );
    const started = startedSignal();
    const oldResult = deferred<TelegramSendResult>();
    const oldAttempt = retryJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: (async () => {
        started.markStarted();
        return oldResult.promise;
      }) as unknown as typeof sendTelegramMessage,
    });
    await started.started;
    // Simulate the old claim becoming stale while its provider call is delayed.
    await pg.pool.query(
      "update join_requests set notification_attempted_at = now() - interval '10 minutes' where id = 'notify-request' and notification_state = 'sending'",
    );
    const newer = await retryJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 21 }, []),
    });
    expect(newer).toEqual({ status: 'sent', messageId: 21 });

    oldResult.resolve({ kind: 'failed', code: 'rejected' });
    const oldOutcome = await oldAttempt;
    expect(oldOutcome).toEqual({ status: 'already_sent' });

    const row = await pg.pool.query(
      "select notification_state, notification_delivered_at, notification_error_code from join_requests where id = 'notify-request'",
    );
    expect(row.rows[0].notification_state).toBe('sent');
    expect(row.rows[0].notification_delivered_at).not.toBeNull();
    expect(row.rows[0].notification_error_code).toBeNull();
  });

  test('an old success cannot overwrite a newer in-progress claim', async () => {
    await pg.pool.query(
      "update join_requests set notification_state = 'failed' where id = 'notify-request'",
    );
    const oldStarted = startedSignal();
    const oldResult = deferred<TelegramSendResult>();
    const oldAttempt = retryJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: (async () => {
        oldStarted.markStarted();
        return oldResult.promise;
      }) as unknown as typeof sendTelegramMessage,
    });
    await oldStarted.started;
    await pg.pool.query(
      "update join_requests set notification_attempted_at = now() - interval '10 minutes' where id = 'notify-request' and notification_state = 'sending'",
    );

    const newerStarted = startedSignal();
    const newerResult = deferred<TelegramSendResult>();
    const newerAttempt = retryJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: (async () => {
        newerStarted.markStarted();
        return newerResult.promise;
      }) as unknown as typeof sendTelegramMessage,
    });
    await newerStarted.started;

    oldResult.resolve({ kind: 'sent', messageId: 31 });
    const oldOutcome = await oldAttempt;
    expect(oldOutcome).toEqual({ status: 'in_progress' });

    const duringNewer = await pg.pool.query(
      "select notification_state, notification_delivered_at from join_requests where id = 'notify-request'",
    );
    expect(duringNewer.rows[0]).toEqual({
      notification_state: 'sending',
      notification_delivered_at: null,
    });

    newerResult.resolve({ kind: 'failed', code: 'rejected' });
    const newerOutcome = await newerAttempt;
    expect(newerOutcome).toEqual({ status: 'failed', code: 'rejected' });
    const finalRow = await pg.pool.query(
      "select notification_state, notification_delivered_at from join_requests where id = 'notify-request'",
    );
    expect(finalRow.rows[0]).toEqual({
      notification_state: 'failed',
      notification_delivered_at: null,
    });
  });

  test('provider success followed by completion-storage failure is uncertain, not unsent', async () => {
    const sent: SentMessage[] = [];
    const outcome = await deliverNewJoinRequestNotification('notify-request', {
      db: failingCompletionDb(pg.db),
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 41 }, sent),
    });
    expect(sent).toHaveLength(1);
    expect(outcome).toEqual({ status: 'uncertain', code: 'persistence' });

    const row = await pg.pool.query(
      "select notification_state, notification_delivered_at from join_requests where id = 'notify-request'",
    );
    // The claim remains recoverable after the five-minute stale window; it is
    // not falsely marked sent or failed.
    expect(row.rows[0]).toEqual({
      notification_state: 'sending',
      notification_delivered_at: null,
    });
  });

  test('a transient completion failure leaves a durable uncertain persistence state', async () => {
    const sent: SentMessage[] = [];
    const outcome = await deliverNewJoinRequestNotification('notify-request', {
      db: failingCompletionDb(pg.db, { failures: 1 }),
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 42 }, sent),
    });
    expect(sent).toHaveLength(1);
    expect(outcome).toEqual({ status: 'uncertain', code: 'persistence' });

    const row = await pg.pool.query(
      "select notification_state, notification_error_code, notification_delivered_at from join_requests where id = 'notify-request'",
    );
    expect(row.rows[0]).toEqual({
      notification_state: 'uncertain',
      notification_error_code: 'persistence',
      notification_delivered_at: null,
    });
    const detail = await getJoinRequest('notify-request', { db: pg.db });
    if (detail.status !== 'ok') throw new Error('missing request');
    expect(detail.request.notification.canRetry).toBe(true);
    expect(detail.request.notification.mayDuplicate).toBe(true);
  });

  test('a stale sending claim is recoverable with an explicit retry', async () => {
    await pg.pool.query(
      "update join_requests set notification_state = 'sending', notification_attempted_at = now() - interval '10 minutes' where id = 'notify-request'",
    );
    const outcome = await retryJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 51 }, []),
    });
    expect(outcome).toEqual({ status: 'sent', messageId: 51 });
    const row = await pg.pool.query(
      "select notification_state from join_requests where id = 'notify-request'",
    );
    expect(row.rows[0].notification_state).toBe('sent');
  });

  test('a sent notification is never automatically resent', async () => {
    const sent: SentMessage[] = [];
    await deliverNewJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 1 }, sent),
    });
    const retry = await retryJoinRequestNotification('notify-request', {
      db: pg.db,
      env,
      sendMessage: mockSend({ kind: 'sent', messageId: 2 }, sent),
    });
    expect(retry).toEqual({ status: 'already_sent' });
    expect(sent).toHaveLength(1);
  });

  test('legacy requests without an attempt have no retry action', async () => {
    const status = joinNotificationStatus({
      notificationState: null,
      notificationAttemptedAt: null,
      notificationDeliveredAt: null,
      notificationErrorCode: null,
    });
    expect(status.state).toBeNull();
    expect(status.canRetry).toBe(false);
    expect(status.mayDuplicate).toBe(false);
  });
});
