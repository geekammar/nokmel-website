import { BenefitsGrid } from '@/components/marketing/BenefitsGrid';
import { EarlyAccessCallout } from '@/components/marketing/EarlyAccessCallout';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { ProductHero } from '@/components/marketing/product-hero/ProductHero';
import { FaqSection } from '@/components/sections/Faq';
import { CtaBand } from '@/components/sections/Hero';
import type { HomeContent } from '@/content/ar/home';

export function HomeView({ content }: { content: HomeContent }) {
  return (
    <>
      <ProductHero content={content} showcaseVisible={content.showcase.visible} />
      <BenefitsGrid content={content.capabilities} />
      <HowItWorks content={content.steps} />
      <EarlyAccessCallout content={content.pricingTeaser} />
      <FaqSection title={content.faq.title} items={content.faq.items} />
      <CtaBand
        title={content.finalCta.title}
        body={content.finalCta.body}
        primary={content.finalCta.primaryCta}
        secondary={content.finalCta.secondaryCta}
      />
    </>
  );
}
