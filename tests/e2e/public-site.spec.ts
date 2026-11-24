import { expect, test } from '@playwright/test';

const CTA = 'اطلب الانضمام';

const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '360', width: 360, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
];

const publicRoutes = ['/', '/features', '/pricing', '/join', '/contact', '/privacy', '/terms'];

const titleByRoute: Record<string, string> = {
  '/': 'نكمّل — متجرك في المحادثة. وبزنسك في مكان واحد.',
  '/features': 'الميزات — نكمّل',
  '/pricing': 'الأسعار — نكمّل',
  '/join': 'اطلب الانضمام — نكمّل',
  '/contact': 'تواصل معنا — نكمّل',
  '/privacy': 'سياسة الخصوصية — نكمّل',
  '/terms': 'الشروط والأحكام — نكمّل',
};

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

function contrastRatio(a: string, b: string): number {
  const parse = (value: string): [number, number, number] => {
    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) throw new Error(`unparseable color: ${value}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  const la = relativeLuminance(parse(a));
  const lb = relativeLuminance(parse(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test.describe('public routes render RTL-first with SEO safeguards', () => {
  for (const route of publicRoutes) {
    test(`route ${route} renders with metadata and primary CTA`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route);

      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();

      await expect(await page.title()).toBe(titleByRoute[route]);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length ?? 0).toBeGreaterThan(10);

      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(robots).toContain('noindex');

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      const expectedCanonical = route === '/' ? 'https://nokmel.tech' : `https://nokmel.tech${route}`;
      expect(canonical).toBe(expectedCanonical);

      const cta = page.locator('header').getByRole('link', { name: CTA });
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute('href', '/join');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      await page.screenshot({ path: `test-results/screenshots/${route}-${'390px'}.png`, fullPage: true });
    });
  }
});

test.describe('homepage responsive layout', () => {
  for (const vp of viewports) {
    test(`homepage has no horizontal overflow at ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `test-results/screenshots/home-${vp.name}px.png`,
        fullPage: true,
      });
    });
  }
});

test.describe('navigation', () => {
  test('desktop navigation links reach the public routes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    for (const item of [
      { href: '/features', label: 'الميزات' },
      { href: '/pricing', label: 'الأسعار' },
      { href: '/contact', label: 'تواصل معنا' },
    ]) {
      await page.locator('header nav').getByRole('link', { name: item.label }).click();
      await expect(page).toHaveURL(new URL(item.href, 'http://127.0.0.1:3100').href);
      await expect(page.locator('h1')).toBeVisible();
      await page.goBack();
    }
  });

  test('mobile menu opens, navigates and holds the prominent CTA', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    const mobileNav = page.getByTestId('mobile-nav');
    await expect(mobileNav.locator('summary')).toBeVisible();
    await mobileNav.locator('summary').click();
    const panel = page.getByTestId('mobile-nav-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('link', { name: 'الميزات' })).toBeVisible();
    await expect(
      page.locator('header').getByRole('link', { name: CTA }),
    ).toHaveAttribute('href', '/join');
    await expect(page.locator('header').getByRole('link', { name: CTA })).toBeVisible();
    await panel.getByRole('link', { name: 'الأسعار' }).click();
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test('mobile navigation stays hidden on desktop widths', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByTestId('mobile-nav').locator('summary')).toBeHidden();
    await expect(page.locator('header nav').getByRole('link', { name: 'الميزات' })).toBeVisible();
  });

  test('footer navigation reaches legal and public pages', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('footer').getByRole('link', { name: 'سياسة الخصوصية' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('primary CTA from an inner page leads to the join page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/features');
    await page.locator('header').getByRole('link', { name: CTA }).click();
    await expect(page).toHaveURL(/\/join$/);
    await expect(page.locator('h1')).toContainText('اطلب الانضمام');
  });
});

test.describe('join form (W2: disabled preview state)', () => {
  test('all controls are disabled with a disabled submit and no success message', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/join');

    const inputs = page.getByTestId('join-form').locator('input, textarea');
    await expect(inputs).toHaveCount(4);
    for (const input of await inputs.all()) {
      await expect(input).toBeDisabled();
    }

    const submit = page.getByTestId('join-form').getByRole('button', { name: CTA });
    await expect(submit).toBeDisabled();
    await submit.click({ force: true });
    await expect(page).toHaveURL(/\/join$/);

    await expect(page.getByRole('note').filter({ hasText: 'استلام الطلبات غير متاح بعد' })).toBeVisible();
  });

  test('labels are associated with controls and ids are unique', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/join');
    const inputs = page.getByTestId('join-form').locator('input, textarea');
    const ids: string[] = [];
    const inputCount = await inputs.count();
    for (let index = 0; index < inputCount; index += 1) {
      const input = inputs.nth(index);
      const id = await input.getAttribute('id');
      expect(id).toBeTruthy();
      ids.push(id as string);
      await expect(page.locator(`label[for="${id}"]`)).toBeVisible();
    }
    inputCount > 0 && expect(new Set(ids).size).toBe(ids.length);
    expect(page.getByTestId('join-form').locator('label')).toHaveCount(inputCount);
  });
});

test.describe('accessibility', () => {
  test('keyboard focus lands on the skip link with a visible outline', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveCount(1);
    await expect(focused).toHaveAttribute('href', '#main-content');
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('solid');
  });

  test('anchor targets and keyboard focus are not obscured by the sticky header', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/');
    await page.getByRole('link', { name: 'شوف كيف يعمل' }).click();
    await expect(page.locator('#how-it-works')).toBeVisible();
    const headerBottom = await page.locator('header').evaluate((el) => el.getBoundingClientRect().bottom);
    const targetTop = await page
      .locator('#how-it-works')
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(targetTop).toBeGreaterThanOrEqual(headerBottom - 1);
  });

  test('dark sections keep light foreground text on dark backgrounds', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    for (const region of ['section[data-theme="dark"]', 'footer[data-theme="dark"]']) {
      const section = page.locator(region).first();
      const bg = await section.evaluate((el) => getComputedStyle(el).backgroundColor);
      const luminances = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const rgb = [Number(luminances![1]), Number(luminances![2]), Number(luminances![3])];
      const isDark = rgb.reduce((sum, c) => sum + c, 0) < 384;
      expect(isDark).toBe(true);
      const heading = section.locator('h2').first();
      const fg = await heading.evaluate((el) => getComputedStyle(el).color);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe('links integrity', () => {
  test('all internal links resolve to the approved public routes', async ({ page }) => {
    const internal = new Set<string>();
    for (const route of publicRoutes) {
      await page.goto(route);
      const hrefs = await page.locator('a[href^="/"]').evaluateAll((links) =>
        links.map((a) => (a as HTMLAnchorElement).getAttribute('href') as string),
      );
      for (const href of hrefs) internal.add(new URL(href, 'http://127.0.0.1:3100').pathname);
    }
    expect([...internal].sort()).toEqual([...publicRoutes].sort());
    for (const route of internal) {
      const response = await page.request.get(route);
      expect(response.status()).toBe(200);
    }
  });

  test('in-page anchors resolve to attached targets', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page.locator('a[href^="#"]').evaluateAll((links) =>
      links.map((a) => (a as HTMLAnchorElement).getAttribute('href')),
    );
    for (const href of hrefs) {
      await expect(page.locator(href as string).first()).toBeAttached();
    }
  });
});

test.describe('SEO additional', () => {
  test('open graph metadata is exposed per page', async ({ page }) => {
    await page.goto('/features');
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBe(titleByRoute['/features']);
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    expect(ogUrl).toBe('https://nokmel.tech/features');
    const ogSite = await page.locator('meta[property="og:site_name"]').getAttribute('content');
    expect(ogSite).toBe('Nokmel');
  });

  test('robots.txt enforces the pre-launch indexing barrier', async ({ page }) => {
    const response = await page.request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Sitemap:');
  });
});
