import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import type { CtaLink } from '@/content/schema';

export function PageHero({
  title,
  lead,
  note,
}: {
  title: string;
  lead: string;
  note?: string;
}) {
  return (
    <Section className="!pt-14 sm:!pt-20 lg:!pt-24">
      <Container className="flex max-w-3xl flex-col items-start gap-5">
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary sm:text-xl">{lead}</p>
        {note ? (
          <p
            role="note"
            className="rounded-card border-s-4 border-status-info bg-surface p-4 leading-relaxed text-text-secondary"
          >
            {note}
          </p>
        ) : null}
      </Container>
    </Section>
  );
}

export function CtaBand({
  title,
  body,
  primary,
  secondary,
}: {
  title: string;
  body: string;
  primary: CtaLink;
  secondary?: CtaLink;
}) {
  return (
    <Section tone="dark">
      <Container className="flex flex-col items-start gap-5">
        <h2 className="max-w-2xl text-2xl font-bold sm:text-3xl">{title}</h2>
        <p className="max-w-2xl leading-relaxed text-text-secondary">{body}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Button href={primary.href} size="lg">
            {primary.label}
          </Button>
          {secondary ? (
            <a
              href={secondary.href}
              className="font-medium text-brand-highlight underline underline-offset-4 hover:underline"
            >
              {secondary.label}
            </a>
          ) : null}
        </div>
      </Container>
    </Section>
  );
}
