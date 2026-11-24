import type { Metadata } from 'next';
import { ChatIllustration } from '@/components/sections/ChatIllustration';
import { FaqSection, StepsSection } from '@/components/sections/Faq';
import { CtaBand } from '@/components/sections/Hero';
import { InfoSection } from '@/components/sections/InfoSection';
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
      <Section className="!pt-16 sm:!pt-24 lg:!pt-28">
        <Container className="flex flex-col items-start gap-6">
          <p className="text-sm font-semibold tracking-wide text-action-secondary">
            {home.hero.eyebrow}
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
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

      <ChatIllustration
        badge={home.showcase.badge}
        title={home.showcase.title}
        body={home.showcase.body}
        caption={home.showcase.caption}
      />

      <InfoSection
        title={home.problems.title}
        lead={home.problems.lead}
        items={home.problems.items}
      />

      <Section spacing="compact" className="border-y border-border-subtle">
        <Container className="flex flex-col gap-6">
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

      <InfoSection
        title={home.capabilities.title}
        lead={home.capabilities.lead}
        items={home.capabilities.items}
        withStatus
      />

      <StepsSection title={home.steps.title} note={home.steps.note} items={home.steps.items} />

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
