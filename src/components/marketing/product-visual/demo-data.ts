import { formatMoneyMinor } from '@/lib/localization/format-money';
import { isMarketContext, type MarketContext } from '@/lib/localization/market-context';

/**
 * Single source of truth for the illustrative product/order composition.
 *
 * All values are fictional demonstration data. The release exposes only the
 * Egypt / EGP fixture explicitly; a different market or currency is rejected
 * before rendering so EGP minor units can never be silently relabelled as
 * another currency.
 */

export const DEMO_ORDER_REFERENCE = 'NW-1042';
export const DEMO_PRODUCT_NAME = 'هودي أساسي';
export const DEMO_QUANTITY = 1;
export const DEMO_UNIT_AMOUNT_MINOR = 65_000;
export const DEMO_DELIVERY_AMOUNT_MINOR = 0;
export const DEMO_PAYMENT_LABEL = 'الدفع عند الاستلام';
export const DEMO_ORDER_STATE_LABEL = 'جديد';
export const DEMO_MERCHANT_ACTION_LABEL = 'قبول الطلب';

export const DEMO_SECONDARY_ORDER_REFERENCE = 'NW-1041';
export const DEMO_SECONDARY_PRODUCT_NAME = 'قبعة قطنية';
export const DEMO_SECONDARY_QUANTITY = 1;
export const DEMO_SECONDARY_UNIT_AMOUNT_MINOR = 25_000;
export const DEMO_SECONDARY_ORDER_STATE_LABEL = 'قيد التجهيز';

export type DemoMarketFixture = {
  countryCode: 'EG';
  currency: 'EGP';
  mainOrder: {
    reference: string;
    productName: string;
    quantity: number;
    unitAmountMinor: number;
    deliveryAmountMinor: number;
  };
  secondaryOrder: {
    reference: string;
    productName: string;
    quantity: number;
    unitAmountMinor: number;
    deliveryAmountMinor: number;
    orderStateLabel: string;
  };
};

export const DEMO_MARKET_FIXTURES: Readonly<Record<string, DemoMarketFixture>> = {
  'EG:EGP': {
    countryCode: 'EG',
    currency: 'EGP',
    mainOrder: {
      reference: DEMO_ORDER_REFERENCE,
      productName: DEMO_PRODUCT_NAME,
      quantity: DEMO_QUANTITY,
      unitAmountMinor: DEMO_UNIT_AMOUNT_MINOR,
      deliveryAmountMinor: DEMO_DELIVERY_AMOUNT_MINOR,
    },
    secondaryOrder: {
      reference: DEMO_SECONDARY_ORDER_REFERENCE,
      productName: DEMO_SECONDARY_PRODUCT_NAME,
      quantity: DEMO_SECONDARY_QUANTITY,
      unitAmountMinor: DEMO_SECONDARY_UNIT_AMOUNT_MINOR,
      deliveryAmountMinor: 0,
      orderStateLabel: DEMO_SECONDARY_ORDER_STATE_LABEL,
    },
  },
};

export class UnsupportedDemoMarketError extends Error {
  readonly code = 'UNSUPPORTED_DEMO_MARKET';

  constructor(market: MarketContext) {
    super(`Unsupported demo market: ${market.countryCode}/${market.currency}`);
    this.name = 'UnsupportedDemoMarketError';
  }
}

export function resolveDemoMarketFixture(market: MarketContext): DemoMarketFixture {
  if (!isMarketContext(market)) throw new UnsupportedDemoMarketError(market);
  const fixture = DEMO_MARKET_FIXTURES[`${market.countryCode}:${market.currency}`];
  if (!fixture) throw new UnsupportedDemoMarketError(market);
  return fixture;
}

export type DemoSecondaryOrder = {
  orderReference: string;
  productName: string;
  quantity: number;
  unitAmountMinor: number;
  deliveryAmountMinor: number;
  totalAmountMinor: number;
  formattedTotal: string;
  orderStateLabel: string;
  paymentLabel: string;
};

export type DemoOrder = {
  market: MarketContext;
  productName: string;
  quantity: number;
  unitAmountMinor: number;
  deliveryAmountMinor: number;
  totalAmountMinor: number;
  formattedUnitPrice: string;
  formattedSubtotal: string;
  formattedDelivery: string;
  formattedTotal: string;
  orderReference: string;
  paymentLabel: string;
  orderStateLabel: string;
  merchantActionLabel: string;
  secondaryOrder: DemoSecondaryOrder;
};

export function buildDemoOrder(market: MarketContext): DemoOrder {
  const fixture = resolveDemoMarketFixture(market);
  const { mainOrder, secondaryOrder } = fixture;
  const mainQuantity = mainOrder.quantity;
  const mainUnitAmountMinor = mainOrder.unitAmountMinor;
  const mainDeliveryAmountMinor = mainOrder.deliveryAmountMinor;
  const mainTotalAmountMinor =
    mainUnitAmountMinor * mainQuantity + mainDeliveryAmountMinor;

  const secondaryTotalAmountMinor =
    secondaryOrder.unitAmountMinor * secondaryOrder.quantity +
    secondaryOrder.deliveryAmountMinor;

  return {
    market,
    productName: mainOrder.productName,
    quantity: mainQuantity,
    unitAmountMinor: mainUnitAmountMinor,
    deliveryAmountMinor: mainDeliveryAmountMinor,
    totalAmountMinor: mainTotalAmountMinor,
    formattedUnitPrice: formatMoneyMinor(mainUnitAmountMinor, market),
    formattedSubtotal: formatMoneyMinor(mainUnitAmountMinor * mainQuantity, market),
    formattedDelivery: formatMoneyMinor(mainDeliveryAmountMinor, market),
    formattedTotal: formatMoneyMinor(mainTotalAmountMinor, market),
    orderReference: mainOrder.reference,
    paymentLabel: DEMO_PAYMENT_LABEL,
    orderStateLabel: DEMO_ORDER_STATE_LABEL,
    merchantActionLabel: DEMO_MERCHANT_ACTION_LABEL,
    secondaryOrder: {
      orderReference: secondaryOrder.reference,
      productName: secondaryOrder.productName,
      quantity: secondaryOrder.quantity,
      unitAmountMinor: secondaryOrder.unitAmountMinor,
      deliveryAmountMinor: secondaryOrder.deliveryAmountMinor,
      totalAmountMinor: secondaryTotalAmountMinor,
      formattedTotal: formatMoneyMinor(secondaryTotalAmountMinor, market),
      orderStateLabel: secondaryOrder.orderStateLabel,
      paymentLabel: DEMO_PAYMENT_LABEL,
    },
  };
}
