import { formatMoneyMinor } from '@/lib/localization/format-money';
import type { MarketContext } from '@/lib/localization/market-context';

/**
 * Single source of truth for the illustrative product/order composition.
 *
 * All values are fictional demonstration data. They are never read from the
 * commerce platform and must not be presented as a live order or as Nokmel
 * subscription pricing.
 */

export const DEMO_ORDER_REFERENCE = 'NW-1042';
export const DEMO_PRODUCT_NAME = 'هودي أساسي';
export const DEMO_QUANTITY = 1;
export const DEMO_UNIT_AMOUNT_MINOR = 65_000;
export const DEMO_DELIVERY_AMOUNT_MINOR = 0;
export const DEMO_PAYMENT_LABEL = 'الدفع عند الاستلام';
export const DEMO_ORDER_STATE_LABEL = 'جديد';
export const DEMO_MERCHANT_ACTION_LABEL = 'قبول الطلب';

export type DemoOrder = {
  market: MarketContext;
  productName: string;
  quantity: number;
  unitAmountMinor: number;
  deliveryAmountMinor: number;
  totalAmountMinor: number;
  formattedUnitPrice: string;
  formattedDelivery: string;
  formattedTotal: string;
  orderReference: string;
  paymentLabel: string;
  orderStateLabel: string;
  merchantActionLabel: string;
};

export function buildDemoOrder(market: MarketContext): DemoOrder {
  const quantity = DEMO_QUANTITY;
  const unitAmountMinor = DEMO_UNIT_AMOUNT_MINOR;
  const deliveryAmountMinor = DEMO_DELIVERY_AMOUNT_MINOR;
  const totalAmountMinor = unitAmountMinor * quantity + deliveryAmountMinor;

  return {
    market,
    productName: DEMO_PRODUCT_NAME,
    quantity,
    unitAmountMinor,
    deliveryAmountMinor,
    totalAmountMinor,
    formattedUnitPrice: formatMoneyMinor(unitAmountMinor, market),
    formattedDelivery: formatMoneyMinor(deliveryAmountMinor, market),
    formattedTotal: formatMoneyMinor(totalAmountMinor, market),
    orderReference: DEMO_ORDER_REFERENCE,
    paymentLabel: DEMO_PAYMENT_LABEL,
    orderStateLabel: DEMO_ORDER_STATE_LABEL,
    merchantActionLabel: DEMO_MERCHANT_ACTION_LABEL,
  };
}
