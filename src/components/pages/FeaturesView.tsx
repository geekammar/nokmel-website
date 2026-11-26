import { CtaBand, PageHero } from '@/components/sections/Hero';
import { CapabilityList } from '@/components/sections/InfoSection';
import { StatusBadge } from '@/components/sections/StatusBadge';
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
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold sm:text-3xl">
                {content.workflows.title}
              </h2>
              <StatusBadge status="direction" />
            </div>
            <p className="leading-relaxed text-text-secondary">
              {content.workflows.lead}
            </p>
          </div>
          <CapabilityList items={content.workflows.items} />
        </Container>
      </Section>

      <Section spacing="compact" className="border-t border-border-subtle">
        <Container className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold sm:text-3xl">{content.planned.title}</h2>
              <StatusBadge status="planned" />
            </div>
            <p className="leading-relaxed text-text-secondary">{content.planned.lead}</p>
          </div>
          <ul className="grid list-none gap-x-8 gap-y-6 p-0 sm:grid-cols-3">
            {content.planned.items.map((item, index) => (
              <li key={item.title} className="flex flex-col gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-control border border-border-subtle text-xs font-semibold text-text-secondary"
                >
                  {index + 1}
                </span>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{item.body}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaBand title={content.cta.title} body={content.cta.body} primary={content.cta.primaryCta} />
    </>
  );
}
