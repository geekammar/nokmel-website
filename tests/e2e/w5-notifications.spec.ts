import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? '';
const TELEGRAM_STUB = 'http://127.0.0.1:3301';

type StubMessage = { chat_id: string; text: string; parse_mode: string | null };

test.skip(!enabled, 'Admin e2e environment is not configured');
test.describe.configure({ mode: 'serial' });

async function withPool<T>(operation: (pool: import('pg').Pool) => Promise<T>): Promise<T> {
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    return await operation(pool);
  } finally {
    await pool.end();
  }
}

async function resetData(): Promise<void> {
  await withPool(async (pool) => {
    await pool.query('truncate table join_requests, plans, site_settings cascade');
  });
  await fetch(`${TELEGRAM_STUB}/__reset`, { method: 'POST' });
}

async function telegramControl(mode: 'ok' | 'fail' | 'uncertain'): Promise<void> {
  await fetch(`${TELEGRAM_STUB}/__control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

async function telegramMessages(): Promise<StubMessage[]> {
  const response = await fetch(`${TELEGRAM_STUB}/__messages`);
  return (await response.json()) as StubMessage[];
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('#admin-email', OWNER_EMAIL);
  await page.fill('#admin-password', OWNER_PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/admin$/);
}

async function submitJoin(page: Page, payload: Record<string, unknown>) {
  return page.request.post('/api/join', {
    data: payload,
    headers: { origin: 'http://127.0.0.1:3100' },
  });
}

async function notificationSettings(): Promise<{
  notifications_enabled: boolean;
  telegram_chat_id: string | null;
}> {
  return withPool(async (pool) => {
    const { rows } = await pool.query(
      "select notifications_enabled, telegram_chat_id from site_settings where id = 'default'",
    );
    return rows[0];
  });
}

async function requestIdForToken(token: string): Promise<string> {
  return withPool(async (pool) => {
    const { rows } = await pool.query(
      'select id from join_requests where submission_token = $1',
      [token],
    );
    if (!rows[0]) throw new Error('join request not found');
    return rows[0].id as string;
  });
}

const privateName = 'E2E Notification Private Name';
const privatePhone = '+201000000777';
const privateEmail = 'e2e-private@example.com';
const privateActivity = 'E2E Private Activity';

function joinPayload(token: string) {
  return {
    name: privateName,
    phone: privatePhone,
    email: privateEmail,
    businessActivity: privateActivity,
    source: 'pricing',
    submissionToken: token,
  };
}

let ownerCookies: Awaited<ReturnType<import('@playwright/test').BrowserContext['cookies']>> = [];

test.beforeEach(async ({ page }) => {
  if (ownerCookies.length > 0) await page.context().addCookies(ownerCookies);
});

test.beforeAll(async ({ browser }) => {
  await resetData();
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  ownerCookies = await context.cookies();
  await context.close();
});

test.afterAll(async () => {
  await resetData().catch(() => undefined);
});

test('owner saves a destination, tests while automatic delivery is disabled, then enables it', async ({
  page,
}) => {
  await page.goto('/admin/settings');
  await expect(page.getByText('لم تُضبط وجهة بعد')).toBeVisible();
  await page.fill('#settings-telegram-chat-id', '9876543210123');
  // Deliberately save with automatic delivery still disabled.
  await expect(page.getByTestId('settings-notifications-enabled')).not.toBeChecked();
  await page.getByTestId('settings-notifications-save').click();
  await expect(page.getByText('تم حفظ إعدادات الإشعارات.')).toBeVisible();
  await expect(page.getByText('وجهة محفوظة')).toBeVisible();
  expect(await notificationSettings()).toEqual({
    notifications_enabled: false,
    telegram_chat_id: '9876543210123',
  });

  // A numeric destination alone is not verification: enabling before a
  // successful test is refused server-side and changes nothing.
  await page.getByTestId('settings-notifications-enabled').check();
  await page.getByTestId('settings-notifications-save').click();
  await expect(
    page.getByText('أرسل اختباراً ناجحاً للوجهة المحفوظة الحالية قبل تفعيل الإرسال التلقائي', {
      exact: false,
    }),
  ).toBeVisible();
  expect(await notificationSettings()).toEqual({
    notifications_enabled: false,
    telegram_chat_id: '9876543210123',
  });
  await page.getByTestId('settings-notifications-enabled').uncheck();

  await page.getByTestId('settings-notifications-test').click();
  await expect(
    page.getByText('نجح الاختبار ووصلت الرسالة التجريبية إلى الوجهة المحفوظة.', {
      exact: false,
    }),
  ).toBeVisible();
  // Testing must not enable automatic delivery as a side effect.
  expect(await notificationSettings()).toEqual({
    notifications_enabled: false,
    telegram_chat_id: '9876543210123',
  });
  await expect(page.getByTestId('settings-notifications-enabled')).not.toBeChecked();

  await page.getByTestId('settings-notifications-enabled').check();
  await page.getByTestId('settings-notifications-save').click();
  await expect(page.getByText('تم حفظ إعدادات الإشعارات.')).toBeVisible();
  expect(await notificationSettings()).toEqual({
    notifications_enabled: true,
    telegram_chat_id: '9876543210123',
  });

  await page.reload();
  await expect(page.getByText('@nokmel_e2e_bot')).toBeVisible();

  const messages = await telegramMessages();
  expect(messages).toHaveLength(1);
  expect(messages[0].chat_id).toBe('9876543210123');
  expect(messages[0].text).toContain('رسالة تجريبية');
  expect(messages[0].parse_mode).toBeNull();
  expect(messages[0].text).not.toContain(privateName);
});

test('accepted request sends a notification without personal data and replay does not duplicate', async ({
  page,
}) => {
  // A rejected submission must never create a request or a notification.
  const invalid = await submitJoin(page, {
    phone: privatePhone,
    source: 'direct',
    submissionToken: `w5-invalid-${randomUUID()}`,
  });
  expect(invalid.status()).toBe(400);
  expect(
    (await telegramMessages()).filter((message) =>
      message.text.startsWith('طلب انضمام جديد'),
    ),
  ).toHaveLength(0);

  const token = `w5-e2e-${randomUUID()}`;
  const payload = joinPayload(token);
  const response = await submitJoin(page, payload);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true, status: 'received' });

  const requestId = await requestIdForToken(token);
  const firstMessages = await telegramMessages();
  const notifications = firstMessages.filter((message) =>
    message.text.startsWith('طلب انضمام جديد'),
  );
  expect(notifications).toHaveLength(1);
  expect(notifications[0].chat_id).toBe('9876543210123');
  expect(notifications[0].text).toContain(`/admin/requests/${requestId}`);
  expect(notifications[0].text).not.toContain(privateName);
  expect(notifications[0].text).not.toContain(privatePhone);
  expect(notifications[0].text).not.toContain(privateEmail);
  expect(notifications[0].text).not.toContain(privateActivity);
  expect(notifications[0].parse_mode).toBeNull();

  // Same-token replay is an idempotent success and must not create another
  // request or another notification.
  const replay = await submitJoin(page, payload);
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual({ ok: true, status: 'received' });
  const count = await withPool(async (pool) => {
    const { rows } = await pool.query(
      'select count(*)::int as count from join_requests where submission_token = $1',
      [token],
    );
    return rows[0].count as number;
  });
  expect(count).toBe(1);
  const secondMessages = (await telegramMessages()).filter((message) =>
    message.text.startsWith('طلب انضمام جديد'),
  );
  expect(secondMessages).toHaveLength(1);

  await page.goto(`/admin/requests/${requestId}`);
  await expect(page.getByTestId('request-notification-state')).toContainText('أُرسل بنجاح');
  await expect(page.getByTestId('request-notification-retry')).toHaveCount(0);
  await expect(page.locator('main#admin-content h1')).toContainText(privateName);
});

test('a failed notification keeps the request and supports an explicit retry', async ({ page }) => {
  await telegramControl('fail');
  const token = `w5-e2e-${randomUUID()}`;
  const response = await submitJoin(page, joinPayload(token));
  expect(response.status()).toBe(200);
  const requestId = await requestIdForToken(token);

  await page.goto(`/admin/requests/${requestId}`);
  await expect(page.getByTestId('request-notification-state')).toContainText('فشل الإرسال');
  await expect(page.locator('main#admin-content h1')).toContainText(privateName);
  await expect(page.getByText('جديدة').first()).toBeVisible();

  await page.getByTestId('request-notification-retry').click();
  await expect(page.getByTestId('request-notification-banner')).toContainText(
    'تعذّر إرسال الإشعار. بقي الطلب محفوظاً دون تغيير.',
  );

  await telegramControl('ok');
  await page.getByTestId('request-notification-retry').click();
  await expect(page.getByTestId('request-notification-banner')).toContainText(
    'تم إرسال إشعار المالك.',
  );
  await expect(page.getByTestId('request-notification-state')).toContainText('أُرسل بنجاح');

  const messages = (await telegramMessages()).filter((message) =>
    message.text.startsWith('طلب انضمام جديد'),
  );
  expect(messages).toHaveLength(2);
});

test('changing the destination clears verification without enabling delivery', async ({
  page,
}) => {
  await page.goto('/admin/settings');
  await page.fill('#settings-telegram-chat-id', '111222333444');
  await page.getByTestId('settings-notifications-enabled').uncheck();
  await page.getByTestId('settings-notifications-save').click();
  await expect(page.getByText('تم حفظ إعدادات الإشعارات.')).toBeVisible();
  await page.reload();

  await expect(page.getByTestId('settings-bot-identity')).toContainText(
    'تظهر بعد أول اختبار ناجح',
  );
  await expect(page.getByTestId('settings-last-test')).toHaveText('—');
  expect(await notificationSettings()).toEqual({
    notifications_enabled: false,
    telegram_chat_id: '111222333444',
  });
});

test('disabled notifications skip truthfully without an external call', async ({ page }) => {
  await page.goto('/admin/settings');
  await page.getByTestId('settings-notifications-enabled').uncheck();
  await page.getByTestId('settings-notifications-save').click();
  await expect(page.getByText('تم حفظ إعدادات الإشعارات.')).toBeVisible();

  const token = `w5-e2e-${randomUUID()}`;
  const response = await submitJoin(page, joinPayload(token));
  expect(response.status()).toBe(200);
  const requestId = await requestIdForToken(token);
  await page.goto(`/admin/requests/${requestId}`);
  await expect(page.getByTestId('request-notification-state')).toContainText(
    'لم يُرسل — إشعارات المالك كانت معطّلة',
  );
  const notifications = (await telegramMessages()).filter((message) =>
    message.text.startsWith('طلب انضمام جديد'),
  );
  expect(notifications).toHaveLength(2);
});

void telegramControl;
void OWNER_PASSWORD;
