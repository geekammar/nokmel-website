import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import type { HomeContent } from '@/content/ar/home';

export function EarlyAccessCallout({
  content,
}: {
  content: HomeContent['pricingTeaser'];
}) {
  return (
    <Section tone="surface" spacing="compact">
      <Container>
        <div className="rounded-card border border-border-subtle bg-page p-6 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold sm:text-3xl">{content.title}</h2>
            <p className="mt-2 leading-relaxed text-text-secondary">{content.body}</p>
          </div>
          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:mt-0 lg:shrink-0 lg:flex-col lg:items-end">
            <Button href={content.primaryCta.href} size="lg">
              {content.primaryCta.label}
            </Button>
            <TextLink
              href={content.secondaryCta.href}
              className="inline-flex min-h-control items-center"
            >
              {content.secondaryCta.label}
            </TextLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}
