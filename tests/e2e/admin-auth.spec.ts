import { expect, test } from '@playwright/test';

/**
 * W3.1 admin auth browser flows. Requires the e2e environment (disposable
 * PostgreSQL + synthetic owner identity configured by the e2e setup); skips
 * otherwise so public-site coverage can always run.
 */
const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const OWNER_EMAIL = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? '';

const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '360', width: 360, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
];

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('#admin-email', OWNER_EMAIL);
  await page.fill('#admin-password', OWNER_PASSWORD);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
}

test.skip(!enabled, 'Admin e2e environment is not configured');

test.describe('login page rendering', () => {
  for (const vp of VIEWPORTS) {
    test(`login renders and has no horizontal overflow at ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/login');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('main#main-content h1')).toHaveText('تسجيل دخول المالك');
      await expect(page.locator('#admin-email')).toBeVisible();
      await expect(page.locator('#admin-password')).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      if (['320', '1440'].includes(vp.name)) {
        await page.screenshot({ path: `test-results/screenshots/admin-login-${vp.name}.png`, fullPage: true });
      }
    });
  }

  test('owner email is not exposed in the login page source', async ({ page }) => {
    await page.goto('/admin/login');
    const html = await page.content();
    expect(html).not.toContain(OWNER_EMAIL);
  });

  test('login form offers keyboard access and visible focus and autocomplete attributes', async ({ page }) => {
    await page.goto('/admin/login');
    const emailAutocomplete = await page.locator('#admin-email').getAttribute('autocomplete');
    const passwordAutocomplete = await page.locator('#admin-password').getAttribute('autocomplete');
    expect(emailAutocomplete).toMatch(/username|email/);
    expect(passwordAutocomplete).toBe('current-password');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? '');
    expect(['INPUT', 'BUTTON', 'A']).toContain(focused);
    const noSignUpLink = await page.locator('a[href*="sign-up"], a[href*="register"]').count();
    expect(noSignUpLink).toBe(0);
    const noSocial = await page.locator('button:has-text("Google"), button:has-text("GitHub")').count();
    expect(noSocial).toBe(0);
  });
});

test.describe('login flows', () => {
  test('invalid credentials show a generic error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('#admin-email', OWNER_EMAIL);
    await page.fill('#admin-password', 'definitely-wrong-password');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page.locator('[role="status"], [role="alert"]').first()).toContainText(
      'بيانات الدخول غير صحيحة',
    );
    await expect(page).not.toHaveURL(/\/admin$/);
    await page.screenshot({ path: 'test-results/screenshots/admin-login-error-1280.png' });
  });

  test('successful owner sign-in reaches the admin shell', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page);
    await page.waitForURL(/\/admin$/);
    await expect(page.locator('main#admin-content h1')).toHaveText('نظرة عامة');
    await expect(page.getByRole('navigation', { name: 'التنقل في لوحة الإدارة' })).toBeVisible();
    await expect(page.getByText('المحتوى والـSEO').first()).toBeVisible();
    await expect(page.locator('span', { hasText: 'غير متاح — في مرحلة لاحقة' }).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screenshots/admin-shell-1280.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/screenshots/admin-shell-390.png', fullPage: true });
  });

  test('logout returns to the login page and /admin becomes inaccessible', async ({ page }) => {
    await signIn(page);
    await page.waitForURL(/\/admin$/);
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await page.waitForURL(/\/admin\/login$/);
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login$/);
    await expect(page.locator('main#main-content h1')).toHaveText('تسجيل دخول المالك');
    await page.screenshot({ path: 'test-results/screenshots/admin-logout-1280.png' });
  });
});
