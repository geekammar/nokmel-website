import { expect, test } from '@playwright/test';

/**
 * Login UX regressions (no admin DB required):
 * - NKW-W31-UX-01 password visibility/geometry
 * - NKW-W31-S05-01 rate-limit cooldown UX
 *
 * All passwords here are synthetic layout values.
 */

const SYNTHETIC_SHORT = 'Synthetic-Only-123';
const SYNTHETIC_LONG = `SyntheticOnly-${'x'.repeat(92)}`;
const viewports = [320, 360, 390, 430, 768, 1440];

async function geometry(page: import('@playwright/test').Page) {
  const input = page.locator('#admin-password');
  const toggle = page.getByTestId('password-visibility-toggle');
  const inputBox = await input.boundingBox();
  const toggleBox = await toggle.boundingBox();
  const paddingRight = await input.evaluate((el) =>
    Number.parseFloat(getComputedStyle(el).paddingRight),
  );
  return { input, toggle, inputBox: inputBox!, toggleBox: toggleBox!, paddingRight };
}

function expectNoOverlap(
  inputBox: { x: number; width: number },
  toggleBox: { x: number; width: number },
  paddingRight: number,
) {
  const inputRight = inputBox.x + inputBox.width;
  expect(toggleBox.x).toBeGreaterThanOrEqual(inputRight - paddingRight - 1);
  expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(inputRight + 1);
}

test.describe('password visibility control', () => {
  for (const width of viewports) {
    test(`geometry and no overlap at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/admin/login');

      await expect(page.locator('#admin-password')).toHaveAttribute('type', 'password');
      await expect(page.locator('#admin-password')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('#admin-password')).toHaveAttribute(
        'autocomplete',
        'current-password',
      );
      await expect(page.locator('label[for="admin-password"]')).toHaveCSS('direction', 'rtl');

      const empty = await geometry(page);
      expect(empty.toggleBox.width).toBeGreaterThanOrEqual(43);
      expect(empty.toggleBox.height).toBeGreaterThanOrEqual(43);
      expect(empty.inputBox.height).toBeGreaterThanOrEqual(43);
      expectNoOverlap(empty.inputBox, empty.toggleBox, empty.paddingRight);

      await page.locator('#admin-password').fill(SYNTHETIC_LONG);
      const long = await geometry(page);
      expectNoOverlap(long.inputBox, long.toggleBox, long.paddingRight);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await expect(page.locator('#admin-password')).toHaveAttribute('type', 'password');
    });
  }

  test('toggle preserves value, accessibility state, and keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/login');
    const input = page.locator('#admin-password');
    const toggle = page.getByTestId('password-visibility-toggle');

    await expect(toggle).toHaveAccessibleName('إظهار كلمة المرور');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await input.fill(SYNTHETIC_SHORT);
    await page.screenshot({
      path: 'test-results/screenshots/admin-login-password-masked-390.png',
      fullPage: true,
    });

    await toggle.click();
    await expect(input).toHaveAttribute('type', 'text');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveAccessibleName('إخفاء كلمة المرور');
    expect(await input.inputValue()).toBe(SYNTHETIC_SHORT);
    await page.screenshot({
      path: 'test-results/screenshots/admin-login-password-visible-390.png',
      fullPage: true,
    });

    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(input).toHaveAttribute('type', 'password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toBeFocused();
    expect(await input.inputValue()).toBe(SYNTHETIC_SHORT);
  });

  test('long visible value keeps layout contained at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/login');
    await page.locator('#admin-password').fill(SYNTHETIC_LONG);
    await page.getByTestId('password-visibility-toggle').click();
    await expect(page.locator('#admin-password')).toHaveAttribute('type', 'text');
    const { inputBox, toggleBox, paddingRight } = await geometry(page);
    expectNoOverlap(inputBox, toggleBox, paddingRight);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: 'test-results/screenshots/admin-login-password-long-visible-1440.png',
      fullPage: true,
    });
  });
});

test.describe('rate-limit cooldown UX', () => {
  test('captures X-Retry-After, shows a countdown, and blocks immediate resubmission', async ({
    page,
  }) => {
    let signInRequests = 0;
    await page.route('**/api/auth/sign-in/email', async (route) => {
      signInRequests += 1;
      await route.fulfill({
        status: 429,
        headers: {
          'content-type': 'application/json',
          'x-retry-after': '2',
        },
        body: JSON.stringify({ message: 'Too many requests' }),
      });
    });

    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('owner@nokmel-e2e.test');
    await page.locator('#admin-password').fill('Synthetic-Wrong-Password-123');
    const submit = page.getByRole('button', { name: 'تسجيل الدخول' });
    await submit.click();

    const alert = page.locator('form p[role="alert"]');
    await expect(alert).toContainText('محاولات كثيرة');
    await expect(alert).toContainText('2 ثانية');
    await expect(submit).toBeDisabled();
    expect(signInRequests).toBe(1);

    await submit.click({ force: true }).catch(() => undefined);
    expect(signInRequests).toBe(1);

    await expect(submit).toBeEnabled({ timeout: 6000 });
  });
});
