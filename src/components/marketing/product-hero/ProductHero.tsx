import { ProductVisual } from '@/components/marketing/product-visual/ProductVisual';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { HomeContent } from '@/content/ar/home';
import { HeroContent } from './HeroContent';
import styles from './ProductHero.module.css';

export function ProductHero({
  content,
  showcaseVisible,
}: {
  content: HomeContent;
  showcaseVisible: boolean;
}) {
  return (
    <Section
      data-testid="product-hero-section"
      className={`${styles.hero} ${showcaseVisible ? '' : styles.textOnlySection}`}
      spacing="compact"
    >
      <span className={styles.heroShapeOne} aria-hidden="true" />
      <span className={styles.heroShapeTwo} aria-hidden="true" />
      <Container
        className={`${styles.grid} ${showcaseVisible ? styles.withVisual : styles.textOnly}`}
        data-testid="product-hero"
        data-layout={showcaseVisible ? 'two-column' : 'text-only'}
      >
        <HeroContent hero={content.hero} />
        {showcaseVisible ? (
          <div className={styles.visual}>
            <ProductVisual />
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
