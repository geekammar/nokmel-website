import type { Metadata } from 'next';
import { CtaBand, PageHero } from '@/components/sections/Hero';
import { CapabilityGroups } from '@/components/sections/InfoSection';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { features } from '@/content/ar/features';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'الميزات — نكمّل',
  description: features.hero.lead,
  path: '/features',
});

export default function FeaturesPage() {
  return (
    <>
      <PageHero title={features.hero.title} lead={features.hero.lead} note={features.hero.statusNote} />

      <Section spacing="compact">
        <Container className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{features.workflows.title}</h2>
            <p className="leading-relaxed text-text-secondary">{features.workflows.lead}</p>
          </div>
          <CapabilityGroups items={[...features.workflows.items, ...features.planned.items]} />
          <div className="flex max-w-2xl flex-col gap-2">
            <h3 className="text-lg font-bold">{features.planned.title}</h3>
            <p className="leading-relaxed text-text-secondary">{features.planned.lead}</p>
          </div>
        </Container>
      </Section>

      <CtaBand title={features.cta.title} body={features.cta.body} primary={features.cta.primaryCta} />
    </>
  );
}
