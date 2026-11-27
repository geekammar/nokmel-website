import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductVisual } from '@/components/marketing/product-visual/ProductVisual';
import {
  DEMO_MARKET_FIXTURES,
  DEMO_ORDER_REFERENCE,
  DEMO_PRODUCT_NAME,
  DEMO_SECONDARY_ORDER_REFERENCE,
  DEMO_SECONDARY_PRODUCT_NAME,
  UnsupportedDemoMarketError,
  buildDemoOrder,
  resolveDemoMarketFixture,
} from '@/components/marketing/product-visual/demo-data';
import { formatMoneyMinor } from '@/lib/localization/format-money';
import { DEFAULT_MARKET } from '@/lib/localization/market-context';

describe('illustrative demo market fixtures', () => {
  it('exposes exactly one supported Egypt fixture and resolves it explicitly', () => {
    expect(Object.keys(DEMO_MARKET_FIXTURES)).toEqual(['EG:EGP']);
    const fixture = resolveDemoMarketFixture(DEFAULT_MARKET);
    expect(fixture.countryCode).toBe('EG');
    expect(fixture.currency).toBe('EGP');
    expect(fixture.mainOrder.unitAmountMinor).toBe(65_000);
    expect(fixture.mainOrder.quantity).toBe(1);
    expect(fixture.mainOrder.deliveryAmountMinor).toBe(0);
  });

  it('rejects unsupported market/currency combinations instead of relabelling EGP', () => {
    for (const market of [
      { countryCode: 'SA', locale: 'ar-SA', currency: 'SAR' },
      { countryCode: 'EG', locale: 'ar-EG', currency: 'SAR' },
      { countryCode: 'SA', locale: 'ar-SA', currency: 'EGP' },
      { countryCode: 'KW', locale: 'ar-KW', currency: 'KWD' },
    ]) {
      expect(() => buildDemoOrder(market)).toThrow(UnsupportedDemoMarketError);
    }
  });
});

describe('illustrative product visual', () => {
  it('keeps the approved main order values exact and shared', () => {
    const demo = buildDemoOrder(DEFAULT_MARKET);
    expect(demo.productName).toBe(DEMO_PRODUCT_NAME);
    expect(demo.quantity).toBe(1);
    expect(demo.unitAmountMinor).toBe(65_000);
    expect(demo.deliveryAmountMinor).toBe(0);
    expect(demo.totalAmountMinor).toBe(65_000);
    expect(demo.formattedUnitPrice).toBe(formatMoneyMinor(65_000, DEFAULT_MARKET));
    expect(demo.formattedSubtotal).toBe(formatMoneyMinor(65_000, DEFAULT_MARKET));
    expect(demo.formattedDelivery).toBe(formatMoneyMinor(0, DEFAULT_MARKET));
    expect(demo.formattedTotal).toBe(demo.formattedUnitPrice);
    expect(demo.orderReference).toBe(DEMO_ORDER_REFERENCE);
    expect(demo.paymentLabel).toBe('الدفع عند الاستلام');
    expect(demo.orderStateLabel).toBe('جديد');
    expect(demo.merchantActionLabel).toBe('قبول الطلب');
  });

  it('keeps the secondary order clearly fictional and in the preparing state', () => {
    const demo = buildDemoOrder(DEFAULT_MARKET);
    expect(demo.secondaryOrder.orderReference).toBe(DEMO_SECONDARY_ORDER_REFERENCE);
    expect(demo.secondaryOrder.orderReference).not.toBe(demo.orderReference);
    expect(demo.secondaryOrder.productName).toBe(DEMO_SECONDARY_PRODUCT_NAME);
    expect(demo.secondaryOrder.quantity).toBe(1);
    expect(demo.secondaryOrder.orderStateLabel).toBe('قيد التجهيز');
    expect(demo.secondaryOrder.totalAmountMinor).toBe(25_000);
    expect(demo.secondaryOrder.formattedTotal).toBe(
      formatMoneyMinor(25_000, DEFAULT_MARKET),
    );
    expect(demo.secondaryOrder.orderStateLabel).not.toBe(demo.orderStateLabel);
    expect(demo.secondaryOrder.timeline).toEqual([
      { label: 'القبول', time: '10:12' },
      { label: 'بدء التجهيز', time: '10:18' },
    ]);
    expect(demo.customer).toEqual({
      name: 'عميل توضيحي',
      phone: '01X XXX XXXX',
      address: 'القاهرة',
    });
  });

  it('renders consistent main product, quantity, reference, payment and total values', () => {
    const html = renderToStaticMarkup(<ProductVisual />);
    const demo = buildDemoOrder(DEFAULT_MARKET);
    expect((html.match(/data-demo-field="product-name"/g) ?? []).length).toBe(2);
    expect((html.match(/data-demo-field="quantity"/g) ?? []).length).toBe(2);
    expect((html.match(/data-demo-field="order-reference"/g) ?? []).length).toBe(2);
    expect((html.match(/data-demo-field="payment-method"/g) ?? []).length).toBe(2);
    expect((html.match(/data-demo-field="total"/g) ?? []).length).toBe(2);
    expect((html.match(/data-demo-field="unit-price"/g) ?? []).length).toBe(1);
    expect(html).toContain(demo.productName);
    expect(html).toContain(demo.orderReference);
    expect(html).toContain(demo.formattedUnitPrice);
    expect(html).toContain(demo.formattedTotal);
    expect(html).toContain(demo.orderStateLabel);
    expect(html).toContain(demo.merchantActionLabel);
    expect(html).toContain(demo.secondaryOrder.orderReference);
    expect(html).toContain(demo.secondaryOrder.productName);
    expect(html).toContain(demo.secondaryOrder.formattedTotal);
    expect(html).toContain(demo.secondaryOrder.orderStateLabel);
    expect(html).toContain('طلب سابق');
    expect(html).toContain('المسار الزمني');
    expect(html).toContain('عميل توضيحي');
    expect(html).toContain('01X XXX XXXX');
    expect(html).toContain('ج.م');
    expect(html).not.toContain('ر.س');
    expect(html).not.toContain('SAR');
  });

  it('keeps accept and prepare separated across the two orders', () => {
    const html = renderToStaticMarkup(<ProductVisual />);
    const mainCard = html.slice(
      html.indexOf('data-testid="merchant-order-card"'),
      html.indexOf('data-testid="merchant-secondary-order"'),
    );
    const secondary = html.slice(html.indexOf('data-testid="merchant-secondary-order"'));
    expect(mainCard).toContain('قبول الطلب');
    expect(mainCard).toContain('جديد');
    expect(mainCard).not.toContain('قيد التجهيز');
    expect(mainCard).not.toContain('بدء التجهيز');
    expect(secondary).toContain('قيد التجهيز');
    expect(secondary).not.toContain('قبول الطلب');
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
    expect(html).toContain('data-testid="tg-composer"');
    expect(html).not.toMatch(/<input\b/);
  });

  it('publishes a textual summary, centered captions and illustrative-data disclosure', () => {
    const html = renderToStaticMarkup(<ProductVisual />);
    expect(html).toContain('product-visual-summary');
    expect(html).toContain('/start');
    expect(html).toContain('مرحبًا بك في متجرك.');
    expect(html).toContain('رسالة...');
    expect(html).toContain('للعميل');
    expect(html).toContain('يتصفح المنتجات ويطلبها من تيليجرام');
    expect(html).toContain('للتاجر');
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
    expect(html).toContain('data-testid="device-frame-telegram"');
    expect(html).toContain('data-testid="device-frame-merchant"');
    expect(html).toContain('data-testid="flow-connector"');
    expect(html).toContain('data-direction="left"');
  });
});
