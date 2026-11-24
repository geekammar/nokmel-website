import type { Metadata } from 'next';
import { Logo } from '@/components/brand/Logo';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Container } from '@/components/ui/Container';
import { Input } from '@/components/ui/Input';
import { Section } from '@/components/ui/Section';
import { Textarea } from '@/components/ui/Textarea';
import { TextLink } from '@/components/ui/TextLink';
import { ar } from '@/i18n/messages/ar';
import { readTokens } from '@/lib/brand-tokens';
import { site } from '@/lib/site';

const lightSwatches = [
  '--brand-primary',
  '--action-secondary',
  '--brand-highlight',
  '--color-background',
  '--color-surface',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-border-subtle',
  '--color-border-input',
  '--color-focus-ring',
  '--color-success',
  '--color-warning',
  '--color-error',
  '--color-info',
];

const darkSwatches = [
  '--color-background',
  '--color-surface',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-border-subtle',
  '--color-border-input',
  '--action-primary-bg',
  '--action-primary-fg',
  '--color-focus-ring',
];

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <figure className="flex flex-col gap-1">
      <span
        aria-hidden="true"
        className="block h-16 w-full rounded-control border border-border-subtle"
        style={{ backgroundColor: `var(${name})` }}
      />
      <figcaption className="flex flex-col">
        <span dir="ltr" className="text-left text-xs font-medium text-text-primary">
          {name}
        </span>
        <span dir="ltr" className="text-left text-xs text-text-secondary">
          {value}
        </span>
      </figcaption>
    </figure>
  );
}

export const metadata: Metadata = {
  title: 'نكمّل — صفحة التأسيس (مؤقتة)',
  robots: { index: false, follow: false },
};

export default function FoundationPage() {
  const tokens = readTokens();
  return (
    <>
      <Section className="py-20 sm:py-28">
        <Container className="flex flex-col items-start gap-6">
          <Logo variant="primary" size={96} />
          <p className="text-sm font-semibold tracking-wide text-action-secondary">
            <span lang="en" dir="ltr">
              {ar.hero.eyebrow}
            </span>
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            {ar.hero.headline}
          </h1>
          <p className="max-w-xl text-lg text-text-secondary sm:text-xl">{ar.hero.tagline}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button href="#join-preview" size="lg">
              {site.ctaLabel}
            </Button>
            <TextLink href="#tokens">{ar.hero.secondary}</TextLink>
          </div>
        </Container>
      </Section>

      <Section tone="dark">
        <Container className="flex flex-col items-start gap-4">
          <h2 className="text-2xl font-bold sm:text-3xl">{ar.brandSection.title}</h2>
          <p className="max-w-xl text-text-secondary">{ar.brandSection.body}</p>
          <Button href="#join-preview" size="lg">
            {ar.brandSection.cta}
          </Button>
        </Container>
      </Section>

      <Section id="tokens">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{ar.tokensSection.title}</h2>
            <p className="max-w-2xl text-text-secondary">{ar.tokensSection.body}</p>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">{ar.tokensSection.light}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {lightSwatches.map((name) => (
                <Swatch key={name} name={name} value={tokens.light[name] ?? ''} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4" data-theme="dark">
            <h3 className="text-lg font-semibold text-text-primary">{ar.tokensSection.dark}</h3>
            <div className="grid grid-cols-2 gap-4 rounded-card bg-page p-4 sm:grid-cols-3 lg:grid-cols-4">
              {darkSwatches.map((name) => (
                <Swatch key={name} name={name} value={tokens.dark[name] ?? tokens.light[name] ?? ''} />
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section id="typography">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{ar.typographySection.title}</h2>
            <p className="max-w-2xl text-text-secondary">{ar.typographySection.body}</p>
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold">{ar.typographySection.heading1}</h1>
            <h2 className="text-3xl font-bold">{ar.typographySection.heading2}</h2>
            <h3 className="text-2xl font-semibold">{ar.typographySection.heading3}</h3>
            <p className="text-base">{ar.typographySection.bodySample}</p>
            <p className="text-base text-text-secondary">{ar.typographySection.muted}</p>
            <p className="text-base">
              <TextLink href="#components">{ar.typographySection.link}</TextLink>
            </p>
          </div>
          <Card className="flex flex-wrap items-center gap-8">
            <div className="flex flex-col gap-1">
              <Wordmark lang="ar" />
              <span className="text-xs text-text-secondary">Alexandria Bold — AR (مؤقت)</span>
            </div>
            <div className="flex flex-col gap-1">
              <Wordmark lang="en" />
              <span className="text-xs text-text-secondary">Geist Semibold — EN (مؤقت)</span>
            </div>
          </Card>
        </Container>
      </Section>

      <Section id="components">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold sm:text-3xl">{ar.componentsSection.title}</h2>
            <p className="max-w-2xl text-text-secondary">{ar.componentsSection.body}</p>
          </div>
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">{ar.componentsSection.buttons}</h3>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">{ar.componentsSection.primary}</Button>
              <Button variant="secondary">{ar.componentsSection.secondary}</Button>
              <Button variant="primary" disabled>
                {ar.componentsSection.disabled}
              </Button>
              <TextLink href="#join-preview">{ar.componentsSection.link}</TextLink>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="text-lg font-semibold">{ar.componentsSection.cardTitle}</h3>
              <p className="mt-2 text-text-secondary">{ar.componentsSection.cardBody}</p>
            </Card>
            <div className="flex flex-col gap-4">
              <Input
                label={ar.componentsSection.inputLabel}
                name="demo-name"
                placeholder={ar.componentsSection.inputPlaceholder}
              />
              <Textarea
                label={ar.componentsSection.textareaLabel}
                name="demo-message"
                placeholder={ar.componentsSection.textareaPlaceholder}
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section id="join-preview">
        <Container>
          <Card className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">{ar.joinPreview.title}</h2>
            <p role="note" className="text-sm text-text-secondary">
              {ar.joinPreview.note}
            </p>
            <div
              role="group"
              aria-label={ar.joinPreview.title}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Input
                label={ar.joinPreview.name}
                name="name"
                placeholder={ar.joinPreview.name}
                disabled
              />
              <Input
                label={ar.joinPreview.contact}
                name="contact"
                placeholder={ar.joinPreview.contact}
                disabled
              />
              <Textarea
                label={ar.joinPreview.message}
                name="message"
                placeholder={ar.joinPreview.message}
                disabled
                className="sm:col-span-2"
              />
            </div>
            <div>
              <Button variant="primary" disabled>
                {ar.joinPreview.submit}
              </Button>
            </div>
          </Card>
        </Container>
      </Section>
    </>
  );
}
