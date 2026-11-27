import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductVisual } from '@/components/marketing/product-visual/ProductVisual';
import {
  DEMO_ORDER_REFERENCE,
  DEMO_PRODUCT_NAME,
  buildDemoOrder,
} from '@/components/marketing/product-visual/demo-data';
import { formatMoneyMinor } from '@/lib/localization/format-money';
import { DEFAULT_MARKET } from '@/lib/localization/market-context';

describe('illustrative product visual', () => {
  it('uses one shared Egyptian demo order across both panels', () => {
    const demo = buildDemoOrder(DEFAULT_MARKET);
    expect(demo.productName).toBe(DEMO_PRODUCT_NAME);
    expect(demo.quantity).toBe(1);
    expect(demo.unitAmountMinor).toBe(65_000);
    expect(demo.deliveryAmountMinor).toBe(0);
    expect(demo.totalAmountMinor).toBe(65_000);
    expect(demo.formattedUnitPrice).toBe(formatMoneyMinor(65_000, DEFAULT_MARKET));
    expect(demo.formattedTotal).toBe(demo.formattedUnitPrice);
    expect(demo.orderReference).toBe(DEMO_ORDER_REFERENCE);
  });

  it('renders consistent product, quantity, reference, payment and total values', () => {
    const html = renderToStaticMarkup(<ProductVisual />);
    const demo = buildDemoOrder(DEFAULT_MARKET);
    expect((html.match(/data-demo-field="product-name"/g) ?? []).length).toBe(2);
    expect((html.match(/data-demo-field="quantity"/g) ?? []).length).toBe(2);
    expect((html.match(/data-demo-field="order-reference"/g) ?? []).length).toBe(2);
    expect((html.match(/data-demo-field="payment-method"/g) ?? []).length).toBe(1);
    expect(html).toContain(demo.productName);
    expect(html).toContain(demo.orderReference);
    expect(html).toContain(demo.formattedUnitPrice);
    expect(html).toContain(demo.formattedTotal);
    expect(html).toContain(demo.orderStateLabel);
    expect(html).toContain(demo.merchantActionLabel);
    expect(html).toContain('ج.م');
    expect(html).not.toContain('ر.س');
    expect(html).not.toContain('SAR');
  });

  it('is fully noninteractive and has no fake form semantics', () => {
    const html = renderToStaticMarkup(<ProductVisual />);
    expect(html).not.toMatch(/<button\b/);
    expect(html).not.toMatch(/<a\b/);
    expect(html).not.toMatch(/<input\b/);
    expect(html).not.toMatch(/<select\b/);
    expect(html).not.toMatch(/<textarea\b/);
    expect(html).not.toContain('tabindex=');
    expect(html).not.toContain('role="button"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('publishes a textual summary, captions and illustrative-data disclosure', () => {
    const html = renderToStaticMarkup(<ProductVisual />);
    expect(html).toContain('product-visual-summary');
    expect(html).toContain('يتصفح المنتجات ويطلبها من تيليجرام');
    expect(html).toContain('يستقبل الطلبات وينظمها ويتابعها من لوحة واحدة');
    expect(html).toContain('عرض توضيحي ببيانات تجريبية');
    expect(html).toContain('ليس لقطة من واجهة إنتاجية');
  });

  it('uses local AVIF/WebP assets with intrinsic dimensions', () => {
    const html = renderToStaticMarkup(<ProductVisual />);
    expect(html).toContain('/marketing/demo/hoodie.avif');
    expect(html).toContain('/marketing/demo/hoodie.webp');
    expect(html).toContain('width="480"');
    expect(html).toContain('height="480"');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
  });
});
