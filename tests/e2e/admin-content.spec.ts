import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { hashPassword } from 'better-auth/crypto';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? '';

const DEFAULT_HEADLINE = 'متجرك في المحادثة. وإدارة طلباتك في مكان واحد.';
const SAVE_SUCCESS = 'تم حفظ المسودة. لم يتغيّر المحتوى العام بعد.';
const PUBLISH_SUCCESS = 'تم نشر المحتوى وأصبحت النسخة الجديدة هي المعروضة للزوار.';
const DISCARD_SUCCESS = 'تم تجاهل المسودة غير المنشورة. النسخة المنشورة لم تتغيّر.';
const CONFLICT_REVIEW =
  'تغيّرت المسودة بعد إعداد المراجعة. لم يُنشر أي شيء. أعد تحميل أحدث نسخة ثم أعد المراجعة.';
const joinIntakeEnabled = ['1', 'true'].includes(
  (process.env.JOIN_INTAKE_ENABLED ?? '1').trim().toLowerCase(),
);

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

test.beforeAll(async () => {
  await resetCmsData();
});

test.afterAll(async () => {
  await resetCmsData();
});

test.describe('mobile admin navigation', () => {
  test('menu is closed by default, accessible, and closes on Escape and navigation', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    const toggle = page.getByTestId('admin-nav-toggle');
    const panel = page.getByTestId('admin-nav-panel');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();

    const toggleBox = await toggle.boundingBox();
    expect(toggleBox!.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox!.height).toBeGreaterThanOrEqual(44);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('link', { name: 'نظرة عامة' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await panel.getByRole('link', { name: 'المحتوى والـSEO' }).click();
    await page.waitForURL(/\/admin\/content$/);
    await expect(page.locator('main#admin-content h1')).toHaveText('المحتوى والـSEO');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: 'test-results/screenshots/w32-content-index-390.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(toggle).toBeHidden();
    await page.screenshot({
      path: 'test-results/screenshots/w32-content-index-1440.png',
      fullPage: true,
    });
  });
});

test.describe('homepage content workflow', () => {
  test('draft is private, preview is owner-only, publication updates the public site, discard preserves it', async ({
    browser,
    page,
  }) => {
    test.slow();
    const publishedHeadline = 'عنوان منشور من الاختبار الآلي';
    const discardedHeadline = 'عنوان مسودة يجب تجاهلها';
    const faqQuestion = 'سؤال آلي جديد للصفحة الرئيسية';

    await signIn(page);
    await page.goto('/admin/content/home');
    await expect(page.getByTestId('content-editor')).toBeVisible();
    await expect(page.getByTestId('editor-status')).toContainText('لا توجد نسخة منشورة بعد');

    const headline = page.locator('[data-field="hero.headline"]');
    await expect(headline).toHaveValue(DEFAULT_HEADLINE);
    await headline.fill(publishedHeadline);
    await expect(page.getByTestId('editor-dirty')).toBeVisible();
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
    await expect(page.getByTestId('editor-dirty')).toHaveCount(0);
    await expect(page.getByTestId('editor-status')).toContainText('مسودة غير منشورة فقط');

    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await visitor.goto('/');
      await expect(visitor.locator('h1')).toHaveText(DEFAULT_HEADLINE);
      expect(await visitor.content()).not.toContain(publishedHeadline);

      const preview = await page.context().newPage();
      await preview.setViewportSize({ width: 1440, height: 900 });
      await preview.goto('/admin/content/home/preview');
      await expect(preview.getByTestId('preview-banner')).toBeVisible();
      await expect(preview.locator('h1', { hasText: publishedHeadline })).toBeVisible();
      await preview.screenshot({
        path: 'test-results/screenshots/w32-preview-home-1440.png',
        fullPage: true,
      });
      await preview.close();

      await page.getByTestId('publish-content').click();
      await expect(page.getByTestId('publication-review')).toBeVisible();
      await expect(page.getByTestId('review-revision')).toContainText('1');
      await expect(page.getByTestId('review-section-summary')).toContainText('الواجهة الرئيسية');
      await expect(page.getByTestId('publication-review')).toContainText(
        'النشر يطبّق كامل المحتوى المحفوظ',
      );
      await page.getByTestId('review-cancel').click();
      await expect(page.getByTestId('publication-review')).toBeHidden();
      await visitor.goto('/');
      await expect(visitor.locator('h1')).toHaveText(DEFAULT_HEADLINE);

      await page.getByTestId('publish-content').click();
      await expect(page.getByTestId('publication-review')).toBeVisible();
      await page.getByTestId('review-confirm-publish').click();
      await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();
      await expect(page.getByTestId('editor-status')).toContainText('محتوى منشور');
      await expect(page.getByTestId('editor-revision')).toContainText('آخر إصدار منشور: 1');

      await visitor.goto('/');
      await expect(visitor.locator('h1')).toHaveText(publishedHeadline);

      const finalCta = page.locator('[data-field="finalCta.title"]');
      await finalCta.fill(discardedHeadline);
      await page.getByTestId('save-draft').click();
      await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
      await visitor.goto('/');
      await expect(visitor.locator('h1')).toHaveText(publishedHeadline);
      expect(await visitor.content()).not.toContain(discardedHeadline);

      const previewAfterDraft = await page.context().newPage();
      await previewAfterDraft.goto('/admin/content/home/preview');
      await expect(previewAfterDraft.getByText(discardedHeadline)).toBeVisible();
      await previewAfterDraft.close();

      await page.getByTestId('discard-draft').click();
      await expect(page.getByTestId('confirm-discard')).toBeVisible();
      await page.getByTestId('confirm-discard').click();
      await expect(page.getByText(DISCARD_SUCCESS)).toBeVisible();
      await expect(page.getByTestId('editor-status')).toContainText('محتوى منشور');
      await visitor.goto('/');
      await expect(visitor.locator('h1')).toHaveText(publishedHeadline);
      expect(await visitor.content()).not.toContain(discardedHeadline);

      await page.getByTestId('faq-add').click();
      const faqIndex = await page.locator('[data-testid^="faq-item-"]').count();
      const newIndex = faqIndex - 1;
      await page.locator(`[data-field="faq.${newIndex}.question"]`).fill(faqQuestion);
      await page
        .locator(`[data-field="faq.${newIndex}.answer"]`)
        .fill('إجابة السؤال الآلي الجديد.');
      await page.getByTestId('save-draft').click();
      await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
      await page.getByTestId('publish-content').click();
      await expect(page.getByTestId('publication-review')).toBeVisible();
      await page.getByTestId('review-confirm-publish').click();
      await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();

      await visitor.goto('/');
      await expect(visitor.locator('summary', { hasText: faqQuestion })).toBeVisible();
      await visitor.screenshot({
        path: 'test-results/screenshots/w32-public-home-published-1440.png',
        fullPage: true,
      });
    } finally {
      await anonymous.close();
    }
  });
});

test.describe('publication review safety', () => {
  test('cancelling the review never publishes and a stale confirmation is rejected', async ({
    browser,
    page,
  }) => {
    test.slow();
    await resetCmsData();
    await signIn(page);
    await page.goto('/admin/content/home');
    await expect(page.getByTestId('content-editor')).toBeVisible();
    await page.locator('[data-field="hero.headline"]').fill('مسودة أولى للمراجعة');
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();

    await page.getByTestId('publish-content').click();
    await expect(page.getByTestId('publication-review')).toBeVisible();
    await expect(page.getByTestId('review-revision')).toContainText('1');

    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await page.getByTestId('review-cancel').click();
      await expect(page.getByTestId('publication-review')).toBeHidden();
      await visitor.goto('/');
      await expect(visitor.locator('h1')).toHaveText(DEFAULT_HEADLINE);

      await page.getByTestId('publish-content').click();
      await expect(page.getByTestId('publication-review')).toBeVisible();

      const secondOwnerPage = await page.context().newPage();
      await secondOwnerPage.goto('/admin/content/home');
      await expect(secondOwnerPage.getByTestId('content-editor')).toBeVisible();
      await secondOwnerPage.locator('[data-field="finalCta.title"]').fill('تعديل من تبويب آخر');
      await secondOwnerPage.getByTestId('save-draft').click();
      await expect(secondOwnerPage.getByText(SAVE_SUCCESS)).toBeVisible();
      await expect(secondOwnerPage.getByTestId('editor-status')).toContainText('مسودة غير منشورة');
      await secondOwnerPage.close();

      await page.getByTestId('review-confirm-publish').click();
      await expect(page.getByText(CONFLICT_REVIEW)).toBeVisible();
      await expect(page.getByTestId('publication-review')).toBeHidden();

      await visitor.goto('/');
      await expect(visitor.locator('h1')).toHaveText(DEFAULT_HEADLINE);
    } finally {
      await anonymous.close();
    }
  });

  test('publication review remains usable at mobile and desktop widths', async ({ page }) => {
    await resetCmsData();
    await signIn(page);
    await page.goto('/admin/content/home');
    await expect(page.getByTestId('content-editor')).toBeVisible();
    await page.locator('[data-field="hero.headline"]').fill('عنوان مراجعة متجاوبة');
    await page.getByTestId('save-draft').click();
    await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
    await page.getByTestId('publish-content').click();
    await expect(page.getByTestId('publication-review')).toBeVisible();

    for (const width of [320, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
      const panel = page.getByTestId('publication-review');
      await expect(panel).toBeVisible();
      const panelBox = await panel.boundingBox();
      expect(panelBox!.width).toBeLessThanOrEqual(width);
      await expect(page.getByTestId('review-confirm-publish')).toBeVisible();
      await expect(page.getByTestId('review-cancel')).toBeVisible();
      if (width < 768) {
        await expect(page.getByTestId('admin-nav-toggle')).toBeVisible();
      } else {
        await expect(page.getByTestId('admin-nav-toggle')).toBeHidden();
      }
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w32-publication-review-390.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w32-publication-review-1440.png',
      fullPage: true,
    });

    await page.getByTestId('review-cancel').click();
    await expect(page.getByTestId('publication-review')).toBeHidden();
  });
});

const otherPageCases = [
  {
    key: 'features',
    path: '/features',
    field: 'hero.lead',
    value: 'مقدمة ميزات منشورة من الاختبار الآلي.',
  },
  {
    key: 'pricing',
    path: '/pricing',
    field: 'hero.lead',
    value: 'مقدمة أسعار منشورة من الاختبار الآلي.',
  },
  {
    key: 'join',
    path: '/join',
    field: 'hero.lead',
    value: 'مقدمة انضمام منشورة من الاختبار الآلي.',
  },
  {
    key: 'contact',
    path: '/contact',
    field: 'hero.lead',
    value: 'مقدمة تواصل منشورة من الاختبار الآلي.',
  },
  {
    key: 'privacy',
    path: '/privacy',
    field: 'legal.sections.0.heading',
    value: 'عنوان خصوصية منشور من الاختبار الآلي',
  },
  {
    key: 'terms',
    path: '/terms',
    field: 'legal.sections.0.heading',
    value: 'عنوان شروط منشور من الاختبار الآلي',
  },
] as const;

test.describe('per-page editing', () => {
  for (const pageCase of otherPageCases) {
    test(`edits, publishes and serves ${pageCase.key}`, async ({ browser, page }) => {
      await signIn(page);
      await page.goto(`/admin/content/${pageCase.key}`);
      await expect(page.getByTestId('content-editor')).toBeVisible();
      const field = page.locator(`[data-field="${pageCase.field}"]`);
      await expect(field).toBeVisible();
      await field.fill(pageCase.value);
      await page.getByTestId('save-draft').click();
      await expect(page.getByText(SAVE_SUCCESS)).toBeVisible();
      await page.getByTestId('publish-content').click();
      await expect(page.getByTestId('publication-review')).toBeVisible();
      await page.getByTestId('review-confirm-publish').click();
      await expect(page.getByText(PUBLISH_SUCCESS)).toBeVisible();

      const anonymous = await browser.newContext();
      try {
        const visitor = await anonymous.newPage();
        await visitor.goto(pageCase.path);
        await expect(visitor.getByText(pageCase.value).first()).toBeVisible();
        if (pageCase.key === 'privacy' || pageCase.key === 'terms') {
          await expect(visitor.getByText('نُسخة أولية قيد الإعداد')).toBeVisible();
        }
        if (pageCase.key === 'join') {
          if (joinIntakeEnabled) {
            await expect(visitor.locator('button', { hasText: 'اطلب الانضمام' })).toBeEnabled();
            await expect(visitor.locator('#join-name')).toBeEnabled();
          } else {
            await expect(visitor.locator('button', { hasText: 'اطلب الانضمام' })).toBeDisabled();
            await expect(visitor.locator('#join-name')).toBeDisabled();
          }
        }
      } finally {
        await anonymous.close();
      }
    });
  }
});

test.describe('editor responsiveness and validation', () => {
  test('editor has no horizontal overflow across approved widths', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/content/home');
    await expect(page.getByTestId('content-editor')).toBeVisible();

    for (const width of [320, 360, 390, 430, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('save-draft')).toBeVisible();
      await expect(page.locator('[data-field="hero.headline"]')).toBeVisible();
      if (width < 768) {
        await expect(page.getByTestId('admin-nav-toggle')).toBeVisible();
      } else {
        await expect(page.getByTestId('admin-nav-toggle')).toBeHidden();
      }
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w32-editor-home-390.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w32-editor-home-1440.png',
      fullPage: true,
    });
  });

  test('shows visible field validation and preserves input on invalid save', async ({ page }) => {
    await signIn(page);
    await page.goto('/admin/content/features');
    await expect(page.getByTestId('content-editor')).toBeVisible();
    const lead = page.locator('[data-field="hero.lead"]');
    await lead.fill('');
    await page.getByTestId('save-draft').click();
    await expect(page.getByText('راجع الحقول المطلوبة قبل الحفظ.')).toBeVisible();
    await expect(page.locator('#cms-field-hero-lead-error')).toContainText('هذا الحقل مطلوب.');
    await expect(lead).toBeFocused();
    await expect(page.getByTestId('editor-dirty')).toBeVisible();
  });
});

test.describe('content authorization', () => {
  test('anonymous and non-owner sessions cannot access editor or preview', async ({ browser }) => {
    const anonymous = await browser.newContext();
    try {
      const visitor = await anonymous.newPage();
      await visitor.goto('/admin/content/home');
      await visitor.waitForURL(/\/admin\/login$/);
      await visitor.goto('/admin/content/home/preview');
      await visitor.waitForURL(/\/admin\/login$/);
    } finally {
      await anonymous.close();
    }

    const email = `non-owner-${Date.now()}@nokmel-e2e.test`;
    const password = 'non-owner-e2e-password-123';
    const userId = `non-owner-${Date.now()}`;
    const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
    try {
      assertDestructiveTestTargetIsStillSafe(target);
      await pool.query(
        'insert into "user" (id, name, email, email_verified) values ($1, $2, $3, true)',
        [userId, 'Non Owner', email],
      );
      await pool.query(
        'insert into "account" (id, account_id, provider_id, user_id, password) values ($1, $2, $3, $4, $5)',
        [`${userId}-credential`, userId, 'credential', userId, await hashPassword(password)],
      );
    } finally {
      await pool.end();
    }

    try {
      const nonOwnerContext: BrowserContext = await browser.newContext();
      try {
        const nonOwnerPage = await nonOwnerContext.newPage();
        await nonOwnerPage.goto('/admin/login');
        await nonOwnerPage.fill('#admin-email', email);
        await nonOwnerPage.fill('#admin-password', password);
        await nonOwnerPage.getByRole('button', { name: 'تسجيل الدخول' }).click();
        await nonOwnerPage.waitForURL(/\/admin\/login$/);
        await nonOwnerPage.goto('/admin/content');
        await nonOwnerPage.waitForURL(/\/admin\/login$/);
        await nonOwnerPage.goto('/admin/content/home/preview');
        await nonOwnerPage.waitForURL(/\/admin\/login$/);
      } finally {
        await nonOwnerContext.close();
      }
    } finally {
      const cleanup = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
      try {
        await cleanup.pool.query('delete from "user" where id = $1', [userId]);
      } finally {
        await cleanup.pool.end();
      }
    }

  });
});
