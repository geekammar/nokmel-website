import { expect, test, type Page } from '@playwright/test';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? '';
const SAVE_SUCCESS = 'تم حفظ المسودة. لم يتغيّر المحتوى العام بعد.';
const PUBLISH_SUCCESS = 'تم نشر المحتوى وأصبحت النسخة الجديدة هي المعروضة للزوار.';
const DISCARD_SUCCESS = 'تم تجاهل المسودة غير المنشورة. النسخة المنشورة لم تتغيّر.';
const SHOWCASE_TITLE = 'الطلبات من المحادثة، والمتابعة من مكان واحد.';
const VISUAL_LABEL = 'إظهار العرض البصري للمنتج';
const VISUAL_SECTION = 'العرض البصري للمنتج';

test.skip(!enabled, 'Showcase visibility e2e requires the disposable CMS database fixture');

async function resetCmsData(): Promise<void> {
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    await pool.query('truncate table content_sections, faq_items');
  } finally {
    await pool.end();
  }
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('#admin-email', OWNER_EMAIL);
  await page.fill('#admin-password', OWNER_PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/admin$/);
}

async function expectNoPublicVisual(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="product-visual"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="merchant-order-card"]')).toHaveCount(0);
  await expect(page.locator('img[src*="hoodie"]')).toHaveCount(0);
  await expect(page.getByTestId('product-hero')).toHaveAttribute(
    'data-layout',
    'text-only',
  );
  await expect(
    page.getByRole('link', { name: 'استكشف المميزات' }),
  ).toHaveAttribute('href', '/features');
  await expect(page.locator('#how-it-works')).toBeVisible();
}

async function expectPublicVisual(page: Page): Promise<void> {
  await expect(page.getByTestId('product-hero')).toHaveAttribute(
    'data-layout',
    'two-column',
  );
  const visual = page.getByTestId('product-visual');
  await expect(visual).toBeVisible();
  await expect(page.getByTestId('merchant-order-card')).toBeVisible();
  await expect(visual).toContainText('هودي أساسي');
  await expect(visual).toContainText('NW-1042');
  await expect(visual).toContainText('الدفع عند الاستلام');
  await expect(visual).toContainText('جديد');
  await expect(visual).toContainText('قبول الطلب');
}

async function expectSharedDemoValues(page: Page): Promise<void> {
  const visual = page.getByTestId('product-visual');
  for (const field of [
    'product-name',
    'quantity',
    'order-reference',
    'payment-method',
    'total',
  ] as const) {
    const values = await visual.locator(`[data-demo-field="${field}"]`).allInnerTexts();
    expect(values, field).toHaveLength(2);
    expect(new Set(values).size, field).toBe(1);
  }
  const unitPrice = await visual
    .locator('[data-demo-field="unit-price"]')
    .innerText();
  const total = await visual.locator('[data-demo-field="total"]').first().innerText();
  expect(unitPrice).toBe(total);
  expect(unitPrice).toContain('650');
  expect(unitPrice).toContain('ج.م');
  expect(unitPrice).not.toContain('ر.س');
  expect(unitPrice).not.toContain('SAR');
  expect(await visual.locator('[data-demo-field="secondary-order-reference"]').innerText()).toBe(
    'NW-1041',
  );
  expect(await visual.locator('[data-demo-field="secondary-order-state"]').innerText()).toBe(
    'قيد التجهيز',
  );
  expect(await visual.locator('[data-demo-field="secondary-product-name"]').innerText()).toContain(
    'قبعة قطنية',
  );

  const interactive = visual.locator(
    'button, a, input, select, textarea, [tabindex], [role="button"]',
  );
  await expect(interactive).toHaveCount(0);
}

async function expectDesktopHeadline(page: Page): Promise<void> {
  const heading = page.locator('h1').first();
  const box = await heading.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(380);
  const metrics = await heading.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontSize: parseFloat(style.fontSize),
      lineHeight: parseFloat(style.lineHeight),
      maxWidth: style.maxWidth,
    };
  });
  expect(metrics.fontSize).toBeGreaterThanOrEqual(40);
  expect(metrics.fontSize).toBeLessThanOrEqual(48.5);
  expect(metrics.maxWidth).toBe('none');
  const lines = box!.height / metrics.lineHeight;
  expect(lines).toBeGreaterThanOrEqual(1.8);
  expect(lines).toBeLessThanOrEqual(3.4);
  for (const label of ['للعميل', 'للتاجر']) {
    const caption = page
      .getByTestId(label === 'للعميل' ? 'caption-customer' : 'caption-merchant');
    expect(await caption.evaluate((element) => getComputedStyle(element).textAlign)).toBe(
      'center',
    );
  }
}

async function expectResponsiveVisual(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await expectPublicVisual(page);
  if (width >= 1024) await expectDesktopHeadline(page);
  if (width >= 390) {
    const screens = await page.getByTestId('device-screen').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }),
    );
    expect(screens).toHaveLength(2);
    expect(Math.abs(screens[0].top - screens[1].top)).toBeLessThanOrEqual(1);
    expect(Math.abs(screens[0].height - screens[1].height)).toBeLessThanOrEqual(24);
  }
  const summary = page.getByTestId('merchant-status-summary');
  const secondary = page.getByTestId('merchant-secondary-order');
  const footer = page.getByTestId('merchant-footer-hint');
  const secondaryTotal = page.locator('[data-demo-field="secondary-order-total"]');
  if (width <= 360) {
    await expect(summary).toBeHidden();
    await expect(secondary).toBeHidden();
    await expect(footer).toBeHidden();
    const metrics = await page.getByTestId('merchant-order-card').evaluate((element) => {
      const read = (selector: string) => {
        const node = element.querySelector(selector) as HTMLElement | null;
        if (!node) return null;
        const style = getComputedStyle(node);
        return {
          fontSize: parseFloat(style.fontSize),
          top: node.getBoundingClientRect().top,
          bottom: node.getBoundingClientRect().bottom,
        };
      };
      return {
        status: read('[data-demo-field="order-state"]'),
        name: read('[data-demo-field="product-name"]'),
        payment: read('[data-demo-field="payment-method"]'),
        total: read('[data-demo-field="total"]'),
      };
    });
    for (const value of [metrics.status, metrics.name, metrics.payment, metrics.total]) {
      expect(value).not.toBeNull();
      expect(value!.fontSize).toBeGreaterThanOrEqual(9.5);
    }
    expect(metrics.payment!.bottom).toBeLessThanOrEqual(metrics.total!.top + 1);
  } else if (width < 640) {
    await expect(summary).toBeVisible();
    await expect(secondary).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(secondaryTotal).toBeHidden();
  } else {
    await expect(summary).toBeVisible();
    await expect(secondary).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(secondaryTotal).toBeVisible();
    await expect(secondaryTotal).toContainText('250');
  }
}

async function settleVisualMotion(page: Page): Promise<void> {
  await page.getByTestId('product-visual').evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

async function expectNoHorizontalOverflow(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
}

test.beforeAll(async () => {
  if (!enabled) return;
  await resetCmsData();
});

test.afterAll(async () => {
  if (!enabled) return;
  await resetCmsData();
});

test('owner controls the static product visual with draft isolation and publication', async ({
  browser,
  page,
}) => {
  test.slow();
  await signIn(page);
  await page.goto('/admin/content/home');
  await expect(page.getByTestId('content-editor')).toBeVisible();

  const control = page.locator('[data-field="showcase.visible"]');
  const controlField = page.getByTestId('cms-field-showcase-visible-field');
  await expect(control).not.toBeChecked();
  await expect(controlField).toContainText(VISUAL_LABEL);
  await expect(controlField).toContainText('بيانات توضيحية');
  await expect(controlField).toContainText('لا يظهر أي عمود فارغ');
  await controlField.scrollIntoViewIfNeeded();
  await page.setViewportSize({ width: 390, height: 900 });
  await controlField.screenshot({
    path: 'test-results/screenshots/w2v-polish-owner-control-390.png',
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await controlField.screenshot({
    path: 'test-results/screenshots/w2v-polish-owner-control-1440.png',
  });

  const anonymous = await browser.newContext();
  try {
    const visitor = await anonymous.newPage();
    await visitor.goto('/');
    await expectNoPublicVisual(visitor);
    await visitor.setViewportSize({ width: 390, height: 844 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w2v-polish-hidden-390.png',
      fullPage: true,
    });
    await visitor.setViewportSize({ width: 1440, height: 900 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w2v-polish-hidden-1440.png',
      fullPage: true,
    });

    await control.check();
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
    await visitor.goto('/');
    await expectNoPublicVisual(visitor);

    const preview = await page.context().newPage();
    await preview.goto('/admin/content/home/preview');
    await expect(preview.getByTestId('preview-banner')).toBeVisible();
    await expectPublicVisual(preview);
    await preview.close();

    await page.getByTestId('publish-content').click();
    await expect(page.getByTestId('publication-review')).toBeVisible();
    await expect(page.getByTestId('review-section-summary')).toContainText(
      VISUAL_SECTION,
    );
    await expect(page.getByTestId('publication-review')).toContainText(VISUAL_LABEL);
    await expect(page.getByTestId('publication-review')).toContainText('مخفي');
    await expect(page.getByTestId('publication-review')).toContainText('ظاهر');
    await expect(page.getByTestId('publication-review')).toContainText(
      'لا يعرض العرض تحكماً تفاعلياً أو بيانات إنتاجية',
    );
    await page.getByTestId('review-confirm-publish').click();
    await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();

    await visitor.setViewportSize({ width: 390, height: 844 });
    await visitor.goto('/');
    await expectPublicVisual(visitor);
    await expectSharedDemoValues(visitor);
    await settleVisualMotion(visitor);
    await visitor.screenshot({
      path: 'test-results/screenshots/w2v-polish-home-390-full.png',
      fullPage: true,
    });
    await visitor.getByTestId('product-visual').screenshot({
      path: 'test-results/screenshots/w2v-polish-visual-390.png',
    });

    for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
      await expectNoHorizontalOverflow(visitor, width);
      await expect(visitor.getByTestId('product-visual')).toBeVisible();
      await expectResponsiveVisual(visitor, width);
    }

    for (const width of [320, 360, 430, 768]) {
      await visitor.setViewportSize({ width, height: width === 768 ? 1024 : 900 });
      await visitor.goto('/');
      await expectPublicVisual(visitor);
      await settleVisualMotion(visitor);
      await visitor.getByTestId('product-hero-section').screenshot({
        path: `test-results/screenshots/w2v-polish-hero-${width}.png`,
      });
    }

    await visitor.setViewportSize({ width: 768, height: 1024 });
    await visitor.goto('/');
    await expectPublicVisual(visitor);
    await settleVisualMotion(visitor);
    await visitor.screenshot({
      path: 'test-results/screenshots/w2v-polish-home-768-full.png',
      fullPage: true,
    });

    await visitor.setViewportSize({ width: 1440, height: 900 });
    await visitor.goto('/');
    await expectPublicVisual(visitor);
    await settleVisualMotion(visitor);
    await expectDesktopHeadline(visitor);
    await visitor.getByTestId('product-hero-section').screenshot({
      path: 'test-results/screenshots/w2v-polish-hero-1440.png',
    });
    await visitor.screenshot({
      path: 'test-results/screenshots/w2v-polish-home-1440-full.png',
      fullPage: true,
    });

    await visitor.emulateMedia({ reducedMotion: 'reduce' });
    await visitor.reload();
    const reducedStageAnimation = await visitor
      .getByTestId('product-visual-stage')
      .evaluate((element) => getComputedStyle(element).animationName);
    const reducedCardAnimation = await visitor
      .getByTestId('merchant-order-card')
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(reducedStageAnimation).toBe('none');
    expect(reducedCardAnimation).toBe('none');
    await visitor.emulateMedia({ reducedMotion: 'no-preference' });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.reload();
    await page.locator('[data-field="showcase.visible"]').uncheck();
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
    await visitor.goto('/');
    await expectPublicVisual(visitor);

    const hiddenPreview = await page.context().newPage();
    await hiddenPreview.goto('/admin/content/home/preview');
    await expect(hiddenPreview.getByTestId('preview-banner')).toBeVisible();
    await expectNoPublicVisual(hiddenPreview);
    await hiddenPreview.close();

    await page.getByTestId('publish-content').click();
    await expect(page.getByTestId('publication-review')).toBeVisible();
    await expect(page.getByTestId('publication-review')).toContainText('ظاهر');
    await expect(page.getByTestId('publication-review')).toContainText('مخفي');
    await page.getByTestId('review-confirm-publish').click();
    await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();
    await visitor.goto('/');
    await expectNoPublicVisual(visitor);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await page.locator('[data-field="showcase.visible"]').check();
    await expect(page.locator('[data-field="showcase.title"]')).toHaveValue(SHOWCASE_TITLE);
    await expect(
      page.locator('[data-field="showcase.body"]'),
    ).not.toHaveValue('');
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
    const restoredPreview = await page.context().newPage();
    await restoredPreview.setViewportSize({ width: 1440, height: 900 });
    await restoredPreview.goto('/admin/content/home/preview');
    await expect(restoredPreview.getByTestId('preview-banner')).toBeVisible();
    await expectPublicVisual(restoredPreview);
    await restoredPreview.close();

    await page.getByTestId('discard-draft').click();
    await expect(page.getByTestId('confirm-discard')).toBeVisible();
    await page.getByTestId('confirm-discard').click();
    await expect(page.getByText(DISCARD_SUCCESS)).toBeVisible();
    await visitor.goto('/');
    await expectNoPublicVisual(visitor);
  } finally {
    await anonymous.close();
  }
});
