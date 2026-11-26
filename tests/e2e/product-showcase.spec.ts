import { expect, test } from '@playwright/test';

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

test.describe('interactive product showcase', () => {
  test('steps through verified customer and merchant states without commerce mutations', async ({
    page,
  }) => {
    const commerceRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/join') && request.method() === 'POST') {
        commerceRequests.push(request.url());
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const showcase = await scrollToShowcase(page);

    await expect(showcase.locator('[data-testid="showcase-customer-panel"]')).toBeVisible();
    await expect(showcase.locator('[data-testid="showcase-merchant-panel"]')).toBeVisible();
    await expect(showcase.getByTestId('showcase-step-title')).toContainText(
      'تصفح المنتجات',
    );

    const next = showcase.getByTestId('showcase-next');
    for (let step = 1; step < 5; step += 1) {
      await next.click();
    }
    await expect(showcase.getByTestId('showcase-step-title')).toContainText(
      'تسجيل الطلب',
    );
    await expect(
      showcase.locator('[data-testid="showcase-customer-order"]'),
    ).toHaveText('NW-1042');

    await next.click();
    await expect(showcase.getByTestId('showcase-step-title')).toContainText(
      'ظهور الطلب',
    );
    await expect(
      showcase.locator('[data-testid="showcase-merchant-order"]'),
    ).toHaveText('NW-1042');
    await expect(showcase.getByTestId('showcase-merchant-status')).toHaveText(
      'تم الطلب',
    );

    await next.click();
    await expect(showcase.getByTestId('showcase-step-title')).toContainText(
      'قبول الطلب',
    );
    await expect(showcase.getByTestId('showcase-merchant-status')).toHaveText('مقبول');
    await expect(
      showcase.locator('[data-testid="showcase-merchant-panel"]'),
    ).toContainText('بدء التجهيز');
    await expect(next).toBeDisabled();

    await prepareFocusedScreenshot(page, showcase);
    await showcase.screenshot({
      path: 'test-results/screenshots/w2s-showcase-1440.png',
    });
    expect(commerceRequests).toEqual([]);
  });

  test('uses one compact viewport on mobile and switches to the merchant side', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.screenshot({
      path: 'test-results/screenshots/w2s-home-390.png',
      fullPage: true,
    });

    const showcase = await scrollToShowcase(page);
    const customer = showcase.locator('[data-testid="showcase-customer-panel"]');
    const merchant = showcase.locator('[data-testid="showcase-merchant-panel"]');
    await expect(customer).toBeVisible();
    await expect(merchant).toBeHidden();

    await showcase.getByTestId('showcase-mobile-merchant').click();
    await expect(customer).toBeHidden();
    await expect(merchant).toBeVisible();
    await expect(merchant).toContainText('لا طلبات جديدة بعد');
    await showcase.getByTestId('showcase-mobile-customer').click();
    await expect(customer).toBeVisible();

    for (let step = 1; step < 6; step += 1) {
      await showcase.getByTestId('showcase-next').click();
    }
    await expect(customer).toBeHidden();
    await expect(merchant).toBeVisible();
    await expect(showcase.getByTestId('showcase-merchant-status')).toHaveText(
      'تم الطلب',
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await prepareFocusedScreenshot(page, showcase);
    await showcase.screenshot({
      path: 'test-results/screenshots/w2s-showcase-390.png',
    });
  });

  test('disables autoplay and keeps manual steps available with reduced motion', async ({
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
    await showcase.getByTestId('showcase-next').click();
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

  test('captures the desktop homepage and focused showcase', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.screenshot({
      path: 'test-results/screenshots/w2s-home-1440.png',
      fullPage: true,
    });
    const showcase = await scrollToShowcase(page);
    await prepareFocusedScreenshot(page, showcase);
    await showcase.screenshot({
      path: 'test-results/screenshots/w2s-showcase-initial-1440.png',
    });
  });
});
