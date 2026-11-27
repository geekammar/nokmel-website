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
        <div className={styles.merchantOrderCard} data-testid="merchant-order-card">
          <div className={styles.merchantOrderTop}>
            <span className={styles.merchantStatus} data-demo-field="order-state">
              {demo.orderStateLabel}
            </span>
            <bdi className={styles.merchantReference} data-demo-field="order-reference">
              {demo.orderReference}
            </bdi>
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

          <div className={styles.merchantTotals}>
            <span className={styles.merchantPayment} data-demo-field="payment-method">
              {demo.paymentLabel}
            </span>
            <span className={styles.merchantTotal} data-demo-field="total">
              {demo.formattedTotal}
            </span>
          </div>

          <span className={styles.merchantAcceptButton} data-demo-field="merchant-action">
            {demo.merchantActionLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
