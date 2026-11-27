import styles from './ProductVisual.module.css';

export function ProductThumbnail({ className = '' }: { className?: string }) {
  return (
    <picture>
      <source srcSet="/marketing/demo/hoodie.avif" type="image/avif" />
      <source srcSet="/marketing/demo/hoodie.webp" type="image/webp" />
      <img
        src="/marketing/demo/hoodie.webp"
        alt=""
        width={480}
        height={480}
        loading="eager"
        decoding="async"
        className={`${styles.productImage} ${className}`}
      />
    </picture>
  );
}
