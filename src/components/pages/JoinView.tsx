import { PageHero } from '@/components/sections/Hero';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Input } from '@/components/ui/Input';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import { TextLink } from '@/components/ui/TextLink';
import type { JoinContent } from '@/content/ar/join';

export function JoinView({ content }: { content: JoinContent }) {
  return (
    <>
      <PageHero title={content.hero.title} lead={content.hero.lead} />

      <Section spacing="compact">
        <Container className="flex max-w-2xl flex-col gap-6">
          <p role="note" className="rounded-card border-s-4 border-status-warning bg-surface p-4">
            <span className="block font-semibold text-text-primary">
              {content.disabledNotice.title}
            </span>
            <span className="mt-1 block leading-relaxed text-text-secondary">
              {content.disabledNotice.body}
            </span>
          </p>

          <Card className="flex flex-col gap-5" data-testid="join-form">
            <h2 className="text-xl font-bold sm:text-2xl">{content.formTitle}</h2>

            <div role="group" aria-label={content.formTitle} className="grid gap-5 sm:grid-cols-2">
              {content.fields.map((field) =>
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
                {content.submit.label}
              </Button>
              <p id="join-submit-hint" className="text-sm text-text-secondary">
                {content.submit.hint}
              </p>
            </div>
          </Card>

          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            <span className="font-semibold">{content.privacyNote.label}: </span>
            {content.privacyNote.body}{' '}
            <TextLink href={content.privacyNote.link.href}>
              {content.privacyNote.link.label}
            </TextLink>
            .
          </p>
        </Container>
      </Section>
    </>
  );
}
