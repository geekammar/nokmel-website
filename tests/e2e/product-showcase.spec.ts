import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { defaultSectionPayload } from '../../src/content/cms/registry';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);

test.skip(!enabled, 'Showcase e2e requires the disposable CMS database fixture');

async function writePublishedShowcaseVisibility(visible: boolean): Promise<void> {
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    const payload = defaultSectionPayload('home', 'showcase');
    payload.visible = visible;
    const now = new Date();
    await pool.query(
      `insert into content_sections
        (id, page_key, section_key, locale, draft_payload, published_payload,
         draft_revision, published_revision, updated_at, published_at)
       values ('home:showcase:ar', 'home', 'showcase', 'ar', null, $1::jsonb, 0, 1, $2, $2)
       on conflict (page_key, section_key, locale) do update set
         draft_payload = null,
         published_payload = excluded.published_payload,
         draft_revision = 0,
         published_revision = 1,
         updated_at = excluded.updated_at,
         published_at = excluded.published_at`,
      [JSON.stringify(payload), now],
    );
  } finally {
    await pool.end();
  }
}

async function removeShowcaseOverride(): Promise<void> {
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    await pool.query(
      "delete from content_sections where page_key = 'home' and section_key = 'showcase' and locale = 'ar'",
    );
  } finally {
    await pool.end();
  }
}

test.beforeAll(async () => {
  if (!enabled) return;
  await writePublishedShowcaseVisibility(true);
});

test.afterAll(async () => {
  if (!enabled) return;
  await removeShowcaseOverride();
});

async function scrollToShowcase(page: import('@playwright/test').Page) {
  const showcase = page.locator('#product-showcase');
  await showcase.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -96));
  return showcase;
}

async function prepareFocusedScreenshot(
  page: import('@playwright/test').Page,
  showcase: import('@playwright/test').Locator,
) {
  await page.addStyleTag({
    content: 'header { position: static !important; } .skip-link { display: none !important; }',
  });
  await showcase.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -16));
}

async function trackShowcaseEvents(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const target = window as Window & { __nokmelShowcaseEvents?: unknown[] };
    target.__nokmelShowcaseEvents = [];
    window.addEventListener('nokmel:analytics', (event) => {
      target.__nokmelShowcaseEvents?.push((event as CustomEvent).detail);
    });
  });
}

async function readShowcaseEvents(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as Window & { __nokmelShowcaseEvents?: unknown[] }).__nokmelShowcaseEvents,
  );
}

test.describe('interactive product showcase', () => {
  test('direct actions advance the guided simulation with consistent totals', async ({
    page,
  }) => {
    const commerceRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/') && request.method() !== 'GET') {
        commerceRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await trackShowcaseEvents(page);
    const showcase = await scrollToShowcase(page);
    const customer = showcase.getByTestId('showcase-customer-panel');
    const merchant = showcase.getByTestId('showcase-merchant-panel');
    const title = showcase.getByTestId('showcase-step-title');

    await expect(customer).toBeVisible();
    await expect(merchant).toBeVisible();
    await expect(title).toContainText('تصفح المنتجات');
    const productAction = showcase.getByTestId('showcase-action-product');
    await expect(
      showcase.getByRole('button', {
        name: 'اختيار المنتج التجريبي: عبوة تغليف كرتونية',
      }),
    ).toBeVisible();
    expect(await productAction.evaluate((element) => element.tagName)).toBe('BUTTON');
    expect(
      await productAction.evaluate((element) => element.closest('[aria-hidden="true"]')),
    ).toBeNull();

    await productAction.click();
    await expect(title).toContainText('اختيار المنتج والكمية');
    await expect(showcase.getByText('الكمية المحددة: قطعتان')).toBeVisible();
    await showcase.getByTestId('showcase-action-quantity').click();

    await expect(title).toContainText('إضافة المنتج إلى السلة');
    await expect(customer.getByTestId('showcase-cart-line-total')).toHaveText('50.00 ر.س');
    await expect(customer.getByTestId('showcase-subtotal')).toHaveText('50.00 ر.س');
    await expect(customer.getByTestId('showcase-delivery-fee')).toHaveText('10.00 ر.س');
    await expect(customer.getByTestId('showcase-total')).toHaveText('60.00 ر.س');
    await expect(customer.getByText('عبوة تغليف كرتونية × 2')).toBeVisible();

    await showcase.getByTestId('showcase-action-checkout').click();
    await expect(title).toContainText('إتمام الطلب');
    await expect(customer.getByTestId('showcase-subtotal')).toHaveText('50.00 ر.س');
    await expect(customer.getByTestId('showcase-delivery-fee')).toHaveText('10.00 ر.س');
    await expect(customer.getByTestId('showcase-total')).toHaveText('60.00 ر.س');
    await expect(customer.getByText('عند الاستلام', { exact: true })).toBeVisible();
    await expect(showcase.getByTestId('showcase-action-confirm-cod')).toBeVisible();

    await showcase.getByTestId('showcase-action-confirm-cod').click();
    await expect(title).toContainText('تسجيل الطلب');
    await expect(customer.getByTestId('showcase-customer-order')).toHaveText('NW-1042');
    await expect(showcase.getByTestId('showcase-action-open-merchant')).toBeVisible();

    await showcase.getByTestId('showcase-action-open-merchant').click();
    await expect(title).toContainText('ظهور الطلب');
    await expect(merchant.getByTestId('showcase-merchant-order')).toHaveText('NW-1042');
    await expect(merchant.getByTestId('showcase-merchant-status')).toHaveText('تم الطلب');
    await expect(merchant.getByTestId('showcase-merchant-total')).toHaveText('60.00 ر.س');
    await expect(showcase.getByTestId('showcase-action-accept-order')).toBeVisible();

    await showcase.getByTestId('showcase-action-accept-order').click();
    await expect(title).toContainText('قبول الطلب');
    await expect(merchant.getByTestId('showcase-merchant-status')).toHaveText('مقبول');
    await expect(merchant.getByTestId('showcase-merchant-order')).toHaveText('NW-1042');
    await expect(customer.getByTestId('showcase-customer-order')).toHaveText('NW-1042');
    await expect(showcase.getByTestId('showcase-next-action-prepare')).toHaveText(
      'بدء التجهيز',
    );
    expect(
      await showcase
        .getByTestId('showcase-next-action-prepare')
        .evaluate((element) => element.tagName),
    ).toBe('P');
    await expect(showcase.getByTestId('showcase-next')).toBeDisabled();
    await expect(showcase.getByText('أضف قطعتين')).toHaveCount(0);
    await expect(page.locator('#product-showcase form')).toHaveCount(0);

    expect(commerceRequests).toEqual([]);
    expect(await readShowcaseEvents(page)).toEqual([]);

    await prepareFocusedScreenshot(page, showcase);
    await showcase.screenshot({
      path: 'test-results/screenshots/w2s-showcase-1440.png',
    });
  });

  test('manual direct action pauses autoplay', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const showcase = await scrollToShowcase(page);
    const autoplay = showcase.getByTestId('showcase-autoplay');
    const title = showcase.getByTestId('showcase-step-title');

    await autoplay.click();
    await expect(autoplay).toHaveText('إيقاف مؤقت');
    await showcase.getByTestId('showcase-action-product').click();
    await expect(autoplay).toHaveText('تشغيل تلقائي');
    await expect(title).toContainText('اختيار المنتج');
    await page.waitForTimeout(2400);
    await expect(title).toContainText('اختيار المنتج');
  });

  test('keyboard interaction activates direct actions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const showcase = await scrollToShowcase(page);
    const title = showcase.getByTestId('showcase-step-title');

    const productAction = showcase.getByTestId('showcase-action-product');
    await productAction.focus();
    await page.keyboard.press('Enter');
    await expect(title).toContainText('اختيار المنتج');

    const quantityAction = showcase.getByTestId('showcase-action-quantity');
    await quantityAction.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(quantityAction).toBeFocused();
    const outline = await quantityAction.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    );
    expect(outline).not.toBe('none');
    await page.keyboard.press('Space');
    await expect(title).toContainText('إضافة المنتج');
  });

  test('reduced motion disables autoplay and keeps direct actions available', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const showcase = await scrollToShowcase(page);

    const autoplay = showcase.getByTestId('showcase-autoplay');
    await expect(autoplay).toBeDisabled();
    await expect(showcase.getByTestId('showcase-reduced-note')).toContainText(
      'تقليل الحركة',
    );
    await expect(showcase.getByTestId('showcase-step-title')).toContainText(
      'تصفح المنتجات',
    );
    await showcase.getByTestId('showcase-action-product').click();
    await expect(showcase.getByTestId('showcase-step-title')).toContainText(
      'اختيار المنتج',
    );
  });

  test('supports autoplay, pause and replay', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const showcase = await scrollToShowcase(page);
    const title = showcase.getByTestId('showcase-step-title');
    const autoplay = showcase.getByTestId('showcase-autoplay');

    await autoplay.click();
    await expect(autoplay).toHaveText('إيقاف مؤقت');
    await expect(title).toContainText('تصفح المنتجات');
    await expect(title).toContainText('اختيار المنتج', { timeout: 5000 });
    await autoplay.click();
    await expect(autoplay).toHaveText('تشغيل تلقائي');
    const pausedTitle = await title.innerText();
    await page.waitForTimeout(2400);
    await expect(title).toHaveText(pausedTitle);

    await showcase.getByTestId('showcase-replay').click();
    await expect(title).toContainText('تصفح المنتجات');
    await expect(showcase.getByTestId('showcase-prev')).toBeDisabled();
  });

  test('mobile keeps one panel and captures initial, checkout and accepted states', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.screenshot({
      path: 'test-results/screenshots/w2s-home-390.png',
      fullPage: true,
    });

    const showcase = await scrollToShowcase(page);
    const customer = showcase.getByTestId('showcase-customer-panel');
    const merchant = showcase.getByTestId('showcase-merchant-panel');
    await expect(customer).toBeVisible();
    await expect(merchant).toBeHidden();
    const productActionBox = await showcase
      .getByTestId('showcase-action-product')
      .boundingBox();
    expect(productActionBox!.height).toBeGreaterThanOrEqual(44);
    const customerTabBox = await showcase
      .getByTestId('showcase-mobile-customer')
      .boundingBox();
    expect(customerTabBox!.height).toBeGreaterThanOrEqual(44);

    await showcase.getByTestId('showcase-mobile-merchant').click();
    await expect(customer).toBeHidden();
    await expect(merchant).toBeVisible();
    await expect(merchant).toContainText('لا طلبات جديدة بعد');
    await showcase.getByTestId('showcase-mobile-customer').click();
    await expect(customer).toBeVisible();

    mkdirSync('test-results/screenshots', { recursive: true });
    const measurements: Record<string, number | null> = {};
    await prepareFocusedScreenshot(page, showcase);
    measurements.initial = (await showcase.boundingBox())?.height
      ? Math.round((await showcase.boundingBox())!.height)
      : null;
    await showcase.screenshot({
      path: 'test-results/screenshots/w2s-showcase-390-initial.png',
    });

    await showcase.getByTestId('showcase-action-product').click();
    await showcase.getByTestId('showcase-action-quantity').click();
    await showcase.getByTestId('showcase-action-checkout').click();
    await expect(showcase.getByTestId('showcase-step-title')).toContainText(
      'إتمام الطلب',
    );
    await expect(customer.getByTestId('showcase-subtotal')).toHaveText('50.00 ر.س');
    await expect(customer.getByTestId('showcase-delivery-fee')).toHaveText('10.00 ر.س');
    await expect(customer.getByTestId('showcase-total')).toHaveText('60.00 ر.س');
    await prepareFocusedScreenshot(page, showcase);
    measurements.checkout = (await showcase.boundingBox())?.height
      ? Math.round((await showcase.boundingBox())!.height)
      : null;
    await showcase.screenshot({
      path: 'test-results/screenshots/w2s-showcase-390-checkout.png',
    });

    await showcase.getByTestId('showcase-action-confirm-cod').click();
    await showcase.getByTestId('showcase-action-open-merchant').click();
    await showcase.getByTestId('showcase-action-accept-order').click();
    await expect(customer).toBeHidden();
    await expect(merchant).toBeVisible();
    await expect(showcase.getByTestId('showcase-step-title')).toContainText(
      'قبول الطلب',
    );
    await expect(merchant.getByTestId('showcase-merchant-status')).toHaveText('مقبول');
    await prepareFocusedScreenshot(page, showcase);
    measurements.accepted = (await showcase.boundingBox())?.height
      ? Math.round((await showcase.boundingBox())!.height)
      : null;
    await showcase.screenshot({
      path: 'test-results/screenshots/w2s-showcase-390-merchant.png',
    });

    for (const width of [320, 360, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `showcase overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
    writeFileSync(
      'test-results/screenshots/w2s-showcase-390-measurements.json',
      JSON.stringify(measurements, null, 2),
    );
  });

  test('captures the desktop homepage and showcase evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.screenshot({
      path: 'test-results/screenshots/w2s-home-1440.png',
      fullPage: true,
    });
    const showcase = await scrollToShowcase(page);
    await prepareFocusedScreenshot(page, showcase);
    await showcase.screenshot({
      path: 'test-results/screenshots/w2s-showcase-1440-initial.png',
    });
  });
});
