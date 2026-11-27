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

async function expectBalancedDevices(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await expectPublicVisual(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await settleVisualMotion(page);
  if (width >= 1024) await expectDesktopHeadline(page);
  await expect(page.getByTestId('tg-start')).toBeVisible();
  await expect(page.getByTestId('tg-welcome')).toBeVisible();
  await expect(page.getByTestId('tg-composer')).toBeVisible();
  await expect(page.getByTestId('merchant-status-summary')).toBeVisible();
  await expect(page.getByTestId('merchant-secondary-order')).toBeVisible();
  await expect(page.getByTestId('merchant-footer-hint')).toBeVisible();
  await expect(page.getByTestId('merchant-breakdown')).toBeVisible();

  const secondaryTotal = page.locator('[data-demo-field="secondary-order-total"]');
  const secondaryLabel = page.getByTestId('merchant-secondary-label');
  const secondaryMeta = page.getByTestId('merchant-secondary-meta');
  const secondaryTimeline = page.getByTestId('merchant-secondary-timeline');
  if (width <= 389) {
    await expect(secondaryTotal).toBeHidden();
    await expect(secondaryLabel).toBeHidden();
    await expect(secondaryMeta).toBeHidden();
    await expect(secondaryTimeline).toBeHidden();
  } else {
    await expect(secondaryTotal).toBeVisible();
    await expect(secondaryTotal).toContainText('250');
    await expect(secondaryLabel).toBeVisible();
    await expect(secondaryMeta).toBeVisible();
    await expect(secondaryTimeline).toBeVisible();
  }

  const metrics = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
        right: value.right,
        bottom: value.bottom,
      };
    };
    const customer = rect('[data-testid="device-frame-telegram"]');
    const merchant = rect('[data-testid="device-frame-merchant"]');
    const captionCustomer = rect('[data-testid="caption-customer"]');
    const captionMerchant = rect('[data-testid="caption-merchant"]');
    const connector = rect('[data-testid="flow-connector"]');
    const connectorPath = document
      .querySelector('[data-testid="flow-connector"] svg path')
      ?.getAttribute('d');
    const connectorDirection = document
      .querySelector('[data-testid="flow-connector"]')
      ?.getAttribute('data-direction');
    const composer = document.querySelector('[data-testid="tg-composer"]') as HTMLElement | null;
    const composerPlaceholder = composer?.textContent ?? '';
    const essentialSelectors = [
      '[data-testid="device-frame-telegram"] [data-demo-field="product-name"]',
      '[data-testid="device-frame-telegram"] [data-demo-field="unit-price"]',
      '[data-testid="device-frame-telegram"] [data-demo-field="total"]',
      '[data-testid="device-frame-telegram"] [data-demo-field="order-reference"]',
      '[data-testid="device-frame-merchant"] [data-demo-field="product-name"]',
      '[data-testid="device-frame-merchant"] [data-demo-field="order-state"]',
      '[data-testid="device-frame-merchant"] [data-demo-field="payment-method"]',
      '[data-testid="device-frame-merchant"] [data-demo-field="total"]',
      '[data-testid="device-frame-merchant"] [data-demo-field="order-reference"]',
    ];
    const essential = essentialSelectors.map((selector) => {
      const element = document.querySelector(selector) as HTMLElement | null;
      const frame = element?.closest('[data-testid^="device-frame-"]') as HTMLElement | null;
      if (!element || !frame) return null;
      const a = element.getBoundingClientRect();
      const b = frame.getBoundingClientRect();
      return {
        selector,
        inside:
          a.left >= b.left - 1 &&
          a.right <= b.right + 1 &&
          a.top >= b.top - 1 &&
          a.bottom <= b.bottom + 1,
      };
    });
    const visual = document.querySelector('[data-testid="product-visual"]') as HTMLElement;
    const interactiveCount = visual.querySelectorAll(
      'button, a, input, select, textarea, [tabindex], [role="button"], [contenteditable="true"]',
    ).length;
    return {
      customer,
      merchant,
      captionCustomer,
      captionMerchant,
      connector,
      connectorPath,
      connectorDirection,
      composerTag: composer?.tagName ?? null,
      composerIsEditable: composer?.matches(
        'input, textarea, [contenteditable="true"], [tabindex]',
      ) ?? null,
      composerPlaceholder,
      essential,
      interactiveCount,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(metrics.overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
  expect(metrics.customer).not.toBeNull();
  expect(metrics.merchant).not.toBeNull();
  const customer = metrics.customer!;
  const merchant = metrics.merchant!;
  expect(customer.width).toBeGreaterThan(100);
  expect(merchant.width).toBeGreaterThan(100);
  expect(customer.height).toBeGreaterThan(300);
  expect(merchant.height).toBeGreaterThan(300);
  expect(Math.abs(customer.width - merchant.width)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(customer.height - merchant.height)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(customer.y - merchant.y)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(customer.bottom - merchant.bottom)).toBeLessThanOrEqual(1.5);
  expect(customer.x).toBeGreaterThan(merchant.x);
  expect(metrics.captionCustomer).not.toBeNull();
  expect(metrics.captionMerchant).not.toBeNull();
  expect(
    Math.abs(metrics.captionCustomer!.y - metrics.captionMerchant!.y),
  ).toBeLessThanOrEqual(1.5);
  expect(metrics.connector).not.toBeNull();
  const connectorCenter = metrics.connector!.x + metrics.connector!.width / 2;
  expect(connectorCenter).toBeGreaterThan(merchant.right - 2);
  expect(connectorCenter).toBeLessThan(customer.x + 2);
  expect(metrics.connectorDirection).toBe('left');
  expect(metrics.connectorPath).toContain('H5');
  expect(metrics.composerTag).toBe('DIV');
  expect(metrics.composerIsEditable).toBe(false);
  expect(metrics.composerPlaceholder).toContain('رسالة...');
  expect(metrics.interactiveCount).toBe(0);
  for (const entry of metrics.essential) {
    expect(entry, 'essential selector').not.toBeNull();
    expect(entry!.inside, entry!.selector).toBe(true);
  }
  const captionAlignments = await page.getByTestId(/caption-(customer|merchant)/).evaluateAll(
    (elements) => elements.map((element) => getComputedStyle(element).textAlign),
  );
  expect(captionAlignments).toEqual(['center', 'center']);

  if (width <= 380) {
    const sizes = await page.evaluate(() => {
      const frame = document.querySelector(
        '[data-testid="device-frame-merchant"]',
      ) as HTMLElement;
      const read = (selector: string) => {
        const node = frame.querySelector(selector) as HTMLElement | null;
        return node ? parseFloat(getComputedStyle(node).fontSize) : null;
      };
      return {
        status: read('[data-demo-field="order-state"]'),
        name: read('[data-demo-field="product-name"]'),
        payment: read('[data-demo-field="payment-method"]'),
        total: read('[data-demo-field="total"]'),
      };
    });
    for (const value of [sizes.status, sizes.name, sizes.payment, sizes.total]) {
      expect(value).not.toBeNull();
      expect(value!).toBeGreaterThanOrEqual(10);
    }
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
    path: 'test-results/screenshots/w2v-balance-owner-control-390.png',
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await controlField.screenshot({
    path: 'test-results/screenshots/w2v-balance-owner-control-1440.png',
  });

  const anonymous = await browser.newContext();
  try {
    const visitor = await anonymous.newPage();
    await visitor.goto('/');
    await expectNoPublicVisual(visitor);
    await visitor.setViewportSize({ width: 390, height: 844 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w2v-balance-hidden-390.png',
      fullPage: true,
    });
    await visitor.setViewportSize({ width: 1440, height: 900 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w2v-balance-hidden-1440.png',
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

    const geometryWidths = [320, 360, 375, 380, 381, 390, 430, 768, 1024, 1440];
    const screenshotWidths = new Set([320, 360, 375, 380, 390, 430, 768, 1440]);
    for (const width of geometryWidths) {
      await expectBalancedDevices(visitor, width);
      if (width === 390) {
        await expectSharedDemoValues(visitor);
      }
      if (screenshotWidths.has(width)) {
        await visitor.getByTestId('product-hero-section').screenshot({
          path: `test-results/screenshots/w2v-balance-hero-${width}.png`,
        });
      }
      if (width === 390) {
        await visitor.screenshot({
          path: 'test-results/screenshots/w2v-balance-home-390-full.png',
          fullPage: true,
        });
        await visitor.getByTestId('product-visual').screenshot({
          path: 'test-results/screenshots/w2v-balance-visual-390.png',
        });
      }
      if (width === 768) {
        await visitor.screenshot({
          path: 'test-results/screenshots/w2v-balance-home-768-full.png',
          fullPage: true,
        });
      }
      if (width === 1440) {
        await visitor.screenshot({
          path: 'test-results/screenshots/w2v-balance-home-1440-full.png',
          fullPage: true,
        });
      }
    }

    await visitor.emulateMedia({ reducedMotion: 'reduce' });
    await visitor.reload();
    const reducedStageAnimation = await visitor
      .getByTestId('product-visual-stage')
      .evaluate((element) => getComputedStyle(element).animationName);
    const reducedCardAnimation = await visitor
      .getByTestId('merchant-order-card')
      .evaluate((element) => getComputedStyle(element).animationName);
    const reducedConnectorAnimation = await visitor
      .getByTestId('flow-connector')
      .evaluate((element) => getComputedStyle(element).animationName);
    expect(reducedStageAnimation).toBe('none');
    expect(reducedCardAnimation).toBe('none');
    expect(reducedConnectorAnimation).toBe('none');
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
