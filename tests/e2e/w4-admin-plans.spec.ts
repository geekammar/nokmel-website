import { expect, test, type Page } from '@playwright/test';
import { hashPassword } from 'better-auth/crypto';
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
const SAVE_SUCCESS = 'تم حفظ المسودة. لم يتغيّر العرض العام بعد.';
const PUBLISH_SUCCESS = 'تم نشر الباقة وأصبحت ظاهرة للزوار.';
const HIDE_SUCCESS = 'تم إخفاء الباقة عن الزوار.';

test.skip(!enabled, 'Admin e2e environment is not configured');
test.skip(!joinIntakeEnabled, 'Join intake is not enabled for this e2e fixture');

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

async function resetPlanData(): Promise<void> {
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    await pool.query('truncate table join_requests, plans, join_intake_rate_limits');
  } finally {
    await pool.end();
  }
}

test.beforeAll(async () => {
  await resetPlanData();
});

test.afterAll(async () => {
  await resetPlanData();
});

test.describe('owner marketing-plan workflow', () => {
  test('create, preview, publish, edit, verify public offer, hide, and verify absence', async ({
    browser,
    page,
  }) => {
    test.slow();
    const slug = `starter-plan-${Date.now()}`;
    const planName = 'باقة البداية';
    const updatedName = 'باقة البداية المحدثة';

    await signIn(page);
    await page.goto('/admin/plans');
    await expect(page.getByTestId('plan-empty')).toBeVisible();
    await page.getByTestId('plan-create').click();
    await page.waitForURL(/\/admin\/plans\/new$/);

    await page.fill('#plan-field-slug', slug);
    await page.fill('#plan-field-name', planName);
    await page.fill(
      '#plan-field-description',
      'باقة تعريفية لمرحلة الانضمام المبكر مع متابعة الطلبات.',
    );
    await page.fill('#plan-field-monthlyPrice', '199.00');
    await page.fill('#plan-field-yearlyPrice', '1990.00');
    await page.selectOption('#plan-field-currency', 'EGP');
    await page.fill('#plan-field-ctaLabel', 'اطلب الانضمام');
    await page.fill('#plan-field-displayOrder', '5');
    await page.getByLabel('إبراز الباقة كخيار مميز').check();
    await page.getByRole('button', { name: 'إضافة ميزة' }).click();
    await page.getByRole('button', { name: 'إضافة ميزة' }).click();
    await page.fill('#plan-field-features-0', 'متابعة الطلبات من مكان واحد');
    await page.fill('#plan-field-features-1', 'كتالوج منتجات منظم');

    for (const width of [320, 360, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `plan editor overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('plan-save')).toBeVisible();
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w4-plan-editor-draft-390.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w4-plan-editor-draft-1440.png',
      fullPage: true,
    });

    await page.getByTestId('plan-save').click();
    await expect(page.getByTestId('plan-banner')).toContainText('تم إنشاء الباقة كمسودة غير منشورة.');
    await page.waitForURL(new RegExp(`/admin/plans/.+\\?created=1$`));
    const editorUrl = page.url().replace('?created=1', '');
    const planId = editorUrl.split('/').pop() as string;
    await expect(page.getByTestId('plan-status')).toContainText('مسودة غير منشورة');
    await expect(page.getByTestId('plan-revision')).toContainText('إصدار التحرير: 1');

    const preview = await page.context().newPage();
    await preview.goto(`/admin/plans/${planId}/preview`);
    await expect(preview.getByTestId('plan-preview-banner')).toBeVisible();
    const previewCard = preview.getByTestId(`plan-card-${slug}`);
    await expect(previewCard).toContainText(planName);
    await expect(previewCard).toContainText('199.00 EGP');
    await expect(previewCard).toContainText('متابعة الطلبات من مكان واحد');
    await expect(previewCard.getByRole('button')).toBeDisabled();
    await preview.setViewportSize({ width: 390, height: 900 });
    await preview.screenshot({
      path: 'test-results/screenshots/w4-plan-preview-390.png',
      fullPage: true,
    });
    await preview.close();

    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await visitor.goto('/pricing');
      await expect(visitor.getByTestId('published-plans')).toHaveCount(0);
      await expect(visitor.getByText(planName)).toHaveCount(0);

      await page.getByTestId('plan-publish').click();
      await expect(page.getByTestId('plan-publish-confirm')).toBeVisible();
      await page.getByTestId('plan-confirm-publish').click();
      await expect(page.getByTestId('plan-banner')).toContainText(PUBLISH_SUCCESS);
      await expect(page.getByTestId('plan-status')).toContainText('منشورة للزوار');

      await visitor.goto('/pricing');
      await expect(visitor.getByTestId('published-plans')).toBeVisible();
      const publicCard = visitor.getByTestId(`plan-card-${slug}`);
      await expect(publicCard).toBeVisible();
      await expect(publicCard).toContainText(planName);
      await expect(publicCard).toContainText('199.00 EGP');
      await expect(publicCard).toContainText('1,990.00 EGP');
      await expect(publicCard).toContainText('مميّزة');
      await expect(publicCard).toContainText('متابعة الطلبات من مكان واحد');
      await expect(visitor.getByText('لا توجد أي أسعار أو خطط في هذه المرحلة')).toHaveCount(0);
      const cta = publicCard.getByRole('link', { name: 'اطلب الانضمام' });
      await expect(cta).toHaveAttribute('href', `/join?plan=${slug}&source=pricing`);
      await visitor.setViewportSize({ width: 390, height: 900 });
      await visitor.screenshot({
        path: 'test-results/screenshots/w4-public-pricing-390.png',
        fullPage: true,
      });
      await visitor.setViewportSize({ width: 1440, height: 900 });
      await visitor.screenshot({
        path: 'test-results/screenshots/w4-public-pricing-1440.png',
        fullPage: true,
      });
      await visitor.setViewportSize({ width: 390, height: 900 });
      await cta.click();
      await visitor.waitForURL(new RegExp(`/join\\?plan=${slug}&source=pricing$`));
      await expect(visitor.getByTestId('selected-plan-context')).toContainText(planName);
      await expect(visitor.locator('#join-plan')).toHaveValue(slug);
      await expect(visitor.getByTestId('join-intake-notice')).toContainText('مفعّل');

      await page.goto(editorUrl);
      await page.fill('#plan-field-name', updatedName);
      await page.fill('#plan-field-monthlyPrice', '249.00');
      await page.fill('#plan-field-features-0', 'ميزة محدثة للعرض');
      await page.getByTestId('plan-save').click();
      await expect(page.getByTestId('plan-banner')).toContainText(SAVE_SUCCESS);
      await expect(page.getByTestId('plan-unpublished-changes')).toBeVisible();
      await visitor.goto('/pricing');
      await expect(visitor.getByTestId(`plan-card-${slug}`)).toContainText(planName);
      await expect(visitor.getByTestId(`plan-card-${slug}`)).toContainText('199.00 EGP');

      await page.getByTestId('plan-publish').click();
      await page.getByTestId('plan-confirm-publish').click();
      await expect(page.getByTestId('plan-banner')).toContainText(PUBLISH_SUCCESS);
      await visitor.goto('/pricing');
      await expect(visitor.getByTestId(`plan-card-${slug}`)).toContainText(updatedName);
      await expect(visitor.getByTestId(`plan-card-${slug}`)).toContainText('249.00 EGP');
      await expect(visitor.getByTestId(`plan-card-${slug}`)).toContainText('ميزة محدثة للعرض');

      await page.getByTestId('plan-hide').click();
      await expect(page.getByTestId('plan-hide-confirm')).toBeVisible();
      await page.getByTestId('plan-confirm-hide').click();
      await expect(page.getByTestId('plan-banner')).toContainText(HIDE_SUCCESS);
      await expect(page.getByTestId('plan-status')).toContainText('مخفية');

      await visitor.goto('/pricing');
      await expect(visitor.getByTestId('published-plans')).toHaveCount(0);
      await expect(visitor.getByText(updatedName)).toHaveCount(0);
      await visitor.goto(`/join?plan=${slug}&source=pricing`);
      await expect(visitor.getByTestId('selected-plan-context')).toHaveCount(0);
    } finally {
      await anonymous.close();
    }
  });
});

test.describe('plan authorization', () => {
  test('non-owner sessions cannot access plan or request administration', async ({ browser }) => {
    const email = `w4-non-owner-${Date.now()}@nokmel-e2e.test`;
    const password = 'non-owner-w4-e2e-password-123';
    const userId = `w4-non-owner-${Date.now()}`;
    const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
    try {
      assertDestructiveTestTargetIsStillSafe(target);
      await pool.query(
        'insert into "user" (id, name, email, email_verified) values ($1, $2, $3, true)',
        [userId, 'W4 Non Owner', email],
      );
      await pool.query(
        'insert into "account" (id, account_id, provider_id, user_id, password) values ($1, $2, $3, $4, $5)',
        [`${userId}-credential`, userId, 'credential', userId, await hashPassword(password)],
      );
    } finally {
      await pool.end();
    }

    try {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.goto('/admin/login');
        await page.fill('#admin-email', email);
        await page.fill('#admin-password', password);
        await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
        await page.waitForURL(/\/admin\/login$/);
        await page.goto('/admin/plans');
        await page.waitForURL(/\/admin\/login$/);
        await page.goto('/admin/requests');
        await page.waitForURL(/\/admin\/login$/);
      } finally {
        await context.close();
      }
    } finally {
      await withPool(async (pool) => {
        await pool.query('delete from "user" where id = $1', [userId]);
      });
    }
  });

  test('anonymous visitors cannot list, edit, preview or mutate plans', async ({ browser }) => {
    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await visitor.goto('/admin/plans');
      await visitor.waitForURL(/\/admin\/login$/);
      await visitor.goto('/admin/plans/new');
      await visitor.waitForURL(/\/admin\/login$/);
      await visitor.goto('/admin/plans/unknown-plan-id/preview');
      await visitor.waitForURL(/\/admin\/login$/);

      const response = await visitor.request.post('/api/join', {
        headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
        data: {
          name: 'تاجر غير مصرح',
          phone: '+201000000099',
          source: 'direct',
          submissionToken: 'cross-origin-plan-token-123456',
        },
      });
      expect(response.status()).toBe(403);
    } finally {
      await anonymous.close();
    }
  });
});
