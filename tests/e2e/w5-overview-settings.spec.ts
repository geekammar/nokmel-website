import { expect, test, type Page } from '@playwright/test';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? '';

test.skip(!enabled, 'Admin e2e environment is not configured');
test.describe.configure({ mode: 'serial' });

const GA_STUB = 'http://127.0.0.1:3300';
const TELEGRAM_STUB = 'http://127.0.0.1:3301';

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
}

async function gaControl(mode: 'ok' | 'error'): Promise<void> {
  await fetch(`${GA_STUB}/__control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

async function signIn(page: Page, base = 'http://127.0.0.1:3100'): Promise<void> {
  await page.goto(`${base}/admin/login`);
  await page.fill('#admin-email', OWNER_EMAIL);
  await page.fill('#admin-password', OWNER_PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/admin$/);
}

const snapshot = (args: {
  planId: string;
  planName: string;
  promotionState: 'none' | 'active';
}) => ({
  version: 1,
  capturedAt: new Date().toISOString(),
  planId: args.planId,
  planSlug: args.planId,
  planName: args.planName,
  currency: 'EGP',
  publishedRevision: 2,
  promotionState: args.promotionState,
  effectiveOfferVersion: 'w41-0123456789abcdef',
  baseMonthlyPriceMinor: 19900,
  baseYearlyPriceMinor: 199000,
  effectiveMonthlyPriceMinor: args.promotionState === 'active' ? 15920 : 19900,
  effectiveYearlyPriceMinor: args.promotionState === 'active' ? 159200 : 199000,
  promotion:
    args.promotionState === 'active'
      ? {
          label: 'عرض E2E',
          discountType: 'percentage',
          target: 'both',
          percentageBps: 2000,
          fixedMonthlyMinor: null,
          fixedYearlyMinor: null,
          startsAt: new Date(Date.now() - 86_400_000).toISOString(),
          endsAt: new Date(Date.now() + 86_400_000).toISOString(),
          monthlySavedMinor: 3980,
          yearlySavedMinor: 39800,
          monthlySavedPercentBps: 2000,
          yearlySavedPercentBps: 2000,
        }
      : null,
});

async function seedOverviewData(): Promise<void> {
  await withPool(async (pool) => {
    await pool.query('truncate table join_requests, plans, site_settings cascade');
    await pool.query(
      `insert into plans (id, slug, draft_name, draft_description, draft_currency, draft_cta_label, draft_revision)
       values ('e2e-plan-1', 'e2e-plan-1', 'باقة E2E الأولى', 'وصف', 'EGP', 'اطلب الانضمام', 1),
              ('e2e-plan-2', 'e2e-plan-2', 'باقة E2E الثانية', 'وصف', 'EGP', 'اطلب الانضمام', 1)`,
    );
    const rows: Array<{
      id: string;
      name: string;
      days: number;
      status: string;
      source: string;
      planId: string | null;
      planName: string | null;
      offer: unknown;
      utm: string | null;
    }> = [
      {
        id: 'e2e-request-alpha',
        name: 'E2E Alpha Trader',
        days: 1,
        status: 'new',
        source: 'pricing',
        planId: 'e2e-plan-1',
        planName: 'باقة E2E الأولى',
        offer: snapshot({
          planId: 'e2e-plan-1',
          planName: 'باقة E2E الأولى',
          promotionState: 'active',
        }),
        utm: 'google',
      },
      {
        id: 'e2e-request-beta',
        name: 'E2E Beta Trader',
        days: 2,
        status: 'new',
        source: 'direct',
        planId: 'e2e-plan-2',
        planName: 'باقة E2E الثانية',
        offer: snapshot({
          planId: 'e2e-plan-2',
          planName: 'باقة E2E الثانية',
          promotionState: 'none',
        }),
        utm: null,
      },
      {
        id: 'e2e-request-gamma',
        name: 'E2E Gamma Trader',
        days: 3,
        status: 'contacted',
        source: 'join',
        planId: null,
        planName: null,
        offer: null,
        utm: null,
      },
      {
        id: 'e2e-request-delta',
        name: 'E2E Delta Trader',
        days: 10,
        status: 'closed',
        source: 'direct',
        planId: 'e2e-plan-1',
        planName: 'باقة E2E القديمة',
        offer: null,
        utm: null,
      },
      {
        id: 'e2e-request-epsilon',
        name: 'E2E Epsilon Trader',
        days: 20,
        status: 'new',
        source: 'direct',
        planId: null,
        planName: null,
        offer: null,
        utm: null,
      },
    ];
    for (const row of rows) {
      await pool.query(
        `insert into join_requests (
           id, name, phone, plan_id, plan_name_snapshot, plan_currency_snapshot,
           offer_snapshot, source, utm_source, status, submission_token, revision,
           created_at, updated_at
         ) values ($1, $2, '+201000000099', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, 0,
                   now() - ($11 || ' days')::interval, now() - ($11 || ' days')::interval)`,
        [
          row.id,
          row.name,
          row.planId,
          row.planName,
          row.planId ? 'EGP' : null,
          row.offer === null ? null : JSON.stringify(row.offer),
          row.source,
          row.utm,
          row.status,
          `token-${row.id}`,
          String(row.days),
        ],
      );
    }
  });
}

let ownerCookies: Awaited<ReturnType<import('@playwright/test').BrowserContext['cookies']>> = [];

test.beforeEach(async ({ page }) => {
  if (ownerCookies.length > 0) await page.context().addCookies(ownerCookies);
});

test.beforeAll(async ({ browser }) => {
  await resetData();
  await gaControl('ok');
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  ownerCookies = await context.cookies();
  await context.close();
});

test.afterAll(async () => {
  await resetData().catch(() => undefined);
  await gaControl('ok').catch(() => undefined);
});

test('genuine zero overview and disabled analytics are honest', async ({ page }) => {
  await page.goto('/admin?period=7');
  await expect(page.getByTestId('overview-received')).toContainText('0');
  await expect(page.getByTestId('overview-backlog')).toContainText('0');
  await expect(page.getByText('لا توجد طلبات محفوظة في هذه الفترة')).toBeVisible();
  await expect(page.getByText('التحليلات معطّلة من إعدادات الموقع')).toBeVisible();
});

test('seeded overview shows period KPIs, breakdowns, latest links and responsive layout', async ({
  page,
}) => {
  await seedOverviewData();
  await page.goto('/admin?period=7');
  await expect(page.getByTestId('overview-received')).toContainText('3');
  await expect(page.getByTestId('overview-backlog')).toContainText('3');
  await expect(page.getByTestId('overview-contacted')).toContainText('1');
  await expect(page.getByTestId('overview-no-plan')).toContainText('1');
  await expect(page.getByTestId('overview-latest')).toContainText('E2E Alpha Trader');
  // Latest is explicitly all-time, so an older seeded row is still listed.
  await expect(page.getByTestId('overview-latest')).toContainText('E2E Delta Trader');
  await expect(page.getByText('باقة E2E الأولى').first()).toBeVisible();
  await expect(page.getByText('بدون باقة', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('عرض فعّال محفوظ')).toBeVisible();

  for (const width of [320, 360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `overview overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: 'test-results/screenshots/w5-overview-390.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/screenshots/w5-overview-1440.png', fullPage: true });

  await page.goto('/admin?period=30');
  await expect(page.getByTestId('overview-received')).toContainText('5');
  await expect(page.getByTestId('overview-backlog')).toContainText('3');
  await expect(page.getByTestId('overview-no-plan')).toContainText('2');
  await expect(page.getByText('سجل قديم: سياق العرض غير معروف')).toBeVisible();

  await page.goto('/admin?period=7');
  await page.getByRole('link', { name: 'فتح الطلب' }).first().click();
  await expect(page).toHaveURL(/\/admin\/requests\/e2e-request-alpha$/);
  await expect(page.locator('main#admin-content h1')).toContainText('E2E Alpha Trader');
});

test('owner-only settings, save/reload, public integration and independent groups', async ({
  page,
  context,
  browser,
}) => {
  const anonymous = await browser.newContext();
  try {
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto('/admin/settings');
    await expect(anonymousPage).toHaveURL(/\/admin\/login$/);
  } finally {
    await anonymous.close();
  }

  await page.goto('/admin/settings');
  await expect(page.locator('main#admin-content h1')).toHaveText('الإعدادات');
  await expect(page.locator('#settings-social-instagram')).toHaveAttribute(
    'placeholder',
    'https://instagram.com/nokmel.store',
  );
  await expect(page.locator('#settings-instagram-help')).toContainText(
    'https://instagram.com/nokmel.store',
  );
  await expect(page.getByText('لم تُضبط وجهة بعد')).toBeVisible();
  await expect(page.getByText('بيانات البوت مهيأة على الخادم.')).toBeVisible();
  await expect(page.getByText('مفاتيح التقارير مهيأة (قراءة فقط).')).toBeVisible();
  await expect(page.getByText('معرّف القياس غير مهيأ؛ لن تُحمَّل أدوات التتبع.')).toBeVisible();

  await page.fill('#settings-contact-email', 'hello-e2e@nokmel.test');
  await page.fill('#settings-contact-phone', '+201234567890');
  await page.fill('#settings-contact-telegram', 'https://t.me/nokmel_e2e');
  await page.getByTestId('settings-public-save').click();
  await expect(page.getByText('تم حفظ بيانات التواصل وأصبحت ظاهرة في الموقع.')).toBeVisible();
  await page.reload();
  await expect(page.locator('#settings-contact-email')).toHaveValue('hello-e2e@nokmel.test');
  await expect(page.locator('#settings-contact-phone')).toHaveValue('+201234567890');

  // Invalid provider URL is rejected with a field error.
  await page.fill('#settings-social-x', 'https://evil.example/nokmel');
  await page.getByTestId('settings-public-save').click();
  await expect(page.locator('#settings-social-x-error')).toContainText('النطاق الرسمي');
  await page.fill('#settings-social-x', 'https://x.com/nokmel_e2e');
  await page.getByTestId('settings-public-save').click();
  await expect(page.getByText('تم حفظ بيانات التواصل وأصبحت ظاهرة في الموقع.')).toBeVisible();

  // Public contact page and footer integrate the saved settings.
  await page.goto('/contact');
  await expect(page.getByTestId('contact-channels')).toContainText('hello-e2e@nokmel.test');
  await expect(page.getByTestId('contact-channels')).toContainText('+201234567890');
  await expect(page.getByTestId('contact-channels')).toContainText('تيليجرام');
  await expect(page.getByTestId('footer-contact')).toBeVisible();

  // Private analytics/notification values never appear publicly.
  await page.goto('/admin/settings');
  await page.fill('#settings-telegram-chat-id', '555000111222');
  await page.getByTestId('settings-notifications-enabled').uncheck();
  await page.getByTestId('settings-notifications-save').click();
  await expect(page.getByText('تم حفظ إعدادات الإشعارات.')).toBeVisible();
  await page.getByTestId('settings-analytics-enabled').check();
  await page.getByTestId('settings-analytics-save').click();
  await expect(page.getByText('تم حفظ تفضيل التحليلات.')).toBeVisible();
  await expect(page.getByText('555000111222')).toHaveCount(0);

  await page.goto('/');
  const publicHtml = await page.content();
  expect(publicHtml).not.toContain('555000111222');
  expect(publicHtml).not.toContain('تنبيهات المالك');
  expect(publicHtml).not.toContain('analyticsEnabled');

  // Stale public write from a second page is rejected without overwriting.
  const stale = await context.newPage();
  await stale.goto('/admin/settings');
  await page.goto('/admin/settings');
  await stale.fill('#settings-contact-email', 'newer@nokmel.test');
  await stale.getByTestId('settings-public-save').click();
  await expect(stale.getByText('تم حفظ بيانات التواصل وأصبحت ظاهرة في الموقع.')).toBeVisible();
  await page.fill('#settings-contact-phone', '+201000000123');
  await page.getByTestId('settings-public-save').click();
  await expect(page.getByText('عُدّلت هذه المجموعة من جلسة أو جهاز آخر')).toBeVisible();
  await stale.close();
  await page.reload();
  await expect(page.locator('#settings-contact-email')).toHaveValue('newer@nokmel.test');

  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: 'test-results/screenshots/w5-settings-390.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/screenshots/w5-settings-1440.png', fullPage: true });
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `settings overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('GA success, provider failure and business dashboard independence', async ({ page }) => {
  await page.goto('/admin?period=7');
  const analytics = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'تحليلات الموقع الخارجية (GA4)' }) });
  await expect(analytics.getByText('المستخدمون (totalUsers)')).toBeVisible();
  await expect(analytics.getByText('42', { exact: true })).toBeVisible();
  await expect(analytics.getByText('60', { exact: true })).toBeVisible();
  await expect(analytics.getByText('20', { exact: true }).first()).toBeVisible();
  await expect(
    analytics.getByText('معدل الجلسات التي سجلت حدث الانضمام (GA4 key event)'),
  ).toBeVisible();
  await expect(analytics.getByText('25.0%')).toBeVisible();
  await expect(analytics.getByText('نسبة الطلبات المقبولة إلى مستخدمي GA4')).toBeVisible();

  await gaControl('error');
  try {
    await page.goto('/admin?period=90');
    await expect(page.getByTestId('overview-analytics-unavailable')).toBeVisible();
    await expect(page.getByTestId('overview-received')).toBeVisible();
    await expect(page.getByTestId('overview-backlog')).toBeVisible();
  } finally {
    await gaControl('ok');
  }
});

test('unconfigured GA4 state on the provider-unconfigured runtime', async ({ page }) => {
  const base = 'http://127.0.0.1:3200';
  await page.goto(`${base}/admin`);
  await page.goto(`${base}/admin?period=7`);
  await expect(page.getByText('تقارير GA4 غير مهيأة على الخادم')).toBeVisible();
  await expect(page.getByTestId('overview-received')).toBeVisible();
});

test('settings page exposes no bot token and keeps owner account actions bounded', async ({ page }) => {
  await page.goto('/admin/settings');
  const html = await page.content();
  expect(html).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
  expect(html).not.toContain('TELEGRAM_BOT_TOKEN');
  await expect(page.getByText(OWNER_EMAIL)).toBeVisible();
  await expect(page.getByText('تغيير البريد أو كلمة المرور من هنا غير متاح في هذه المرحلة.')).toBeVisible();
});

void TELEGRAM_STUB;
