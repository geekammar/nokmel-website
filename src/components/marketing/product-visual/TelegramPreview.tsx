import type { DemoOrder } from './demo-data';
import { ProductThumbnail } from './ProductThumbnail';
import styles from './ProductVisual.module.css';

export function TelegramPreview({ demo }: { demo: DemoOrder }) {
  return (
    <div className={styles.telegram}>
      <div className={styles.tgHeader}>
        <span className={styles.tgBack} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3.5 5.5 8 10 12.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.tgAvatar} aria-hidden="true">
          <svg viewBox="0 0 18 18" fill="none">
            <path
              d="m3 9 11-5-2.6 10-3.1-3.3L6.4 13 6 9.7 3 9Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.tgHeading}>
          <span className={styles.tgTitle}>متجرك</span>
          <span className={styles.tgSubtitle}>بوت · تيليجرام</span>
        </span>
        <span className={styles.tgMore} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>

      <div className={styles.tgChat}>
        <div className={styles.tgProductBubble}>
          <ProductThumbnail className={styles.tgProductImage} />
          <span className={styles.tgProductName} data-demo-field="product-name">
            {demo.productName}
          </span>
          <span className={styles.tgProductMeta}>
            <span className={styles.tgPrice} data-demo-field="unit-price">
              {demo.formattedUnitPrice}
            </span>
            <span className={styles.tgQuantity}>
              الكمية: <span data-demo-field="quantity">{demo.quantity}</span>
            </span>
          </span>
          <span className={styles.tgAddButton} data-demo-field="customer-action">
            أضف إلى السلة
          </span>
        </div>

        <div className={styles.tgCartBubble}>
          <span className={styles.tgCartTitle}>ملخص الطلب</span>
          <span className={styles.tgCartLine}>
            <span className={styles.tgCartProduct}>
              {demo.productName} × {demo.quantity}
            </span>
            <span className={styles.tgCartTotal} data-demo-field="total">
              {demo.formattedTotal}
            </span>
          </span>
          <span className={styles.tgPayment} data-demo-field="payment-method">
            {demo.paymentLabel}
          </span>
          <span className={styles.tgCheckoutButton}>تأكيد الطلب</span>
        </div>

        <div className={styles.tgConfirmation}>
          <span className={styles.tgCheck} aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="m3.5 8.5 3 3 6-7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.tgConfirmationText}>
            تم تسجيل الطلب
            <bdi className={styles.tgOrderReference} data-demo-field="order-reference">
              {demo.orderReference}
            </bdi>
          </span>
        </div>
      </div>
    </div>
  );
}
