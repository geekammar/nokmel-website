import { expect, test, type Page } from '@playwright/test';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? '';
const joinIntakeEnabled = ['1', 'true'].includes(
  (process.env.JOIN_INTAKE_ENABLED ?? '1').trim().toLowerCase(),
);
const PLAN_SLUG = 'w4-acceptance-plan';
const PLAN_NAME = 'باقة اختبار الانضمام';
const UPDATED_PLAN_NAME = 'باقة اختبار محدثة';

test.skip(!enabled, 'Admin e2e environment is not configured');
test.skip(!joinIntakeEnabled, 'Join intake is not enabled for this e2e fixture');
test.describe.configure({ mode: 'serial' });

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('#admin-email', OWNER_EMAIL);
  await page.fill('#admin-password', OWNER_PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/admin$/);
}

async function withPool<T>(operation: (pool: import('pg').Pool) => Promise<T>): Promise<T> {
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    return await operation(pool);
  } finally {
    await pool.end();
  }
}

async function resetJoinData(): Promise<void> {
  await withPool(async (pool) => {
    await pool.query('truncate table join_requests, plans, join_intake_rate_limits');
    await pool.query(
      `insert into plans (
         id, slug, draft_name, draft_description, draft_features,
         draft_monthly_price_minor, draft_yearly_price_minor, draft_currency,
         draft_cta_label, draft_featured, draft_display_order,
         published_name, published_description, published_features,
         published_monthly_price_minor, published_yearly_price_minor, published_currency,
         published_cta_label, published_featured, published_display_order,
         status, draft_revision, published_revision, published_at
       ) values (
         'w4-acceptance-plan-id', $1, $2, 'باقة تعريفية لاختبار قبول W4.', '["متابعة الطلبات","كتالوج المنتجات"]'::jsonb,
         14900, 149000, 'EGP', 'اطلب الانضمام', false, 1,
         $2, 'باقة تعريفية لاختبار قبول W4.', '["متابعة الطلبات","كتالوج المنتجات"]'::jsonb,
         14900, 149000, 'EGP', 'اطلب الانضمام', false, 1,
         'published', 2, 2, now()
       )`,
      [PLAN_SLUG, PLAN_NAME],
    );
  });
}

async function rowCountByToken(token: string): Promise<number> {
  return withPool(async (pool) => {
    const result = await pool.query(
      'select count(*)::int as count from join_requests where submission_token = $1',
      [token],
    );
    return result.rows[0].count as number;
  });
}

async function latestRequestByPhone(phone: string) {
  return withPool(async (pool) => {
    const result = await pool.query(
      'select name, phone, status, notes, plan_name_snapshot, plan_price_minor_snapshot, plan_price_period_snapshot, source from join_requests where phone = $1 order by created_at desc limit 1',
      [phone],
    );
    return result.rows[0];
  });
}

test.beforeAll(async () => {
  await resetJoinData();
});

test.afterAll(async () => {
  await resetJoinData().catch(() => undefined);
});

test('public acquisition workflow persists real requests and preserves offer context', async ({
  browser,
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 390, height: 900 });

  await page.goto('/join');
  await expect(page.getByTestId('join-intake-notice')).toContainText('مفعّل');
  await page.getByTestId('join-submit').click();
  await expect(page.getByText('تحقق من الحقول المميزة ثم أعد المحاولة.')).toBeVisible();
  await expect(page.locator('#join-name-error')).toContainText('أدخل الاسم الكامل.');
  await expect(page.locator('#join-phone-error')).toContainText('رقم الهاتف مطلوب.');

  await page.fill('#join-name', 'تاجر مباشر');
  await page.fill('#join-phone', '01012345678');
  await page.selectOption('#join-country', '+20');
  await page.fill('#join-activity', 'متجر ملابس');
  await page.getByTestId('join-submit').click();
  await expect(page.getByTestId('join-success')).toBeVisible();
  await expect(page.getByTestId('join-success')).toContainText('تم استلام طلبك');
  await page.screenshot({
    path: 'test-results/screenshots/w4-join-success-390.png',
    fullPage: true,
  });
  const direct = await latestRequestByPhone('+201012345678');
  expect(direct.status).toBe('new');
  expect(direct.notes).toBeNull();
  expect(direct.plan_name_snapshot).toBeNull();
  expect(direct.source).toBe('direct');

  const visitor = await browser.newContext();
  try {
    const publicPage = await visitor.newPage();
    await publicPage.goto('/pricing');
    const planCard = publicPage.getByTestId(`plan-card-${PLAN_SLUG}`);
    await expect(planCard).toBeVisible();
    await expect(planCard).toContainText(PLAN_NAME);
    await expect(planCard).toContainText('149.00 EGP');
    await expect(planCard).toContainText('1,490.00 EGP');
    await planCard.getByRole('link', { name: 'اطلب الانضمام' }).click();
    await publicPage.waitForURL(new RegExp(`/join\\?plan=${PLAN_SLUG}&source=pricing$`));
    await expect(publicPage.getByTestId('selected-plan-context')).toContainText(PLAN_NAME);
    await expect(publicPage.locator('#join-plan')).toHaveValue(PLAN_SLUG);
    await publicPage.screenshot({
      path: 'test-results/screenshots/w4-join-selected-plan-390.png',
      fullPage: true,
    });
    await publicPage.setViewportSize({ width: 1440, height: 900 });
    await publicPage.screenshot({
      path: 'test-results/screenshots/w4-join-selected-plan-1440.png',
      fullPage: true,
    });
    await publicPage.setViewportSize({ width: 390, height: 900 });

    await publicPage.fill('#join-name', 'تاجر خطة');
    await publicPage.fill('#join-phone', '+966501234567');
    await publicPage.getByTestId('join-submit').click();
    await expect(publicPage.getByTestId('join-success')).toBeVisible();
    const planned = await latestRequestByPhone('+966501234567');
    expect(planned.plan_name_snapshot).toBe(PLAN_NAME);
    expect(planned.plan_price_minor_snapshot).toBe(14_900);
    expect(planned.plan_price_period_snapshot).toBe('monthly');
    expect(planned.source).toBe('pricing');

    const duplicateToken = `w4-duplicate-${Date.now()}-token`;
    const duplicatePayload = {
      name: 'تاجر مكرر',
      phone: '+201011111111',
      source: 'direct',
      submissionToken: duplicateToken,
    };
    const headers = {
      origin: 'http://127.0.0.1:3100',
      'content-type': 'application/json',
    };
    const firstDuplicate = await visitor.request.post('http://127.0.0.1:3100/api/join', {
      headers,
      data: duplicatePayload,
    });
    const secondDuplicate = await visitor.request.post('http://127.0.0.1:3100/api/join', {
      headers,
      data: { ...duplicatePayload, name: 'تاجر مكرر باسم آخر' },
    });
    expect(firstDuplicate.status()).toBe(200);
    expect(secondDuplicate.status()).toBe(200);
    expect(await rowCountByToken(duplicateToken)).toBe(1);
    const duplicateRow = await latestRequestByPhone('+201011111111');
    expect(duplicateRow.name).toBe('تاجر مكرر');

    const crossOrigin = await visitor.request.post('http://127.0.0.1:3100/api/join', {
      headers: { ...headers, origin: 'https://attacker.example' },
      data: {
        name: 'تاجر عبر أصل غير موثوق',
        phone: '+201022222222',
        source: 'direct',
        submissionToken: `w4-cross-origin-${Date.now()}`,
      },
    });
    expect(crossOrigin.status()).toBe(403);

    await publicPage.goto(`/join?plan=${PLAN_SLUG}&source=pricing`);
    await expect(publicPage.getByTestId('selected-plan-context')).toContainText(PLAN_NAME);
    await withPool(async (pool) => {
      await pool.query(
        "update plans set published_name = $1, published_monthly_price_minor = 19900, published_revision = 3 where slug = $2",
        [UPDATED_PLAN_NAME, PLAN_SLUG],
      );
    });
    await publicPage.fill('#join-name', 'تاجر متغير');
    await publicPage.fill('#join-phone', '+201033333333');
    await publicPage.getByTestId('join-submit').click();
    await expect(publicPage.getByText('تغيّر العرض المختار بعد فتح النموذج')).toBeVisible();
    await publicPage.getByRole('button', { name: 'تأكيد العرض الحالي وإعادة الإرسال' }).click();
    await expect(publicPage.getByTestId('join-success')).toBeVisible();
    const changed = await latestRequestByPhone('+201033333333');
    expect(changed.plan_name_snapshot).toBe(UPDATED_PLAN_NAME);
    expect(changed.plan_price_minor_snapshot).toBe(19_900);

    await publicPage.goto(`/join?plan=${PLAN_SLUG}&source=pricing`);
    await expect(publicPage.getByTestId('selected-plan-context')).toBeVisible();
    await withPool(async (pool) => {
      await pool.query("update plans set status = 'hidden' where slug = $1", [PLAN_SLUG]);
    });
    await publicPage.fill('#join-name', 'تاجر بلا خطة');
    await publicPage.fill('#join-phone', '+201044444444');
    await publicPage.getByTestId('join-submit').click();
    await expect(publicPage.getByText('الخطة المختارة لم تعد متاحة للانضمام')).toBeVisible();
    await publicPage.getByRole('button', { name: 'المتابعة بدون خطة' }).click();
    await expect(publicPage.getByTestId('join-success')).toBeVisible();
    const withoutPlan = await latestRequestByPhone('+201044444444');
    expect(withoutPlan.plan_name_snapshot).toBeNull();

    const publicBody = await publicPage.content();
    expect(publicBody).not.toContain('تاجر خطة');
    expect(publicBody).not.toContain('+966501234567');
    expect(publicBody).not.toContain('ملاحظات');
  } finally {
    await visitor.close();
  }
});

test('owner request list, filters, detail, status and notes workflow persist', async ({
  browser,
  page,
}) => {
  test.slow();
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/admin/requests');
  await expect(page.getByTestId('request-list')).toBeVisible();
  await expect(page.getByTestId('request-counts')).toContainText('جديدة: 5');
  await page.screenshot({
    path: 'test-results/screenshots/w4-requests-list-390.png',
    fullPage: true,
  });

  await page.getByTestId('request-filter-new').click();
  await expect(page).toHaveURL(/status=new/);
  await page.getByLabel('البحث بالاسم أو الهاتف').fill('تاجر خطة');
  await page.getByRole('button', { name: 'بحث' }).click();
  await page.waitForURL(/q=/);
  await expect(page.locator('[data-testid^="request-item-"]')).toHaveCount(1);
  await expect(page.getByTestId('request-list')).toContainText('تاجر خطة');
  await page.getByRole('link', { name: /تاجر خطة/ }).click();
  await page.waitForURL(/\/admin\/requests\/.+/);
  const detailUrl = page.url();
  await expect(page.getByText(PLAN_NAME).first()).toBeVisible();
  await expect(page.getByText('149.00 EGP')).toBeVisible();
  await expect(page.getByText('لقطة محفوظة من العرض')).toBeVisible();

  await page.selectOption('#request-status', 'contacted');
  await page.getByTestId('request-save-status').click();
  await expect(page.getByTestId('request-banner')).toContainText('تم تحديث حالة الطلب.');
  await page.fill('#request-notes', 'تم التواصل هاتفياً وطلب متابعة لاحقة.');
  await page.getByTestId('request-save-notes').click();
  await expect(page.getByTestId('request-banner')).toContainText('تم حفظ الملاحظات الداخلية.');
  await page.reload();
  await expect(page.locator('#request-status')).toHaveValue('contacted');
  await expect(page.locator('#request-notes')).toHaveValue('تم التواصل هاتفياً وطلب متابعة لاحقة.');

  await page.selectOption('#request-status', 'closed');
  await page.getByTestId('request-save-status').click();
  await expect(page.getByTestId('request-banner')).toContainText('تم تحديث حالة الطلب.');
  await page.reload();
  await expect(page.locator('#request-status')).toHaveValue('closed');
  await page.selectOption('#request-status', 'new');
  await page.getByTestId('request-save-status').click();
  await expect(page.getByTestId('request-banner')).toContainText('تم تحديث حالة الطلب.');
  await page.reload();
  await expect(page.locator('#request-status')).toHaveValue('new');

  await page.screenshot({
    path: 'test-results/screenshots/w4-request-detail-390.png',
    fullPage: true,
  });
  for (const width of [320, 360, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `request detail overflow at ${width}px`).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('request-save-status')).toBeVisible();
    await expect(page.getByTestId('request-save-notes')).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: 'test-results/screenshots/w4-request-detail-1440.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/admin/requests?status=contacted');
  await expect(page.getByTestId('request-empty')).toBeVisible();

  const anonymous = await browser.newContext();
  try {
    const visitor = await anonymous.newPage();
    await visitor.goto('/admin/requests');
    await visitor.waitForURL(/\/admin\/login$/);
    await visitor.goto(detailUrl);
    await visitor.waitForURL(/\/admin\/login$/);
  } finally {
    await anonymous.close();
  }
});
