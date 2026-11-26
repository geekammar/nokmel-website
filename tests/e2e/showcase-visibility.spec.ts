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

test.beforeAll(async () => {
  if (!enabled) return;
  await resetCmsData();
});

test.afterAll(async () => {
  if (!enabled) return;
  await resetCmsData();
});

test('owner controls homepage showcase visibility through draft, preview and publication', async ({
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
  await expect(controlField).toContainText('إظهار عرض تجربة المنتج');
  await expect(controlField).toContainText(
    'يمكنك إظهار عرض تجربة المنتج أو إخفاؤه من الصفحة الرئيسية دون حذف محتواه.',
  );
  await controlField.scrollIntoViewIfNeeded();
  await page.setViewportSize({ width: 390, height: 900 });
  await controlField.screenshot({
    path: 'test-results/screenshots/w2s-showcase-visibility-control-390.png',
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await controlField.screenshot({
    path: 'test-results/screenshots/w2s-showcase-visibility-control-1440.png',
  });

  const anonymous = await browser.newContext();
  try {
    const visitor = await anonymous.newPage();
    await visitor.goto('/');
    await expect(visitor.locator('#product-showcase')).toHaveCount(0);
    await expect(visitor.locator('[data-testid="product-showcase"]')).toHaveCount(0);
    await expect(visitor.locator('a[href="#product-showcase"]')).toHaveCount(0);
    await expect(visitor.locator('#how-it-works')).toBeVisible();

    await control.check();
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
    await visitor.goto('/');
    await expect(visitor.locator('#product-showcase')).toHaveCount(0);

    const preview = await page.context().newPage();
    await preview.goto('/admin/content/home/preview');
    await expect(preview.getByTestId('preview-banner')).toBeVisible();
    await expect(preview.locator('#product-showcase')).toBeVisible();
    await expect(preview.locator('#product-showcase')).toContainText(SHOWCASE_TITLE);
    await expect(preview.getByTestId('showcase-action-product')).toBeVisible();
    await preview.close();

    await page.getByTestId('publish-content').click();
    await expect(page.getByTestId('publication-review')).toBeVisible();
    await expect(page.getByTestId('review-section-summary')).toContainText(
      'العرض المفاهيمي',
    );
    await expect(page.getByTestId('publication-review')).toContainText(
      'إظهار عرض تجربة المنتج',
    );
    await expect(page.getByTestId('publication-review')).toContainText('مخفي');
    await expect(page.getByTestId('publication-review')).toContainText('ظاهر');
    await page.getByTestId('review-confirm-publish').click();
    await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();

    await visitor.setViewportSize({ width: 390, height: 844 });
    await visitor.goto('/');
    await expect(visitor.locator('#product-showcase')).toBeVisible();
    await expect(visitor.locator('#product-showcase')).toContainText(SHOWCASE_TITLE);
    await expect(visitor.getByTestId('showcase-action-product')).toBeVisible();
    await visitor.screenshot({
      path: 'test-results/screenshots/w2s-showcase-visibility-visible-390.png',
      fullPage: true,
    });
    await visitor.setViewportSize({ width: 1440, height: 900 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w2s-showcase-visibility-visible-1440.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 900 });
    await page.reload();
    await page.locator('[data-field="showcase.visible"]').uncheck();
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
    await visitor.goto('/');
    await expect(visitor.locator('#product-showcase')).toBeVisible();

    const hiddenPreview = await page.context().newPage();
    await hiddenPreview.goto('/admin/content/home/preview');
    await expect(hiddenPreview.getByTestId('preview-banner')).toBeVisible();
    await expect(hiddenPreview.locator('#product-showcase')).toHaveCount(0);
    await hiddenPreview.close();

    await page.getByTestId('publish-content').click();
    await expect(page.getByTestId('publication-review')).toBeVisible();
    await expect(page.getByTestId('publication-review')).toContainText('ظاهر');
    await expect(page.getByTestId('publication-review')).toContainText('مخفي');
    await page.getByTestId('review-confirm-publish').click();
    await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();

    await visitor.setViewportSize({ width: 390, height: 844 });
    await visitor.goto('/');
    await expect(visitor.locator('#product-showcase')).toHaveCount(0);
    await expect(visitor.locator('[data-testid="product-showcase"]')).toHaveCount(0);
    await expect(visitor.locator('a[href="#product-showcase"]')).toHaveCount(0);
    await visitor.screenshot({
      path: 'test-results/screenshots/w2s-showcase-visibility-hidden-390.png',
      fullPage: true,
    });
    await visitor.setViewportSize({ width: 1440, height: 900 });
    await visitor.screenshot({
      path: 'test-results/screenshots/w2s-showcase-visibility-hidden-1440.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await page.locator('[data-field="showcase.visible"]').check();
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
    const restoredPreview = await page.context().newPage();
    await restoredPreview.setViewportSize({ width: 1440, height: 900 });
    await restoredPreview.goto('/admin/content/home/preview');
    await expect(restoredPreview.locator('#product-showcase')).toBeVisible();
    await expect(restoredPreview.locator('#product-showcase')).toContainText(
      SHOWCASE_TITLE,
    );
    await expect(restoredPreview.getByTestId('showcase-action-product')).toBeVisible();
    await restoredPreview.screenshot({
      path: 'test-results/screenshots/w2s-showcase-visibility-restored-1440.png',
      fullPage: true,
    });
    await restoredPreview.close();

    await page.getByTestId('discard-draft').click();
    await expect(page.getByTestId('confirm-discard')).toBeVisible();
    await page.getByTestId('confirm-discard').click();
    await expect(page.getByText(DISCARD_SUCCESS)).toBeVisible();
    await visitor.goto('/');
    await expect(visitor.locator('#product-showcase')).toHaveCount(0);
  } finally {
    await anonymous.close();
  }
});
