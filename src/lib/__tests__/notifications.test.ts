import { describe, expect, test } from 'vitest';
import type { OfferSnapshot } from '@/lib/join/snapshot';
import {
  TELEGRAM_TEST_MESSAGE,
  buildAdminRequestUrl,
  buildJoinNotificationMessage,
} from '@/lib/notifications/message';
import {
  NOTIFICATION_CLAIM_STALE_MS,
  joinNotificationStatus,
} from '@/lib/notifications/service';

const env = {
  BETTER_AUTH_URL: 'https://nokmel.tech',
} as unknown as NodeJS.ProcessEnv;

function snapshot(overrides: Partial<OfferSnapshot> = {}): OfferSnapshot {
  return {
    version: 1,
    capturedAt: '2026-11-26T10:00:00.000Z',
    planId: 'plan-1',
    planSlug: 'starter',
    planName: 'الباقة الأساسية',
    currency: 'EGP',
    publishedRevision: 3,
    promotionState: 'active',
    effectiveOfferVersion: 'w41-0123456789abcdef',
    baseMonthlyPriceMinor: 19900,
    baseYearlyPriceMinor: 199000,
    effectiveMonthlyPriceMinor: 15920,
    effectiveYearlyPriceMinor: 159200,
    promotion: {
      label: 'عرض الانضمام المبكر',
      discountType: 'percentage',
      target: 'both',
      percentageBps: 2000,
      fixedMonthlyMinor: null,
      fixedYearlyMinor: null,
      startsAt: '2026-11-20T00:00:00.000Z',
      endsAt: '2026-12-01T21:00:00.000Z',
      monthlySavedMinor: 3980,
      yearlySavedMinor: 39800,
      monthlySavedPercentBps: 2000,
      yearlySavedPercentBps: 2000,
    },
    ...overrides,
  };
}

describe('owner Telegram message', () => {
  test('contains only bounded request context and a validated owner link', () => {
    const message = buildJoinNotificationMessage(
      {
        id: 'request-123',
        planName: 'الباقة الأساسية',
        source: 'pricing',
        offerSnapshot: snapshot(),
        offerSnapshotInvalid: false,
        createdAt: '2026-11-26T10:05:00.000Z',
      },
      env,
    );
    expect(message).toContain('طلب انضمام جديد');
    expect(message).toContain('الحالة: طلب جديد');
    expect(message).toContain('الخطة المطلوبة: الباقة الأساسية');
    expect(message).toContain('مصدر الوصول: صفحة الأسعار');
    expect(message).toContain('نعم — عرض الانضمام المبكر');
    expect(message).toContain('https://nokmel.tech/admin/requests/request-123');
    expect(message).toContain('بتوقيت القاهرة');
    expect(message).not.toContain('+201');
    expect(message).not.toContain('@example.com');
  });

  test('distinguishes captured no-promotion, legacy unknown and no-plan context', () => {
    const noPromotion = buildJoinNotificationMessage(
      {
        id: 'request-1',
        planName: 'باقة',
        source: 'direct',
        offerSnapshot: snapshot({ promotion: null, promotionState: 'none' }),
        offerSnapshotInvalid: false,
        createdAt: '2026-11-26T10:05:00.000Z',
      },
      env,
    );
    expect(noPromotion).toContain('لا — لم يكن هناك عرض فعّال وقت الإرسال');

    const legacy = buildJoinNotificationMessage(
      {
        id: 'request-1',
        planName: 'باقة قديمة',
        source: 'join',
        offerSnapshot: null,
        offerSnapshotInvalid: false,
        createdAt: '2026-11-26T10:05:00.000Z',
      },
      env,
    );
    expect(legacy).toContain('غير معروف — سجل قديم');

    const noPlan = buildJoinNotificationMessage(
      {
        id: 'request-1',
        planName: null,
        source: 'direct',
        offerSnapshot: null,
        offerSnapshotInvalid: false,
        createdAt: '2026-11-26T10:05:00.000Z',
      },
      env,
    );
    expect(noPlan).toContain('لا ينطبق — لم تُختر باقة');
  });

  test('sanitizes owner-entered labels and never emits Telegram markup', () => {
    const message = buildJoinNotificationMessage(
      {
        id: 'request-123',
        planName: 'باقة <b>خطيرة</b>\nسطر ثانٍ',
        source: 'direct',
        offerSnapshot: snapshot({
          promotion: {
            ...snapshot().promotion!,
            label: 'عرض <a href="https://evil.example">اضغط</a>',
          },
        }),
        offerSnapshotInvalid: false,
        createdAt: '2026-11-26T10:05:00.000Z',
      },
      env,
    );
    expect(message).not.toBeNull();
    if (!message) return;
    expect(message).not.toMatch(/\nسطر ثانٍ/);
    expect(message).toContain('<b>');
    expect(message).toContain('<a href=');
    // No parse_mode is used by the adapter, so angle brackets are inert text.
    expect(message.split('\n').length).toBe(7);
  });

  test('rejects an invalid application origin instead of trusting headers', () => {
    expect(
      buildJoinNotificationMessage(
        {
          id: 'request-123',
          planName: null,
          source: 'direct',
          offerSnapshot: null,
          offerSnapshotInvalid: false,
          createdAt: '2026-11-26T10:05:00.000Z',
        },
        { BETTER_AUTH_URL: 'http://evil.example' } as unknown as NodeJS.ProcessEnv,
      ),
    ).toBeNull();
    expect(
      buildAdminRequestUrl('request-123', { BETTER_AUTH_URL: 'https://nokmel.tech' } as unknown as NodeJS.ProcessEnv),
    ).toBe('https://nokmel.tech/admin/requests/request-123');
    expect(
      buildAdminRequestUrl('bad/id', { BETTER_AUTH_URL: 'https://nokmel.tech' } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  test('test message is synthetic and contains no request context', () => {
    expect(TELEGRAM_TEST_MESSAGE).toContain('رسالة تجريبية');
    expect(TELEGRAM_TEST_MESSAGE).not.toContain('+20');
    expect(TELEGRAM_TEST_MESSAGE).not.toContain('@');
  });
});

describe('notification state visibility', () => {
  const base = {
    notificationAttemptedAt: null,
    notificationDeliveredAt: null,
    notificationErrorCode: null,
  };

  test('maps states truthfully and exposes retry only when safe', () => {
    expect(joinNotificationStatus({ ...base, notificationState: null }).state).toBeNull();
    expect(joinNotificationStatus({ ...base, notificationState: 'sent' }).canRetry).toBe(false);
    expect(joinNotificationStatus({ ...base, notificationState: 'failed' }).canRetry).toBe(true);
    const uncertain = joinNotificationStatus({ ...base, notificationState: 'uncertain' });
    expect(uncertain.canRetry).toBe(true);
    expect(uncertain.mayDuplicate).toBe(true);
    const skipped = joinNotificationStatus({ ...base, notificationState: 'skipped' });
    expect(skipped.canRetry).toBe(true);
    expect(skipped.mayDuplicate).toBe(false);
  });

  test('a fresh sending claim is not retryable; a stale claim is', () => {
    const now = new Date('2026-11-26T12:00:00.000Z');
    const fresh = joinNotificationStatus(
      {
        ...base,
        notificationState: 'sending',
        notificationAttemptedAt: new Date(now.getTime() - 60_000),
      },
      now,
    );
    expect(fresh.canRetry).toBe(false);
    expect(fresh.mayDuplicate).toBe(false);

    const stale = joinNotificationStatus(
      {
        ...base,
        notificationState: 'sending',
        notificationAttemptedAt: new Date(now.getTime() - NOTIFICATION_CLAIM_STALE_MS - 1),
      },
      now,
    );
    expect(stale.canRetry).toBe(true);
    expect(stale.mayDuplicate).toBe(true);
  });
});
