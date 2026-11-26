import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PRODUCT_SHOWCASE_ORDER_REFERENCE,
  PRODUCT_SHOWCASE_PRICES,
  PRODUCT_SHOWCASE_QUANTITY,
  PRODUCT_SHOWCASE_SCENES,
  PRODUCT_SHOWCASE_STEP_MS,
  ProductShowcase,
  formatShowcaseMoney,
} from '@/components/sections/ProductShowcase';
import { home } from '@/content/ar/home';

const showcaseProps = {
  title: home.showcase.title,
  body: home.showcase.body,
  steps: home.showcase.steps,
  caption: home.showcase.caption,
  cta: home.showcase.primaryCta,
};

describe('interactive product showcase', () => {
  it('uses only verified customer and merchant steps', () => {
    expect(PRODUCT_SHOWCASE_SCENES[0]).toMatchObject({
      side: 'customer',
      customer: 'browse',
      merchant: 'waiting',
    });
    expect(PRODUCT_SHOWCASE_SCENES[PRODUCT_SHOWCASE_SCENES.length - 1]).toMatchObject({
      side: 'merchant',
      customer: 'placed',
      merchant: 'accepted',
    });
    expect(PRODUCT_SHOWCASE_SCENES.map((scene) => scene.id)).toEqual([
      'browse',
      'select',
      'cart',
      'checkout',
      'placed',
      'merchant-new',
      'merchant-accept',
    ]);
    expect(PRODUCT_SHOWCASE_SCENES.some((scene) => scene.customer === 'review')).toBe(true);
    expect(PRODUCT_SHOWCASE_SCENES.some((scene) => scene.merchant === 'new')).toBe(true);
  });

  it('keeps the complete autoplay sequence within the approved duration', () => {
    const seconds = (PRODUCT_SHOWCASE_STEP_MS * (PRODUCT_SHOWCASE_SCENES.length - 1)) / 1000;
    expect(seconds).toBeGreaterThanOrEqual(12);
    expect(seconds).toBeLessThanOrEqual(18);
  });

  it('uses a deterministic two-unit order with consistent totals', () => {
    expect(PRODUCT_SHOWCASE_QUANTITY).toBe(2);
    expect(PRODUCT_SHOWCASE_ORDER_REFERENCE).toBe('NW-1042');
    expect(PRODUCT_SHOWCASE_PRICES).toEqual({
      unitMinor: 2500,
      quantity: 2,
      subtotalMinor: 5000,
      deliveryMinor: 1000,
      totalMinor: 6000,
    });
    expect(formatShowcaseMoney(2500)).toBe('25.00 ر.س');
    expect(formatShowcaseMoney(5000)).toBe('50.00 ر.س');
    expect(formatShowcaseMoney(1000)).toBe('10.00 ر.س');
    expect(formatShowcaseMoney(6000)).toBe('60.00 ر.س');
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/sections/ProductShowcase.tsx'),
      'utf8',
    );
    expect(source).not.toContain('أضف قطعتين');
    expect(source).not.toContain('UserBubble');
    expect(source).toContain('الكمية المحددة: قطعتان');
  });

  it('labels the demo as synthetic and does not create a real order', () => {
    const html = renderToStaticMarkup(<ProductShowcase {...showcaseProps} />);
    expect(html).toContain('بيانات اصطناعية');
    expect(html).toContain('لا يُنشئ طلباً حقيقياً أو يرسل بيانات');
    expect(html).toContain('ولا يمثل واجهة الإنتاج النهائية');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('join_request_success');
  });

  it('renders real action buttons with accessible names', () => {
    const html = renderToStaticMarkup(<ProductShowcase {...showcaseProps} />);
    expect(html).toMatch(/<button[^>]*data-testid="showcase-action-product"/);
    expect(html).toContain('aria-label="اختيار المنتج التجريبي: عبوة تغليف كرتونية"');
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/sections/ProductShowcase.tsx'),
      'utf8',
    );
    for (const testId of [
      'showcase-action-product',
      'showcase-action-quantity',
      'showcase-action-checkout',
      'showcase-action-confirm-cod',
      'showcase-action-open-merchant',
      'showcase-action-accept-order',
    ]) {
      expect(source).toContain(`testId="${testId}"`);
    }
    expect(source).toContain('type="button"');
  });

  it('does not advertise unverified channels or automation', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/components/sections/ProductShowcase.tsx'),
      'utf8',
    );
    expect(source).toContain('الدفع عند الاستلام');
    for (const unsupported of [
      'واتساب',
      'WhatsApp',
      'ذكاء اصطناعي',
      'AI shopping',
      'دفع إلكتروني',
      'بطاقة ائتمان',
      'شحن تلقائي',
      'توصيل تلقائي',
      'fetch(',
    ]) {
      expect(source).not.toContain(unsupported);
    }
    expect(source).not.toContain('fetch(');
  });

  it('renders manual controls and the reduced-motion note slot', () => {
    const html = renderToStaticMarkup(<ProductShowcase {...showcaseProps} />);
    expect(html).toContain('data-testid="showcase-prev"');
    expect(html).toContain('data-testid="showcase-next"');
    expect(html).toContain('data-testid="showcase-replay"');
    expect(html).toContain('data-testid="showcase-autoplay"');
    expect(html).toContain('data-testid="showcase-live"');
    expect(html).toContain('aria-live="polite"');
  });
});
