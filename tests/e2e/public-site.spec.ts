import { expect, test } from '@playwright/test';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const databaseFixtureEnabled = Boolean(
  process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL,
);

test.beforeAll(async () => {
  if (!databaseFixtureEnabled) return;
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    await pool.query('truncate table content_sections, faq_items');
  } finally {
    await pool.end();
  }
});

const CTA = 'اطلب الانضمام';
const base = 'http://127.0.0.1:3100';

const publicRoutes = ['/', '/features', '/pricing', '/join', '/contact', '/privacy', '/terms'];

const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '360', width: 360, height: 780 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];

const keyRoutes = ['/', '/features', '/pricing', '/join'];

const titleByRoute: Record<string, string> = {
  '/': 'نكمّل — متجرك في المحادثة. وبزنسك في مكان واحد.',
  '/features': 'الميزات — نكمّل',
  '/pricing': 'الأسعار — نكمّل',
  '/join': 'اطلب الانضمام — نكمّل',
  '/contact': 'تواصل معنا — نكمّل',
  '/privacy': 'سياسة الخصوصية — نكمّل',
  '/terms': 'الشروط والأحكام — نكمّل',
};

const joinPlanQueries = [
  '?plan=starter',
  '?plan=starter&plan=pro',
  '?plan=starter&plan=starter',
  '?plan=',
  '?plan=INVALID',
  '?plan=very-long-invalid-value-exceeding-any-reasonable-limit-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '?plan=a%20b',
  '?plan=%3Cscript%3E',
  '?plan=%D8%A7%D9%84%D8%AE%D8%B7%D8%A9',
];

test.describe('routes render RTL-first with SEO safeguards', () => {
  for (const route of publicRoutes) {
    test(`route ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('main')).toBeVisible();

      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(robots).toContain('noindex');
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toBe(`https://nokmel.tech${route === '/' ? '' : route}`);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect((description ?? '').length).toBeGreaterThan(10);
    });
  }
});

test.describe('responsive layout across representative widths', () => {
  for (const vp of viewports) {
    test(`no horizontal overflow at ${vp.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      for (const route of publicRoutes) {
        await page.goto(route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(1);
      }
    });
  }
});

test.describe('screenshots (mobile + desktop, key routes)', () => {
  for (const vp of [
    { name: '390', width: 390, height: 844 },
    { name: '1440', width: 1440, height: 900 },
  ]) {
    for (const route of keyRoutes) {
      test(`full-page screenshot ${route} @ ${vp.name}px`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route);
        await page.screenshot({
          path: `test-results/screenshots/${route}-${vp.name}px.png`,
          fullPage: true,
        });
      });
    }
  }
});

test.describe('compact mobile header geometry', () => {
  for (const width of [320, 360, 390, 430]) {
    test(`header geometry at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const toggle = page.getByTestId('mobile-nav-toggle');
      await expect(toggle).toBeVisible();
      const toggleBox = await toggle.boundingBox();
      expect(toggleBox!.width).toBeLessThanOrEqual(56);
      expect(toggleBox!.height).toBeGreaterThanOrEqual(44);

      const cta = page.locator('header').getByRole('link', { name: CTA }).first();
      await expect(cta).toBeVisible();
      const ctaBox = await cta.boundingBox();
      expect(ctaBox!.height).toBeLessThanOrEqual(52);
      await expect(cta).toHaveAttribute('href', '/join');

      const header = page.locator('header');
      await expect(header).toBeVisible();
      const headerBox = await header.boundingBox();
      expect(headerBox!.height).toBeLessThanOrEqual(72);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('mobile menu behavior', () => {
  test('toggle opens a full-width panel inside the viewport with current-page indication', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByTestId('mobile-nav-toggle');
    const panel = page.getByTestId('mobile-nav-panel');

    await expect(panel).toBeHidden();
    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const panelBox = await panel.boundingBox();
    expect(panelBox!.width).toBeGreaterThanOrEqual(390 - 36);
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(390 + 1);

    await expect(
      page.locator('header').getByRole('link', { name: CTA }).first(),
    ).toHaveAttribute('href', '/join');
    const homeLink = panel.getByRole('link', { name: 'الرئيسية' });
    await expect(homeLink).toHaveAttribute('aria-current', 'page');
  });

  test('menu closes after navigating via a link selection', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByTestId('mobile-nav-toggle').click();
    const panel = page.getByTestId('mobile-nav-panel');
    await expect(panel).toBeVisible();
    await panel.getByRole('link', { name: 'الميزات' }).click();
    await expect(page).toHaveURL(/\/features$/);
    await expect(page.getByRole('heading', { name: 'الميزات', level: 1 })).toBeVisible();
    await expect(panel).toBeHidden();
  });

  test('menu closes on Escape and restores focus to the toggle', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByTestId('mobile-nav-toggle');
    await toggle.click();
    const panel = page.getByTestId('mobile-nav-panel');
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('menu closes on outside click', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByTestId('mobile-nav-toggle').click();
    const panel = page.getByTestId('mobile-nav-panel');
    await expect(panel).toBeVisible();
    await page.mouse.click(195, 500);
    await expect(panel).toBeHidden();
  });
});

test.describe('navigation coverage', () => {
  test('desktop navigation links reach the public routes with current-page state', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    for (const [label, path] of [
      ['الميزات', '/features'],
      ['الأسعار', '/pricing'],
      ['تواصل معنا', '/contact'],
    ] as const) {
      await page.locator('header nav').getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new URL(path, base).href);
      const link = page.locator('header nav').getByRole('link', { name: label });
      await expect(link).toHaveAttribute('aria-current', 'page');
      await page.goBack();
    }
  });

  test('header main nav and footer explore nav have distinct accessible labels', async ({ page }) => {
    await page.goto('/');
    const headerNav = page.getByRole('navigation', { name: 'التنقل الرئيسي' });
    const footerNav = page.locator('footer').getByRole('navigation', { name: 'روابط الاستكشاف' });
    await expect(headerNav).toHaveCount(1);
    await expect(footerNav).toHaveCount(1);
    await expect(headerNav).toHaveAttribute('aria-label', 'التنقل الرئيسي');
    await expect(footerNav).toHaveAttribute('aria-label', 'روابط الاستكشاف');
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

test.describe('homepage structure', () => {
  test('sections appear in the approved order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const headline = await page.locator('h1').first().innerText();
    expect(headline).toContain('متجرك في المحادثة');

    const h2s = await page.locator('main h2').allInnerTexts();
    const indexOf = (prefix: string) => h2s.findIndex((text) => text.startsWith(prefix));
    const titleProblems = 'قبل نكمّل';
    const titleCaps = 'ماذا يقدم';
    const titleSteps = 'كيف يعمل';
    const titlePricing = 'الانضمام المبكر';
    const titleFaq = 'أسئلة شائعة';
    const titleCta = 'جاهز تخلّي';
    for (const title of [
      titleProblems,
      titleCaps,
      titleSteps,
      titlePricing,
      titleFaq,
      titleCta,
    ]) {
      expect(indexOf(title)).toBeGreaterThanOrEqual(0);
    }
    for (const [first, second] of [
      [titleProblems, titleCaps],
      [titleCaps, titleSteps],
      [titleSteps, titlePricing],
      [titlePricing, titleFaq],
      [titleFaq, titleCta],
    ] as const) {
      expect(indexOf(second)).toBeGreaterThan(indexOf(first));
    }
    await expect(page.locator('#product-showcase')).toHaveCount(0);
  });

  test('showcase is hidden by default without an empty container or broken anchor', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.locator('#product-showcase')).toHaveCount(0);
    await expect(page.locator('[data-testid="product-showcase"]')).toHaveCount(0);
    await expect(page.locator('a[href="#product-showcase"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'شوف كيف يعمل' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    await expect(page.locator('#how-it-works')).toBeVisible();
    expect(await page.content()).not.toContain('عرض تفاعلي موجّه ببيانات اصطناعية');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: 'test-results/screenshots/w2s-home-showcase-hidden-390.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: 'test-results/screenshots/w2s-home-showcase-hidden-1440.png',
      fullPage: true,
    });
  });

  test('dark sections keep AA contrast including badges', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const ratios = await page.evaluate(() => {
      function lum(c: string): number | null {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        const [r, g, b] = [m[1], m[2], m[3]].map(Number).map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      function ratio(fg: string, bg: string): number | null {
        const a = lum(fg);
        const b = lum(bg);
        return a === null || b === null ? null : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      }
      function bgOf(el: Element): string {
        let cur: Element | null = el;
        while (cur) {
          const c = getComputedStyle(cur).backgroundColor;
          if (c && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c)) return c;
          cur = cur.parentElement;
        }
        return '#FFFFFF';
      }
      const darkSection = document.querySelector('section[data-theme="dark"]')!;
      const results: number[] = [];
      for (const el of darkSection.querySelectorAll('h2, p, [role="note"], figcaption, a, button, span')) {
        const text = el.textContent?.trim() ?? '';
        if (!text || el.children.length > 0) continue;
        const style = getComputedStyle(el);
        const value = ratio(style.color, bgOf(el));
        if (value !== null) results.push(value);
      }
      return { min: Math.min(...results), count: results.length };
    });
    expect(ratios.count).toBeGreaterThan(0);
    expect(ratios.min).toBeGreaterThanOrEqual(4.5);
  });
});

const authE2eConfigured = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const joinIntakeEnabled = ['1', 'true'].includes(
  (process.env.JOIN_INTAKE_ENABLED ?? (authE2eConfigured ? '1' : ''))
    .trim()
    .toLowerCase(),
);

test.describe('join form state', () => {
  test('keeps the disabled preview state or the explicitly enabled intake state', async ({
    page,
  }) => {
    await page.goto('/join');
    const inputs = page.getByTestId('join-form').locator('input, textarea');
    await expect(inputs).toHaveCount(4);
    for (const input of await inputs.all()) {
      if (joinIntakeEnabled) {
        await expect(input).toBeEnabled();
      } else {
        await expect(input).toBeDisabled();
      }
    }
    const submit = page.getByTestId('join-form').getByRole('button', { name: CTA });
    if (joinIntakeEnabled) {
      await expect(submit).toBeEnabled();
      await expect(page.getByTestId('join-intake-notice')).toContainText(
        'استلام طلبات الانضمام مفعّل',
      );
    } else {
      await expect(submit).toBeDisabled();
      await expect(page.getByTestId('join-intake-notice')).toContainText(
        'غير مفعّل',
      );
    }
  });

  test('labels are associated and ids unique', async ({ page }) => {
    await page.goto('/join');
    const inputs = page.getByTestId('join-form').locator('input, textarea');
    const ids: string[] = [];
    for (const input of await inputs.all()) {
      const id = await input.getAttribute('id');
      expect(id).toBeTruthy();
      ids.push(id as string);
      const label = page.locator(`label[for="${id}"]`);
      await expect(label).toBeVisible();
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

test.describe('accessibility basics', () => {
  test('keyboard focus lands on the skip link with visible outline', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveCount(1);
    await expect(focused).toHaveAttribute('href', '#main-content');
    const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('solid');
  });

  test('anchor targets are not obscured by the sticky header', async ({ page }) => {
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
});

test.describe('production runtime smoke (packaged build via next start)', () => {
  test('all seven public routes render without server errors', async ({ request }) => {
    for (const route of publicRoutes) {
      const response = await request.get(route);
      expect(response.status()).toBe(200);
      const body = await response.text();
      expect(body).toContain('dir="rtl"');
    }
  });

  test('all join plan-query variations render normally with no selected-plan context', async ({
    request,
  }) => {
    for (const query of joinPlanQueries) {
      const response = await request.get(`/join${query}`);
      expect(response.status()).toBe(200);
      const body = await response.text();
      expect(body).toContain('اطلب الانضمام');
      expect(body).not.toContain('سياق الخطة المحددة');
      expect(body).not.toContain('<script>alert(1)</script>');
    }
  });

  test('per-route page metadata targets the public domain, not the deployment domain', async ({
    request,
  }) => {
    for (const route of publicRoutes) {
      const response = await request.get(route);
      const body = await response.text();
      expect(body).toContain('noindex');
      expect(body).toContain('https://nokmel.tech');
      expect(body).not.toContain('vercel.app');
    }
  });

  test('pre-launch robots policy is served', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /');
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
});
