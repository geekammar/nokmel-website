import { expect, test } from '@playwright/test';
import { openDisposableTestPool } from '../../src/lib/db/disposable-test-database';

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

async function ownerSessionCount(): Promise<number> {
  const { pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    const { rows } = await pool.query(
      'select count(*)::int as count from "session" s join "user" u on u.id = s.user_id where u.email = $1',
      [OWNER_EMAIL],
    );
    return rows[0].count as number;
  } finally {
    await pool.end();
  }
}

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
    const desktopNav = page.getByRole('navigation', { name: 'التنقل في لوحة الإدارة' });
    await expect(desktopNav).toBeVisible();
    await expect(desktopNav.getByText('المحتوى والـSEO')).toBeVisible();
    await expect(desktopNav.locator('span', { hasText: 'غير متاح — في مرحلة لاحقة' }).first()).toBeVisible();
    const overview = page.locator('main#admin-content');
    await expect(overview.getByRole('heading', { name: 'لا توجد بيانات لعرضها بعد' })).toBeVisible();
    await expect(overview.getByText('المحتوى والـSEO')).toHaveCount(0);
    await expect(overview).not.toContainText('W3.1');
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


test.describe('security coverage closure', () => {
  test('A10: a separate browser context cannot access protected admin content', async ({ browser }) => {
    const ownerContext = await browser.newContext();
    const anonymousContext = await browser.newContext();
    try {
      const ownerPage = await ownerContext.newPage();
      await signIn(ownerPage);
      await ownerPage.waitForURL(/\/admin$/);
      await expect(ownerPage.locator('main#admin-content h1')).toHaveText('نظرة عامة');

      const anonymousPage = await anonymousContext.newPage();
      await anonymousPage.goto('/admin');
      await anonymousPage.waitForURL(/\/admin\/login$/);
      await expect(anonymousPage.locator('main#main-content h1')).toHaveText('تسجيل دخول المالك');

      const sessionResponse = await anonymousContext.request.get('/api/auth/get-session');
      expect(sessionResponse.status()).toBe(200);
      expect(await sessionResponse.json()).toBeNull();
    } finally {
      await ownerContext.close();
      await anonymousContext.close();
    }
  });

  test('S02: server-side public sign-up refusal creates no user', async ({ request }) => {
    const email = 'e2e-signup-attempt@nokmel-e2e.test';
    const password = 'synthetic-signup-password-123';
    const response = await request.post('/api/auth/sign-up/email', {
      headers: { origin: 'http://127.0.0.1:3100' },
      data: { email, password, name: 'Synthetic Signup Attempt' },
      maxRedirects: 0,
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(await response.text()).not.toContain(password);

    const { pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
    try {
      const { rows } = await pool.query('select count(*)::int as count from "user" where email = $1', [
        email,
      ]);
      expect(rows[0].count).toBe(0);
    } finally {
      await pool.end();
    }
  });

  test('S06: an untrusted Origin cannot perform sign-in', async ({ request }) => {
    const response = await request.post('/api/auth/sign-in/email', {
      headers: {
        origin: 'https://attacker.invalid',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-mode': 'cors',
      },
      data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).not.toContain(OWNER_PASSWORD);
  });

  test('S07: an unsafe external callback URL is not honored by the sign-in flow', async ({
    request,
  }) => {
    const sessionsBefore = await ownerSessionCount();
    const response = await request.post('/api/auth/sign-in/email', {
      headers: { origin: 'http://127.0.0.1:3100' },
      data: {
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD,
        callbackURL: 'https://attacker.invalid/phish',
      },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    const location = response.headers()['location'] ?? '';
    expect(location).not.toContain('attacker.invalid');
    expect(await ownerSessionCount()).toBe(sessionsBefore);
  });
});
