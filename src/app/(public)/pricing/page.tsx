import type { Metadata } from 'next';
import { CtaBand, PageHero } from '@/components/sections/Hero';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import { pricing } from '@/content/ar/pricing';
import { site } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'الأسعار — نكمّل',
  description: pricing.hero.lead,
  path: '/pricing',
});

export default function PricingPage() {
  return (
    <>
      <PageHero title={pricing.hero.title} lead={pricing.hero.lead} />

      <Section spacing="compact">
        <Container className="grid max-w-5xl gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col rounded-card border border-border-input bg-surface p-6 sm:p-8">
            <h2 className="text-2xl font-bold">{pricing.earlyAccess.title}</h2>
            <p role="note" className="mt-3 leading-relaxed text-text-secondary">
              {pricing.earlyAccess.description}
            </p>
            <ul className="mt-6 flex list-none flex-col divide-y divide-border-subtle p-0">
              {pricing.earlyAccess.points.map((point) => (
                <li key={point} className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0">
                  <span aria-hidden="true" className="mt-1 text-status-info">
                    ●
                  </span>
                  <span className="leading-relaxed text-text-primary">{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button href="/join" size="lg">
                {site.ctaLabel}
              </Button>
            </div>
            <p className="mt-4 text-sm text-text-secondary">
              للاطلاع على اتجاه المنتج: <TextLink href="/features">صفحة الميزات</TextLink>
            </p>
          </div>

          <div className="flex flex-col rounded-card border border-border-subtle bg-page p-6 sm:p-8">
            <h2 className="text-xl font-bold sm:text-2xl">{pricing.transparency.title}</h2>
            <p className="mt-3 leading-relaxed text-text-secondary">{pricing.transparency.body}</p>
            <p className="mt-6 rounded-card border-s-4 border-status-warning bg-surface p-4 text-sm leading-relaxed text-text-secondary">
              {pricing.noPurchase.warning}
            </p>
          </div>
        </Container>
      </Section>

      <CtaBand
        title={pricing.cta.title}
        body={pricing.cta.body}
        primary={pricing.cta.primaryCta}
        secondary={pricing.cta.secondaryCta}
      />
    </>
  );
}
