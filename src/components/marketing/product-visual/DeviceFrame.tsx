import type { ReactNode } from 'react';
import styles from './ProductVisual.module.css';

export function DeviceFrame({
  variant,
  children,
}: {
  variant: 'telegram' | 'merchant';
  children: ReactNode;
}) {
  return (
    <div
      className={styles.device}
      data-testid={`device-frame-${variant}`}
      data-device={variant}
    >
      <span className={styles.deviceNotch} aria-hidden="true" />
      <div className={styles.screen} data-testid="device-screen">
        <div className={styles.statusBar} aria-hidden="true">
          <span className={styles.statusTime} dir="ltr">
            09:41
          </span>
          <span className={styles.statusIcons}>
            <svg viewBox="0 0 10 8" fill="none">
              <rect x="0" y="5.2" width="1.3" height="2.8" rx="0.4" fill="currentColor" />
              <rect x="2.4" y="3.7" width="1.3" height="4.3" rx="0.4" fill="currentColor" />
              <rect x="4.8" y="2.2" width="1.3" height="5.8" rx="0.4" fill="currentColor" />
              <rect x="7.2" y="0.6" width="1.3" height="7.4" rx="0.4" fill="currentColor" />
            </svg>
            <svg viewBox="0 0 12 8" fill="none">
              <path
                d="M1 2.7a8 8 0 0 1 10 0M2.9 4.6a5.3 5.3 0 0 1 6.2 0M4.8 6.3a2.5 2.5 0 0 1 2.4 0"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
              />
            </svg>
            <span className={styles.battery} aria-hidden="true">
              <span />
            </span>
          </span>
        </div>
        <div className={styles.deviceBody}>{children}</div>
        <span className={styles.homeIndicator} aria-hidden="true" />
      </div>
    </div>
  );
}
