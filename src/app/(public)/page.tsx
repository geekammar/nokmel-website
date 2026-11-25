import type { Metadata } from 'next';
import { ConceptShowcase } from '@/components/sections/ConceptShowcase';
import { FaqSection } from '@/components/sections/Faq';
import { CtaBand } from '@/components/sections/Hero';
import { CapabilityGroups, ProblemRows, StepsFlow } from '@/components/sections/InfoSection';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import { home } from '@/content/ar/home';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'نكمّل — متجرك في المحادثة. وبزنسك في مكان واحد.',
  description: home.hero.subheadline,
  path: '/',
});

export default function HomePage() {
  return (
    <>
      <Section className="!pt-12 sm:!pt-16 lg:!pt-24" spacing="compact">
        <Container className="flex flex-col items-start gap-5">
          <p className="text-sm font-semibold tracking-wide text-action-secondary">
            {home.hero.eyebrow}
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {home.hero.headline}
          </h1>
          <p className="text-lg font-medium text-text-secondary sm:text-xl">{home.hero.tagline}</p>
          <p className="max-w-2xl leading-relaxed text-text-secondary">{home.hero.subheadline}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button href={home.hero.primaryCta.href} size="lg">
              {home.hero.primaryCta.label}
            </Button>
            <TextLink href={home.hero.secondaryCta.href}>{home.hero.secondaryCta.label}</TextLink>
          </div>
        </Container>
      </Section>

      <ConceptShowcase
        title={home.showcase.title}
        body={home.showcase.body}
        steps={home.showcase.steps}
        caption={home.showcase.caption}
        cta={home.showcase.primaryCta}
      />

      <Section spacing="compact">
        <Container className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{home.problems.title}</h2>
            <p className="leading-relaxed text-text-secondary">{home.problems.lead}</p>
          </div>
          <ProblemRows items={home.problems.items} />
        </Container>
      </Section>

      <Section spacing="compact" className="border-t border-border-subtle">
        <Container className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{home.capabilities.title}</h2>
            <p className="leading-relaxed text-text-secondary">{home.capabilities.lead}</p>
          </div>
          <CapabilityGroups items={home.capabilities.items} />
        </Container>
      </Section>

      <Section id="how-it-works" spacing="compact">
        <Container className="flex flex-col gap-6">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{home.steps.title}</h2>
            <p role="note" className="text-sm text-text-secondary">
              {home.steps.note}
            </p>
          </div>
          <StepsFlow steps={home.steps.items} />
        </Container>
      </Section>

      <Section spacing="compact" className="border-y border-border-subtle">
        <Container className="flex flex-col gap-5">
          <h2 className="text-2xl font-bold sm:text-3xl">{home.pricingTeaser.title}</h2>
          <p className="max-w-2xl leading-relaxed text-text-secondary">{home.pricingTeaser.body}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button href={home.pricingTeaser.primaryCta.href} size="lg">
              {home.pricingTeaser.primaryCta.label}
            </Button>
            <TextLink href={home.pricingTeaser.secondaryCta.href}>
              {home.pricingTeaser.secondaryCta.label}
            </TextLink>
          </div>
        </Container>
      </Section>

      <FaqSection title={home.faq.title} items={home.faq.items} />

      <CtaBand
        title={home.finalCta.title}
        body={home.finalCta.body}
        primary={home.finalCta.primaryCta}
        secondary={home.finalCta.secondaryCta}
      />
    </>
  );
}
