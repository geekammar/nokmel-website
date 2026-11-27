import { Logo } from '@/components/brand/Logo';
import type { DemoOrder } from './demo-data';
import { ProductThumbnail } from './ProductThumbnail';
import styles from './ProductVisual.module.css';

export function MerchantPreview({ demo }: { demo: DemoOrder }) {
  return (
    <div className={styles.merchant}>
      <div className={styles.merchantHeader}>
        <Logo variant="primary" size={18} />
        <span className={styles.merchantTitle}>الطلبات</span>
        <span className={styles.merchantAvatar} aria-hidden="true">
          ن
        </span>
      </div>

      <div className={styles.merchantBody}>
        <div className={styles.merchantStatusSummary} data-testid="merchant-status-summary">
          <span className={styles.merchantSummaryItem}>
            <span className={styles.merchantSummaryDotNew} aria-hidden="true" />
            جديد
          </span>
          <span className={styles.merchantSummaryItem}>
            <span className={styles.merchantSummaryDotPreparing} aria-hidden="true" />
            قيد التجهيز
          </span>
        </div>

        <div className={styles.merchantOrderCard} data-testid="merchant-order-card">
          <div className={styles.merchantOrderTop}>
            <span className={styles.merchantStatus} data-demo-field="order-state">
              {demo.orderStateLabel}
            </span>
            <bdi className={styles.merchantReference} data-demo-field="order-reference">
              {demo.orderReference}
            </bdi>
          </div>

          <div className={styles.merchantOrderTags}>
            <span className={styles.merchantOrderTag}>{demo.stockLabel}</span>
            <span className={styles.merchantOrderTag}>{demo.paymentStatusLabel}</span>
          </div>

          <div className={styles.merchantProduct}>
            <ProductThumbnail className={styles.merchantThumbnail} />
            <span className={styles.merchantProductInfo}>
              <span className={styles.merchantProductName} data-demo-field="product-name">
                {demo.productName}
              </span>
              <span className={styles.merchantQuantity}>
                الكمية: <span data-demo-field="quantity">{demo.quantity}</span>
              </span>
            </span>
          </div>

          <div className={styles.merchantDivider} />

          <div className={styles.merchantBreakdown} data-testid="merchant-breakdown">
            <span className={styles.merchantBreakdownRow}>
              <span>المجموع الفرعي</span>
              <span data-demo-field="subtotal">{demo.formattedSubtotal}</span>
            </span>
            <span className={styles.merchantBreakdownRow}>
              <span>التوصيل</span>
              <span data-demo-field="delivery">{demo.formattedDelivery}</span>
            </span>
          </div>

          <div className={styles.merchantTotals}>
            <span className={styles.merchantPayment} data-demo-field="payment-method">
              {demo.paymentLabel}
            </span>
            <span className={styles.merchantTotal} data-demo-field="total">
              {demo.formattedTotal}
            </span>
          </div>

          <div className={styles.merchantCustomer}>
            <span className={styles.merchantCustomerLabel}>العميل</span>
            <span className={styles.merchantCustomerName}>{demo.customer.name}</span>
            <span className={styles.merchantCustomerMeta}>
              {demo.customer.phone} · {demo.customer.address}
            </span>
          </div>

          <span className={styles.merchantAcceptButton} data-demo-field="merchant-action">
            {demo.merchantActionLabel}
          </span>
        </div>

        <span className={styles.merchantSecondaryLabel} data-testid="merchant-secondary-label">طلب سابق</span>

        <div className={styles.merchantSecondaryCard} data-testid="merchant-secondary-order">
          <div className={styles.merchantSecondaryTop}>
            <span className={styles.merchantSecondaryStatus} data-demo-field="secondary-order-state">
              {demo.secondaryOrder.orderStateLabel}
            </span>
            <bdi
              className={styles.merchantReference}
              data-demo-field="secondary-order-reference"
            >
              {demo.secondaryOrder.orderReference}
            </bdi>
          </div>
          <div className={styles.merchantSecondaryProduct}>
            <span className={styles.merchantSecondaryProductName} data-demo-field="secondary-product-name">
              {demo.secondaryOrder.productName} × {demo.secondaryOrder.quantity}
            </span>
            <span className={styles.merchantSecondaryTotal} data-demo-field="secondary-order-total">
              {demo.secondaryOrder.formattedTotal}
            </span>
          </div>
          <div className={styles.merchantSecondaryMeta} data-testid="merchant-secondary-meta">
            <span>{demo.secondaryOrder.paymentLabel}</span>
            <span>{demo.stockLabel}</span>
          </div>
          <div className={styles.merchantSecondaryTimeline} data-testid="merchant-secondary-timeline">
            <span className={styles.merchantSecondaryTimelineTitle}>المسار الزمني</span>
            {demo.secondaryOrder.timeline.map((entry) => (
              <span key={entry.label} className={styles.merchantSecondaryTimelineRow}>
                <span>{entry.label}</span>
                <bdi dir="ltr">{entry.time}</bdi>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.merchantFooterHint} data-testid="merchant-footer-hint">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M9.5 3.5 5 8l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        العودة إلى المتجر
      </div>
    </div>
  );
}
