import { Button } from '@/components/ui/Button';
import type { HomeContent } from '@/content/ar/home';
import styles from './ProductHero.module.css';

export function HeroContent({ hero }: { hero: HomeContent['hero'] }) {
  return (
    <div className={styles.copy} data-testid="product-hero-copy">
      <div className={styles.eyebrow}>
        <span className={styles.eyebrowLine} aria-hidden="true" />
        <p>{hero.eyebrow}</p>
      </div>

      <h1 className={styles.headline}>{hero.headline}</h1>
      <p className={styles.tagline}>{hero.tagline}</p>
      <p className={styles.subheadline}>{hero.subheadline}</p>

      <div className={styles.actions}>
        <Button
          href={hero.primaryCta.href}
          size="md"
          className={`${styles.primaryCta} sm:min-h-[48px] sm:px-6 sm:text-lg`}
        >
          {hero.primaryCta.label}
        </Button>
        <Button
          href={hero.secondaryCta.href}
          variant="secondary"
          size="md"
          className={`${styles.secondaryCta} sm:min-h-[48px] sm:px-6 sm:text-base`}
        >
          {hero.secondaryCta.label}
        </Button>
      </div>

      <p className={styles.earlyAccess}>
        الانضمام المبكر لا يتضمن دفعاً أو اشتراكاً في هذه المرحلة.
      </p>
    </div>
  );
}
