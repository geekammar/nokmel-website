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
      className={`${styles.device} ${
        variant === 'telegram' ? styles.telegramDevice : styles.merchantDevice
      }`}
    >
      <span className={styles.deviceNotch} aria-hidden="true" />
      <div className={styles.screen}>{children}</div>
    </div>
  );
}
