import type { Metadata } from 'next';
import { PageHero } from '@/components/sections/Hero';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Input } from '@/components/ui/Input';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import { TextLink } from '@/components/ui/TextLink';
import { join } from '@/content/ar/join';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'اطلب الانضمام — نكمّل',
  description: join.hero.lead,
  path: '/join',
});

const planPattern = /^[a-z0-9][a-z0-9-]{0,39}$/;

function PlanContext({ plan }: { plan?: string }) {
  if (!plan || !planPattern.test(plan)) return null;
  return (
    <p
      role="note"
      className="rounded-card border-s-4 border-status-info bg-page p-4 text-sm leading-relaxed"
    >
      <span className="font-semibold">{join.planContext.label}:</span>{' '}
      <span dir="ltr" className="font-en inline-block">
        {plan}
      </span>
      <span className="mt-1 block text-text-secondary">{join.planContext.description}</span>
    </p>
  );
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;

  return (
    <>
      <PageHero title={join.hero.title} lead={join.hero.lead} />

      <Section spacing="compact">
        <Container className="flex max-w-2xl flex-col gap-6">
          <p
            role="note"
            className="rounded-card border-s-4 border-status-warning bg-surface p-4"
          >
            <span className="block font-semibold text-text-primary">
              {join.disabledNotice.title}
            </span>
            <span className="mt-1 block leading-relaxed text-text-secondary">
              {join.disabledNotice.body}
            </span>
          </p>

          <Card className="flex flex-col gap-5" data-testid="join-form">
            <h2 className="text-xl font-bold sm:text-2xl">{join.formTitle}</h2>

            <PlanContext plan={plan} />

            <div role="group" aria-label={join.formTitle} className="grid gap-5 sm:grid-cols-2">
              {join.fields.map((field) =>
                field.type === 'textarea' ? (
                  <Textarea
                    key={field.id}
                    id={field.id}
                    name={field.name}
                    label={field.label}
                    placeholder={field.placeholder}
                    disabled
                    className="sm:col-span-2"
                  />
                ) : (
                  <Input
                    key={field.id}
                    id={field.id}
                    name={field.name}
                    label={field.label}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    placeholder={field.placeholder}
                    disabled
                    inputMode={field.type === 'tel' ? 'tel' : undefined}
                  />
                ),
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button disabled size="lg" aria-describedby="join-submit-hint">
                {join.submit.label}
              </Button>
              <p id="join-submit-hint" className="text-sm text-text-secondary">
                {join.submit.hint}
              </p>
            </div>
          </Card>

          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            <span className="font-semibold">{join.privacyNote.label}: </span>
            {join.privacyNote.body}{' '}
            <TextLink href={join.privacyNote.link.href}>{join.privacyNote.link.label}</TextLink>.
          </p>
        </Container>
      </Section>
    </>
  );
}
