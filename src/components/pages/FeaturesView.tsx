import { CtaBand, PageHero } from '@/components/sections/Hero';
import { CapabilityGroups } from '@/components/sections/InfoSection';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { FeaturesContent } from '@/content/ar/features';

export function FeaturesView({ content }: { content: FeaturesContent }) {
  return (
    <>
      <PageHero
        title={content.hero.title}
        lead={content.hero.lead}
        note={content.hero.statusNote}
      />

      <Section spacing="compact">
        <Container className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{content.workflows.title}</h2>
            <p className="leading-relaxed text-text-secondary">{content.workflows.lead}</p>
          </div>
          <CapabilityGroups items={[...content.workflows.items, ...content.planned.items]} />
          <div className="flex max-w-2xl flex-col gap-2">
            <h3 className="text-lg font-bold">{content.planned.title}</h3>
            <p className="leading-relaxed text-text-secondary">{content.planned.lead}</p>
          </div>
        </Container>
      </Section>

      <CtaBand title={content.cta.title} body={content.cta.body} primary={content.cta.primaryCta} />
    </>
  );
}
