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

async function resetData(): Promise<void> {
  await withPool(async (pool) => {
    await pool.query('truncate table join_requests, plans, join_intake_rate_limits');
  });
}

function cairoDate(daysFromNow: number): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

async function fillBasePlan(
  page: Page,
  slug: string,
  name: string,
  monthly = '199.00',
  yearly = '1990.00',
): Promise<void> {
  await page.fill('#plan-field-slug', slug);
  await page.fill('#plan-field-name', name);
  await page.fill('#plan-field-description', 'باقة تعريفية لاختبار العروض المؤقتة.');
  await page.fill('#plan-field-monthlyPrice', monthly);
  await page.fill('#plan-field-yearlyPrice', yearly);
  await page.selectOption('#plan-field-currency', 'EGP');
  await page.fill('#plan-field-ctaLabel', 'اطلب الانضمام');
  await page.fill('#plan-field-displayOrder', '3');
  await page.getByRole('button', { name: 'إضافة ميزة' }).click();
  await page.fill('#plan-field-features-0', 'متابعة الطلبات من مكان واحد');
  await page.getByTestId('plan-promotion-add').click();
}

async function configurePromotion(
  page: Page,
  args: {
    label: string;
    discountType?: 'percentage' | 'fixed';
    target?: 'monthly' | 'yearly' | 'both';
    percentage?: string;
    fixedMonthly?: string;
    fixedYearly?: string;
    startsDate: string;
    startsTime: string;
    endsDate: string;
    endsTime: string;
  },
): Promise<void> {
  await page.fill('#plan-field-promotion-label', args.label);
  await page.selectOption(
    '#plan-field-promotion-discountType',
    args.discountType ?? 'percentage',
  );
  await page.selectOption('#plan-field-promotion-target', args.target ?? 'monthly');
  if ((args.discountType ?? 'percentage') === 'percentage') {
    await page.fill('#plan-field-promotion-percentage', args.percentage ?? '20');
  } else {
    await page.fill('#plan-field-promotion-fixedMonthly', args.fixedMonthly ?? '');
    await page.fill('#plan-field-promotion-fixedYearly', args.fixedYearly ?? '');
  }
  await page.fill('#plan-field-promotion-startsDate', args.startsDate);
  await page.fill('#plan-field-promotion-startsTime', args.startsTime);
  await page.fill('#plan-field-promotion-endsDate', args.endsDate);
  await page.fill('#plan-field-promotion-endsTime', args.endsTime);
}

async function seedPublishedPlan(args: {
  slug: string;
  name: string;
  promotion: Record<string, unknown> | null;
  monthlyPriceMinor?: number;
  yearlyPriceMinor?: number;
  publishedRevision?: number;
}): Promise<string> {
  const id = `qa-${args.slug}-id`;
  await withPool(async (pool) => {
    await pool.query(
      `insert into plans (
         id, slug, draft_name, draft_description, draft_features,
         draft_monthly_price_minor, draft_yearly_price_minor, draft_currency,
         draft_cta_label, draft_featured, draft_display_order, draft_promotion,
         published_name, published_description, published_features,
         published_monthly_price_minor, published_yearly_price_minor, published_currency,
         published_cta_label, published_featured, published_display_order, published_promotion,
         status, draft_revision, published_revision, published_at
       ) values (
         $1, $2, $3, 'باقة اختبار عروض W4.1.', '[]'::jsonb,
         $4, $5, 'EGP', 'اطلب الانضمام', false, 1, $6,
         $3, 'باقة اختبار عروض W4.1.', '[]'::jsonb,
         $4, $5, 'EGP', 'اطلب الانضمام', false, 1, $6,
         'published', $7, $7, now()
       )`,
      [
        id,
        args.slug,
        args.name,
        args.monthlyPriceMinor ?? 19_900,
        args.yearlyPriceMinor ?? 199_000,
        args.promotion,
        args.publishedRevision ?? 2,
      ],
    );
  });
  return id;
}

function activePromotion(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    label: 'عرض الانضمام المبكر',
    discountType: 'percentage',
    target: 'monthly',
    percentageBps: 2000,
    fixedMonthlyMinor: null,
    fixedYearlyMinor: null,
    startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

async function latestRequestByPhone(phone: string) {
  return withPool(async (pool) => {
    const result = await pool.query(
      `select id, name, plan_name_snapshot, plan_price_minor_snapshot,
              plan_price_period_snapshot, source, offer_snapshot
         from join_requests where phone = $1 order by created_at desc limit 1`,
      [phone],
    );
    return result.rows[0];
  });
}

test.beforeAll(async () => {
  await resetData();
});

test.afterAll(async () => {
  await resetData().catch(() => undefined);
});

test('owner configures, previews, publishes, and disables scheduled promotions', async ({
  page,
}) => {
  test.slow();
  await signIn(page);
  const futureSlug = `w41-future-${Date.now()}`;
  const futureName = 'باقة عرض مستقبلي';

  await page.goto('/admin/plans/new');
  await fillBasePlan(page, futureSlug, futureName);
  await configurePromotion(page, {
    label: 'عرض لاحق',
    percentage: '150',
    startsDate: cairoDate(5),
    startsTime: '09:00',
    endsDate: cairoDate(15),
    endsTime: '18:00',
  });
  await page.getByTestId('plan-save').click();
  await expect(page.locator('#plan-field-promotion-percentage-error')).toContainText(
    'لا تتجاوز 100',
  );

  await page.fill('#plan-field-promotion-percentage', '20');
  await page.getByTestId('plan-save').click();
  await expect(page.getByTestId('plan-banner')).toContainText(
    'تم إنشاء الباقة كمسودة غير منشورة.',
  );
  await page.waitForURL(new RegExp(`/admin/plans/.+\\?created=1$`));
  const editorUrl = page.url().replace('?created=1', '');
  const futurePlanId = editorUrl.split('/').pop() as string;
  await expect(page.getByTestId('plan-promotion-status')).toContainText(
    'مجدول ولم يبدأ',
  );
  await expect(page.getByTestId('plan-promotion-preview')).toContainText('159.20 EGP');
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `promotion editor overflow at ${width}px`).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('plan-promotion-section')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: 'test-results/screenshots/w41-plan-editor-promotion-390.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: 'test-results/screenshots/w41-plan-editor-promotion-1440.png',
    fullPage: true,
  });

  const preview = await page.context().newPage();
  await preview.goto(`/admin/plans/${futurePlanId}/preview`);
  await expect(preview.getByTestId('plan-preview-promotion-status')).toContainText(
    'مجدول ولم يبدأ',
  );
  await expect(preview.getByTestId('plan-preview-promotion-simulation')).toBeVisible();
  await expect(preview.getByTestId(`plan-card-${futureSlug}`).last()).toContainText(
    '159.20 EGP',
  );
  await preview.setViewportSize({ width: 390, height: 900 });
  await preview.screenshot({
    path: 'test-results/screenshots/w41-plan-preview-scheduled-390.png',
    fullPage: true,
  });
  await preview.setViewportSize({ width: 1440, height: 900 });
  await preview.screenshot({
    path: 'test-results/screenshots/w41-plan-preview-scheduled-1440.png',
    fullPage: true,
  });
  await preview.close();

  await page.getByTestId('plan-publish').click();
  await page.getByTestId('plan-confirm-publish').click();
  await expect(page.getByTestId('plan-banner')).toContainText(
    'تم نشر الباقة وأصبحت ظاهرة للزوار.',
  );

  const visitor = await page.context().browser()?.newContext();
  if (!visitor) throw new Error('browser context unavailable');
  try {
    const publicPage = await visitor.newPage();
    await publicPage.goto('/pricing');
    const card = publicPage.getByTestId(`plan-card-${futureSlug}`);
    await expect(card).toContainText(futureName);
    await expect(card).toContainText('199.00 EGP');
    await expect(publicPage.getByTestId(`plan-promotion-${futureSlug}`)).toHaveCount(0);

    const activeSlug = `w41-active-${Date.now()}`;
    const activeName = 'باقة عرض فعّال';
    await page.goto('/admin/plans/new');
    await fillBasePlan(page, activeSlug, activeName);
    await configurePromotion(page, {
      label: 'عرض الآن',
      percentage: '20',
      startsDate: cairoDate(-1),
      startsTime: '00:00',
      endsDate: cairoDate(30),
      endsTime: '23:59',
    });
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-banner')).toContainText(
      'تم إنشاء الباقة كمسودة غير منشورة.',
    );
    await page.waitForURL(new RegExp(`/admin/plans/.+\\?created=1$`));
    const activeEditorUrl = page.url().replace('?created=1', '');
    await page.getByTestId('plan-publish').click();
    await page.getByTestId('plan-confirm-publish').click();
    await expect(page.getByTestId('plan-banner')).toContainText(
      'تم نشر الباقة وأصبحت ظاهرة للزوار.',
    );

    await publicPage.goto('/pricing');
    const activeCard = publicPage.getByTestId(`plan-card-${activeSlug}`);
    await expect(activeCard).toBeVisible();
    await expect(publicPage.getByTestId(`plan-promotion-${activeSlug}`)).toContainText(
      'عرض الآن',
    );
    await expect(activeCard.locator('s')).toContainText('199.00 EGP');
    await expect(activeCard).toContainText('159.20 EGP');
    await expect(activeCard).toContainText('توفير');
    await expect(activeCard).toContainText('39.80 EGP');
    await expect(activeCard).toContainText('بتوقيت القاهرة');

    for (const width of [320, 360, 390, 430, 768, 1440]) {
      await publicPage.setViewportSize({ width, height: 900 });
      const overflow = await publicPage.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `pricing promotion overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
    await publicPage.setViewportSize({ width: 390, height: 900 });
    await publicPage.screenshot({
      path: 'test-results/screenshots/w41-public-promotion-390.png',
      fullPage: true,
    });
    await publicPage.setViewportSize({ width: 1440, height: 900 });
    await publicPage.screenshot({
      path: 'test-results/screenshots/w41-public-promotion-1440.png',
      fullPage: true,
    });

    await page.goto(activeEditorUrl);
    await page.getByTestId('plan-promotion-enabled').uncheck();
    // NKW-W41-001: a disabled promotion must show ordinary current prices and
    // must not render hypothetical strikethrough/discount values.
    await expect(page.getByTestId('plan-promotion-preview')).toHaveAttribute(
      'data-preview-kind',
      'current_disabled',
    );
    await expect(page.getByTestId('plan-promotion-preview').locator('s')).toHaveCount(0);
    await expect(page.getByTestId('plan-promotion-preview-note')).toContainText(
      'العرض معطّل',
    );
    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-banner')).toContainText(
      'تم حفظ المسودة. لم يتغيّر العرض العام بعد.',
    );
    await page.getByTestId('plan-publish').click();
    await page.getByTestId('plan-confirm-publish').click();
    await expect(page.getByTestId('plan-banner')).toContainText(
      'تم نشر الباقة وأصبحت ظاهرة للزوار.',
    );

    await publicPage.goto('/pricing');
    await expect(publicPage.getByTestId(`plan-promotion-${activeSlug}`)).toHaveCount(0);
    await expect(publicPage.getByTestId(`plan-card-${activeSlug}`)).toContainText(
      '199.00 EGP',
    );
  } finally {
    await visitor.close();
  }
});

test('public join presents the active offer and recovers correctly at both time boundaries', async ({
  browser,
  page,
}) => {
  test.slow();
  const slug = `w41-join-${Date.now()}`;
  const name = 'باقة الانضمام بالعرض';
  const planId = await seedPublishedPlan({
    slug,
    name,
    promotion: activePromotion(),
  });
  const yearlySlug = `w41-yearly-${Date.now()}`;
  await seedPublishedPlan({
    slug: yearlySlug,
    name: 'باقة خصم سنوي',
    promotion: activePromotion({
      discountType: 'fixed',
      target: 'yearly',
      percentageBps: null,
      fixedYearlyMinor: 20_000,
    }),
  });

  const visitorContext = await browser.newContext();
  try {
    const visitor = await visitorContext.newPage();
    await visitor.setViewportSize({ width: 390, height: 900 });
    await visitor.goto('/pricing');
    const yearlyCard = visitor.getByTestId(`plan-card-${yearlySlug}`);
    await expect(yearlyCard).toBeVisible();
    await expect(yearlyCard.locator('s')).toHaveCount(1);
    await expect(yearlyCard.locator('s')).toContainText('1,990.00 EGP');
    await expect(yearlyCard).toContainText('1,790.00 EGP');
    await expect(yearlyCard).toContainText('199.00 EGP');

    await visitor.goto(`/join?plan=${slug}&source=pricing`);
    await expect(visitor.getByTestId('selected-plan-context')).toContainText(name);
    await expect(visitor.getByTestId('selected-plan-offer')).toContainText(
      'عرض الانضمام المبكر',
    );
    await expect(visitor.getByTestId('selected-plan-offer').locator('s')).toContainText(
      '199.00 EGP',
    );
    await expect(visitor.getByTestId('selected-plan-offer')).toContainText('159.20 EGP');
    const option = visitor.locator(`#join-plan option[value="${slug}"]`);
    await expect(option).toContainText('بدلاً من');
    await expect(option).toContainText('159.20 EGP');
    for (const width of [320, 360, 390, 430, 768, 1440]) {
      await visitor.setViewportSize({ width, height: 900 });
      const overflow = await visitor.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `join offer overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(visitor.getByTestId('selected-plan-offer')).toBeVisible();
    }
    await visitor.setViewportSize({ width: 390, height: 900 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w41-join-selected-offer-390.png',
      fullPage: true,
    });
    await visitor.setViewportSize({ width: 1440, height: 900 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w41-join-selected-offer-1440.png',
      fullPage: true,
    });
    await visitor.setViewportSize({ width: 390, height: 900 });

    await visitor.fill('#join-name', 'تاجر عرض فعّال');
    await visitor.fill('#join-phone', '+201012340001');
    await visitor.getByTestId('join-submit').click();
    await expect(visitor.getByTestId('join-success')).toBeVisible();
    const saved = await latestRequestByPhone('+201012340001');
    expect(saved.plan_price_minor_snapshot).toBe(15_920);
    expect(saved.offer_snapshot.effectiveMonthlyPriceMinor).toBe(15_920);
    expect(saved.offer_snapshot.promotion.label).toBe('عرض الانضمام المبكر');
    expect(saved.offer_snapshot.promotion.monthlySavedMinor).toBe(3_980);

    await signIn(page);
    await page.goto(`/admin/requests/${saved.id}`);
    await expect(page.getByText('بيانات العرض التاريخية')).toBeVisible();
    await expect(page.getByText('السعر الشهري الأصلي وقت الإرسال')).toBeVisible();
    await expect(page.getByText('199.00 EGP')).toBeVisible();
    await expect(page.getByText('159.20 EGP')).toBeVisible();
    await expect(page.getByText('عرض الانضمام المبكر')).toBeVisible();
    await expect(page.getByText('39.80 EGP')).toBeVisible();

    const legacyId = `qa-w41-legacy-${Date.now()}`;
    await withPool(async (pool) => {
      await pool.query(
        `insert into join_requests (
           id, name, phone, plan_id, plan_name_snapshot, plan_price_minor_snapshot,
           plan_price_period_snapshot, plan_currency_snapshot, source, status,
           submission_token, revision
         ) values (
           $1, 'تاجر سجل قديم', '+201012340099', $2, 'باقة الانضمام بالعرض', 19900,
           'monthly', 'EGP', 'pricing', 'new', $3, 0
         )`,
        [legacyId, planId, `qa-w41-legacy-token-${Date.now()}`],
      );
    });
    await page.goto(`/admin/requests/${legacyId}`);
    await expect(
      page.getByText('لقطة W4 القديمة تحفظ سعراً معروضاً واحداً'),
    ).toBeVisible();
    await expect(page.getByText('السعر الشهري وقت الإرسال')).toBeVisible();
    await expect(page.getByText('199.00 EGP')).toBeVisible();

    // Expiration boundary: the open form still carries the discounted version.
    await visitor.goto(`/join?plan=${slug}&source=pricing`);
    await visitor.fill('#join-name', 'تاجر انتهى عرضه');
    await visitor.fill('#join-phone', '+201012340002');
    await withPool(async (pool) => {
      await pool.query(
        "update plans set published_promotion = jsonb_set(published_promotion, '{endsAt}', to_jsonb($1::text)) where id = $2",
        [new Date(Date.now() - 60 * 1000).toISOString(), planId],
      );
    });
    await visitor.getByTestId('join-submit').click();
    await expect(
      visitor.getByText('تغيّر العرض المختار بعد فتح النموذج'),
    ).toBeVisible();
    await expect(visitor.getByTestId('selected-plan-offer')).toHaveCount(0);
    await expect(visitor.getByTestId('selected-plan-context')).toContainText('199.00 EGP');
    await visitor.getByRole('button', { name: 'تأكيد العرض الحالي وإعادة الإرسال' }).click();
    await expect(visitor.getByTestId('join-success')).toBeVisible();
    const expired = await latestRequestByPhone('+201012340002');
    expect(expired.offer_snapshot.promotionState).toBe('expired');
    expect(expired.offer_snapshot.promotion).toBeNull();
    expect(expired.offer_snapshot.effectiveMonthlyPriceMinor).toBe(19_900);
    expect(expired.plan_price_minor_snapshot).toBe(19_900);
    await visitor.screenshot({
      path: 'test-results/screenshots/w41-join-expired-recovery-390.png',
      fullPage: true,
    });

    // Activation boundary: a regular open form becomes a discounted offer.
    const scheduledSlug = `w41-start-${Date.now()}`;
    const scheduledId = await seedPublishedPlan({
      slug: scheduledSlug,
      name: 'باقة تبدأ لاحقاً',
      promotion: activePromotion({
        startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    await visitor.goto(`/join?plan=${scheduledSlug}&source=pricing`);
    await expect(visitor.getByTestId('selected-plan-offer')).toHaveCount(0);
    await expect(visitor.getByTestId('selected-plan-context')).toContainText('199.00 EGP');
    await visitor.fill('#join-name', 'تاجر بدأ عرضه');
    await visitor.fill('#join-phone', '+201012340003');
    await withPool(async (pool) => {
      await pool.query(
        "update plans set published_promotion = jsonb_set(published_promotion, '{startsAt}', to_jsonb($1::text)) where id = $2",
        [new Date(Date.now() - 60 * 1000).toISOString(), scheduledId],
      );
    });
    await visitor.getByTestId('join-submit').click();
    await expect(
      visitor.getByText('تغيّر العرض المختار بعد فتح النموذج'),
    ).toBeVisible();
    await expect(visitor.getByTestId('selected-plan-offer')).toContainText('159.20 EGP');
    await expect(visitor.locator(`#join-plan option[value="${scheduledSlug}"]`)).toContainText(
      'بدلاً من',
    );
    await visitor.getByRole('button', { name: 'تأكيد العرض الحالي وإعادة الإرسال' }).click();
    await expect(visitor.getByTestId('join-success')).toBeVisible();
    const activated = await latestRequestByPhone('+201012340003');
    expect(activated.offer_snapshot.promotionState).toBe('active');
    expect(activated.offer_snapshot.effectiveMonthlyPriceMinor).toBe(15_920);
    expect(activated.plan_price_minor_snapshot).toBe(15_920);

    await visitor.setViewportSize({ width: 390, height: 900 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w41-join-activation-recovery-390.png',
      fullPage: true,
    });
  } finally {
    await visitorContext.close();
  }
});
