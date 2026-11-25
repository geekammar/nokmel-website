import { ConceptShowcase } from '@/components/sections/ConceptShowcase';
import { FaqSection } from '@/components/sections/Faq';
import { CtaBand } from '@/components/sections/Hero';
import { CapabilityGroups, ProblemRows, StepsFlow } from '@/components/sections/InfoSection';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import type { HomeContent } from '@/content/ar/home';

export function HomeView({ content }: { content: HomeContent }) {
  return (
    <>
      <Section className="!pt-12 sm:!pt-16 lg:!pt-24" spacing="compact">
        <Container className="flex flex-col items-start gap-5">
          <p className="text-sm font-semibold tracking-wide text-action-secondary">
            {content.hero.eyebrow}
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {content.hero.headline}
          </h1>
          <p className="text-lg font-medium text-text-secondary sm:text-xl">
            {content.hero.tagline}
          </p>
          <p className="max-w-2xl leading-relaxed text-text-secondary">
            {content.hero.subheadline}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button href={content.hero.primaryCta.href} size="lg">
              {content.hero.primaryCta.label}
            </Button>
            <TextLink href={content.hero.secondaryCta.href}>
              {content.hero.secondaryCta.label}
            </TextLink>
          </div>
        </Container>
      </Section>

      <ConceptShowcase
        title={content.showcase.title}
        body={content.showcase.body}
        steps={content.showcase.steps}
        caption={content.showcase.caption}
        cta={content.showcase.primaryCta}
      />

      <Section spacing="compact">
        <Container className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{content.problems.title}</h2>
            <p className="leading-relaxed text-text-secondary">{content.problems.lead}</p>
          </div>
          <ProblemRows items={content.problems.items} />
        </Container>
      </Section>

      <Section spacing="compact" className="border-t border-border-subtle">
        <Container className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{content.capabilities.title}</h2>
            <p className="leading-relaxed text-text-secondary">{content.capabilities.lead}</p>
          </div>
          <CapabilityGroups items={content.capabilities.items} />
        </Container>
      </Section>

      <Section id="how-it-works" spacing="compact">
        <Container className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{content.steps.title}</h2>
            <p role="note" className="text-sm text-text-secondary">
              {content.steps.note}
            </p>
          </div>
          <StepsFlow steps={content.steps.items} />
        </Container>
      </Section>

      <Section spacing="compact" className="border-y border-border-subtle">
        <Container className="flex flex-col gap-5">
          <h2 className="text-2xl font-bold sm:text-3xl">{content.pricingTeaser.title}</h2>
          <p className="max-w-2xl leading-relaxed text-text-secondary">
            {content.pricingTeaser.body}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button href={content.pricingTeaser.primaryCta.href} size="lg">
              {content.pricingTeaser.primaryCta.label}
            </Button>
            <TextLink href={content.pricingTeaser.secondaryCta.href}>
              {content.pricingTeaser.secondaryCta.label}
            </TextLink>
          </div>
        </Container>
      </Section>

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
