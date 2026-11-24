import { expect, test } from '@playwright/test';

const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '360', width: 360, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
];

for (const vp of viewports) {
  test(`renders RTL Arabic foundation at ${vp.name}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const cta = page.getByRole('link', { name: 'اطلب الانضمام' }).first();
    await expect(cta).toBeVisible();

    const logo = page.locator('header img').first();
    await expect(logo).toBeVisible();
    expect(await logo.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

    await page.screenshot({
      path: `test-results/screenshots/${vp.name}px.png`,
      fullPage: true,
    });
  });
}

test('CTA anchors to the non-production join preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('link', { name: 'اطلب الانضمام' }).first().click();
  await expect(page.locator('#join-preview')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('لن يتم إرسال أي بيانات');
  const url = new URL(page.url());
  expect(url.hash).toBe('#join-preview');
});

test('keyboard focus is visible on interactive elements', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveCount(1);
  const outlineWidth = await focused.evaluate(
    (el) => getComputedStyle(el).outlineWidth,
  );
  const outlineStyle = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outlineStyle).toBe('solid');
  expect(parseFloat(outlineWidth)).toBeGreaterThanOrEqual(2);
});

test('self-hosted brand fonts are loaded', async ({ page }) => {
  await page.goto('/');
  const families = await page.evaluate(() =>
    Array.from(document.fonts).map((font) => font.family),
  );
  expect(families.some((f) => f.toLowerCase().includes('plex'))).toBe(true);
  expect(families.some((f) => f.toLowerCase().includes('geist'))).toBe(true);
  expect(families.some((f) => f.toLowerCase().includes('alexandria'))).toBe(true);
});

test('all navigation links resolve to existing on-page anchors', async ({ page }) => {
  await page.goto('/');
  const hrefs = await page.locator('a[href^="#"]').evaluateAll((links) =>
    links.map((a) => (a as HTMLAnchorElement).getAttribute('href')),
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href).toBeTruthy();
    await expect(page.locator(href as string).first()).toBeAttached();
  }
});
