import { chromium } from '@playwright/test';
const browser = await chromium.launch();
for (const width of [320, 360, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.goto('http://127.0.0.1:3100/', { waitUntil: 'networkidle' });
  const data = await page.evaluate(() => {
    const cta = document.querySelector('header a[href="/join"]');
    const summary = document.querySelector('header summary');
    const logo = document.querySelector('header a[aria-label] span');
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right) };
    };
    return {
      viewport: document.documentElement.clientWidth,
      cta: r(cta), ctaLines: cta ? Math.round(cta.getBoundingClientRect().height) : null,
      summary: r(summary),
      logoRow: r(logo),
      headerH: Math.round(document.querySelector('header').getBoundingClientRect().height),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  console.log(width, JSON.stringify(data));
  await page.close();
}
await browser.close();
