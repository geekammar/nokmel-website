import { expect, test, type Page } from '@playwright/test';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? '';

const SAVE_SEO = 'تم حفظ مسودة SEO. لم يتغيّر المحتوى العام بعد.';
const PUBLISH_SUCCESS = 'تم نشر المحتوى وأصبحت النسخة الجديدة هي المعروضة للزوار.';
const DISCARD_SUCCESS = 'تم تجاهل المسودة غير المنشورة. النسخة المنشورة لم تتغيّر.';
const CONFLICT_REVIEW =
  'تغيّرت المسودة بعد إعداد المراجعة. لم يُنشر أي شيء. أعد تحميل أحدث نسخة ثم أعد المراجعة.';

const defaultTitles: Record<string, string> = {
  '/': 'نكمّل — متجرك في المحادثة. وبزنسك في مكان واحد.',
  '/features': 'الميزات — نكمّل',
  '/pricing': 'الأسعار — نكمّل',
  '/join': 'اطلب الانضمام — نكمّل',
  '/contact': 'تواصل معنا — نكمّل',
  '/privacy': 'سياسة الخصوصية — نكمّل',
  '/terms': 'الشروط والأحكام — نكمّل',
};

test.skip(!enabled, 'Admin e2e environment is not configured');

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('#admin-email', OWNER_EMAIL);
  await page.fill('#admin-password', OWNER_PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/admin$/);
}

async function resetCmsData(): Promise<void> {
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    await pool.query('truncate table content_sections, faq_items');
  } finally {
    await pool.end();
  }
}

async function openSeoEditor(page: Page): Promise<void> {
  await page.goto('/admin/content/home');
  await expect(page.getByTestId('content-editor')).toBeVisible();
  await page.getByTestId('editor-tab-seo').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('seo-editor')).toBeVisible();
}

test.beforeAll(async () => {
  await resetCmsData();
});

test.afterAll(async () => {
  await resetCmsData();
});

test.describe('page SEO editing and publication', () => {
  test('owner edits, previews, saves, reviews and publishes metadata without changing public content', async ({
    browser,
    page,
  }) => {
    test.slow();
    await resetCmsData();
    await signIn(page);
    await openSeoEditor(page);

    const seoTitle = page.getByTestId('seo-title');
    const initialTitle = await seoTitle.inputValue();
    const initialDescription = await page.getByTestId('seo-description').inputValue();
    await expect(page.getByTestId('seo-social-title-effective')).toContainText(initialTitle);

    const publishedTitle = 'عنوان SEO منشور من الاختبار الآلي';
    const publishedDescription = 'وصف SEO منشور من الاختبار الآلي للتحقق من بيانات التعريف.';
    const socialTitle = 'عنوان مشاركة مخصص';
    const socialDescription = 'وصف مشاركة مخصص للاختبار.';

    await seoTitle.fill(publishedTitle);
    await page.getByTestId('seo-description').fill(publishedDescription);
    await expect(page.getByTestId('seo-preview-title')).toHaveText(publishedTitle);
    await expect(page.getByTestId('seo-preview-description')).toHaveText(publishedDescription);
    await expect(page.getByTestId('seo-preview-url')).toHaveText('https://nokmel.tech');

    await page.getByTestId('seo-social-title').fill(socialTitle);
    await page.getByTestId('seo-social-description').fill(socialDescription);
    await page.getByTestId('seo-social-image').selectOption('app-icon-light-512');
    await expect(page.getByTestId('seo-social-preview-title')).toHaveText(socialTitle);
    await expect(page.getByTestId('seo-social-preview-description')).toHaveText(
      socialDescription,
    );

    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await visitor.goto('/');
      await expect(visitor).toHaveTitle(initialTitle);
      expect(await visitor.locator('meta[name="description"]').getAttribute('content')).toBe(
        initialDescription,
      );
      await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );

      await page.getByTestId('save-seo-draft').click();
      await expect(page.getByText(SAVE_SEO)).toBeVisible();
      await expect(page.getByTestId('seo-status')).toContainText('مسودة SEO غير منشورة');

      await page.reload();
      await expect(page.getByTestId('content-editor')).toBeVisible();
      await page.getByTestId('editor-tab-seo').click();
      await expect(page.getByTestId('seo-title')).toHaveValue(publishedTitle);
      await expect(page.getByTestId('seo-description')).toHaveValue(publishedDescription);

      await visitor.goto('/');
      await expect(visitor).toHaveTitle(initialTitle);
      await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        initialDescription,
      );

      await page.getByTestId('publish-content').click();
      await expect(page.getByTestId('publication-review')).toBeVisible();
      await expect(page.getByTestId('review-seo-summary')).toBeVisible();
      await expect(page.getByTestId('review-seo-summary')).toContainText(publishedTitle);
      await expect(page.getByTestId('review-seo-summary')).toContainText(socialTitle);
      await expect(page.getByTestId('review-confirm-publish')).toBeVisible();
      await page.getByTestId('review-confirm-publish').click();
      await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();

      await visitor.goto('/');
      await expect(visitor).toHaveTitle(publishedTitle);
      await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        publishedDescription,
      );
      await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expect(visitor.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://nokmel.tech',
      );
      await expect(visitor.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        socialTitle,
      );
      await expect(visitor.locator('meta[property="og:description"]')).toHaveAttribute(
        'content',
        socialDescription,
      );
      await expect(visitor.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        'https://nokmel.tech/brand/icons/app-icon-light-512.png',
      );
      await expect(visitor.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
        'https://nokmel.tech',
      );
      await expect(visitor.locator('meta[name="twitter:title"]')).toHaveAttribute(
        'content',
        socialTitle,
      );
      await expect(visitor.locator('meta[name="twitter:image"]')).toHaveAttribute(
        'content',
        'https://nokmel.tech/brand/icons/app-icon-light-512.png',
      );
      await expect(visitor.locator('h1')).toHaveText(
        'متجرك في المحادثة. وبزنسك في مكان واحد.',
      );
      expect(await visitor.locator('main').innerText()).not.toContain(publishedDescription);

      await page.getByTestId('editor-tab-seo').click();
      await page.getByTestId('seo-title').fill('عنوان مسودة يجب تجاهلها');
      await page.getByTestId('save-seo-draft').click();
      await expect(page.getByText(SAVE_SEO)).toBeVisible();
      await visitor.goto('/');
      await expect(visitor).toHaveTitle(publishedTitle);

      await page.getByTestId('discard-draft').click();
      await page.getByTestId('confirm-discard').click();
      await expect(page.getByText(DISCARD_SUCCESS)).toBeVisible();
      await visitor.goto('/');
      await expect(visitor).toHaveTitle(publishedTitle);
      await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        publishedDescription,
      );
    } finally {
      await anonymous.close();
    }
  });

  test('content and SEO drafts are reviewed together and a stale cross-tab confirmation is rejected', async ({
    browser,
    page,
  }) => {
    test.slow();
    await resetCmsData();
    await signIn(page);
    await page.goto('/admin/content/home');
    await expect(page.getByTestId('content-editor')).toBeVisible();
    await page.locator('[data-field="hero.headline"]').fill('عنوان محتوى مشترك');
    await page.getByTestId('save-draft').click();
    await expect(page.getByText('تم حفظ المسودة. لم يتغيّر المحتوى العام بعد.')).toBeVisible();

    await page.getByTestId('editor-tab-seo').click();
    await page.getByTestId('seo-title').fill('عنوان SEO مشترك');
    await page.getByTestId('seo-description').fill('وصف SEO مشترك.');
    await page.getByTestId('save-seo-draft').click();
    await expect(page.getByText(SAVE_SEO)).toBeVisible();

    await page.getByTestId('publish-content').click();
    await expect(page.getByTestId('publication-review')).toBeVisible();
    await expect(page.getByTestId('review-section-summary')).toContainText('الواجهة الرئيسية');
    await expect(page.getByTestId('review-seo-summary')).toContainText('عنوان SEO مشترك');

    const secondTab = await page.context().newPage();
    await secondTab.goto('/admin/content/home');
    await expect(secondTab.getByTestId('content-editor')).toBeVisible();
    await secondTab.locator('[data-field="finalCta.title"]').fill('تعديل أحدث من تبويب آخر');
    await secondTab.getByTestId('save-draft').click();
    await expect(
      secondTab.getByText('تم حفظ المسودة. لم يتغيّر المحتوى العام بعد.'),
    ).toBeVisible();
    await secondTab.close();

    await page.getByTestId('review-confirm-publish').click();
    await expect(page.getByText(CONFLICT_REVIEW)).toBeVisible();
    await expect(page.getByTestId('publication-review')).toBeHidden();

    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await visitor.goto('/');
      await expect(visitor).toHaveTitle(defaultTitles['/']);
      await expect(visitor.locator('h1')).toHaveText(
        'متجرك في المحادثة. وبزنسك في مكان واحد.',
      );
    } finally {
      await anonymous.close();
    }
  });

  test('anonymous visitors cannot open the SEO editor', async ({ browser }) => {
    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await visitor.goto('/admin/content/home');
      await visitor.waitForURL(/\/admin\/login$/);
      await expect(visitor.getByTestId('seo-editor')).toHaveCount(0);
    } finally {
      await anonymous.close();
    }
  });
});

test.describe('NKW-W32-005 final FAQ ordering evidence', () => {
  test('a newly inserted middle question shows its final position and publishes in order', async ({
    browser,
    page,
  }) => {
    test.slow();
    await resetCmsData();
    await signIn(page);
    await page.goto('/admin/content/home');
    await expect(page.getByTestId('content-editor')).toBeVisible();

    const before = await page.locator('[data-testid^="faq-item-"]').count();
    const newQuestion = 'سؤال جديد في منتصف الترتيب';
    await page.getByTestId('faq-add').click();
    const newIndex = before;
    await page.locator(`[data-field="faq.${newIndex}.question"]`).fill(newQuestion);
    await page.locator(`[data-field="faq.${newIndex}.answer"]`).fill('إجابة السؤال الجديد.');
    await page.getByTestId(`faq-up-${newIndex}`).click();
    await page.getByTestId(`faq-up-${newIndex - 1}`).click();
    await page.getByTestId('save-draft').click();
    await expect(page.getByText('تم حفظ المسودة. لم يتغيّر المحتوى العام بعد.')).toBeVisible();

    await page.getByTestId('publish-content').click();
    await expect(page.getByTestId('publication-review')).toBeVisible();
    await expect(page.getByTestId('review-faq-final-order')).toBeVisible();
    await expect(page.getByTestId('review-faq-summary')).toContainText('الموضع 5');
    const finalItems = page.getByTestId('review-faq-final-order-item');
    await expect(finalItems).toHaveCount(before + 1);
    await expect(finalItems.nth(4)).toHaveText(newQuestion);

    await page.setViewportSize({ width: 390, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: 'test-results/screenshots/w33-faq-final-order-review-390.png',
      fullPage: true,
    });
    await page.getByTestId('review-confirm-publish').click();
    await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();

    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await visitor.goto('/');
      const questions = await visitor.locator('#faq details summary').allTextContents();
      expect(questions[4]).toContain(newQuestion);
    } finally {
      await anonymous.close();
    }
  });
});

test.describe('public metadata on all seven routes', () => {
  test('defaults preserve titles, descriptions, canonical URLs, social tags and noindex', async ({
    page,
  }) => {
    await resetCmsData();
    for (const route of Object.keys(defaultTitles)) {
      await page.goto(route);
      await expect(page).toHaveTitle(defaultTitles[route]);
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect((description ?? '').length).toBeGreaterThan(10);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow',
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `https://nokmel.tech${route === '/' ? '' : route}`,
      );
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        defaultTitles[route],
      );
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        'https://nokmel.tech/brand/logos/nokmel-mark-transparent-1024.png',
      );
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image',
      );
    }
  });
});

test.describe('SEO editor responsiveness', () => {
  test('has no overflow and exposes previews and controls at approved widths', async ({ page }) => {
    await resetCmsData();
    await signIn(page);
    await openSeoEditor(page);

    for (const width of [320, 360, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('seo-title')).toBeVisible();
      await expect(page.getByTestId('seo-preview-title')).toBeVisible();
      await expect(page.getByTestId('seo-social-preview')).toBeVisible();
      await expect(page.getByTestId('seo-social-image')).toBeVisible();
      await expect(page.getByTestId('save-seo-draft')).toBeVisible();
      if (width < 768) {
        await expect(page.getByTestId('admin-nav-toggle')).toBeVisible();
      } else {
        await expect(page.getByTestId('admin-nav-toggle')).toBeHidden();
      }
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w33-seo-editor-390.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w33-seo-editor-1440.png',
      fullPage: true,
    });
  });
});
