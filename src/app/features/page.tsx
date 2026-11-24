import type { Metadata } from 'next';
import { CtaBand, PageHero } from '@/components/sections/Hero';
import { InfoSection } from '@/components/sections/InfoSection';
import { StatusBadge } from '@/components/sections/StatusBadge';
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
      <PageHero
        title={features.hero.title}
        lead={features.hero.lead}
        note={features.hero.statusNote}
      />

      <Section spacing="compact" className="border-y border-border-subtle">
        <Container className="flex flex-col gap-4">
          <h2 className="text-xl font-bold sm:text-2xl">{features.legend.title}</h2>
          <p className="max-w-3xl leading-relaxed text-text-secondary">{features.legend.lead}</p>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="direction" />
            <StatusBadge status="planned" />
          </div>
        </Container>
      </Section>

      <InfoSection
        title={features.workflows.title}
        lead={features.workflows.lead}
        items={features.workflows.items}
        withStatus
      />

      <InfoSection
        title={features.planned.title}
        lead={features.planned.lead}
        items={features.planned.items}
        className="border-t border-border-subtle"
      />

      <Section spacing="compact">
        <Container className="flex max-w-3xl flex-col gap-2">
          <h2 className="text-xl font-bold sm:text-2xl">{features.availableNote.title}</h2>
          <p className="leading-relaxed text-text-secondary">{features.availableNote.body}</p>
        </Container>
      </Section>

      <CtaBand
        title={features.cta.title}
        body={features.cta.body}
        primary={features.cta.primaryCta}
      />
    </>
  );
}
