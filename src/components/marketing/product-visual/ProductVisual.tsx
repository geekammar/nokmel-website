import {
  DEFAULT_MARKET,
  type MarketContext,
} from '@/lib/localization/market-context';
import { DeviceFrame } from './DeviceFrame';
import { MerchantPreview } from './MerchantPreview';
import { TelegramPreview } from './TelegramPreview';
import { buildDemoOrder } from './demo-data';
import styles from './ProductVisual.module.css';

export function ProductVisual({ market = DEFAULT_MARKET }: { market?: MarketContext }) {
  const demo = buildDemoOrder(market);
  const summary = `عرض توضيحي لرحلة الطلب: يتصفح العميل المنتج ${demo.productName} بكمية ${demo.quantity} في تيليجرام ويضيفه إلى السلة، ثم يؤكد الطلب بالدفع عند الاستلام بإجمالي ${demo.formattedTotal}. يظهر الطلب نفسه في لوحة التاجر بالمرجع ${demo.orderReference} بحالة ${demo.orderStateLabel} مع إجراء ${demo.merchantActionLabel}. ويظهر طلب سابق بالمرجع ${demo.secondaryOrder.orderReference} بحالة ${demo.secondaryOrder.orderStateLabel}. جميع القيم توضيحية.`;

  return (
    <figure
      className={styles.figure}
      data-testid="product-visual"
      aria-labelledby="product-visual-summary"
    >
      <p id="product-visual-summary" className="sr-only">
        {summary}
      </p>

      <div className={styles.stage} data-testid="product-visual-stage">
        <span className={styles.stageShape} aria-hidden="true" />
        <div className={styles.devices}>
          <div className={styles.deviceColumn}>
            <div className={styles.deviceA11yWrapper} aria-hidden="true">
              <DeviceFrame variant="telegram">
                <TelegramPreview demo={demo} />
              </DeviceFrame>
            </div>
            <p className={styles.caption} data-testid="caption-customer">
              <strong>للعميل</strong>
              <span>يتصفح المنتجات ويطلبها من تيليجرام.</span>
            </p>
          </div>

          <div className={styles.flowArrow} aria-hidden="true">
            <span className={styles.flowLine} />
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M20 12H5m5.5-5.5L5 12l5.5 5.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className={`${styles.deviceColumn} ${styles.merchantColumn}`}>
            <div className={styles.deviceA11yWrapper} aria-hidden="true">
              <DeviceFrame variant="merchant">
                <MerchantPreview demo={demo} />
              </DeviceFrame>
            </div>
            <p className={styles.caption} data-testid="caption-merchant">
              <strong>للتاجر</strong>
              <span>يستقبل الطلبات وينظمها ويتابعها من لوحة واحدة.</span>
            </p>
          </div>
        </div>
      </div>

      <figcaption className={styles.disclosure}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 7.2v3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="5" r="0.9" fill="currentColor" />
        </svg>
        عرض توضيحي ببيانات تجريبية — ليس لقطة من واجهة إنتاجية.
      </figcaption>
    </figure>
  );
}
