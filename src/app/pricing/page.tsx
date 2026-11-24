import type { Metadata } from 'next';
import { CtaBand, PageHero } from '@/components/sections/Hero';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
        <Container className="flex flex-col gap-6">
          <div className="max-w-2xl">
            <Card className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold">{pricing.earlyAccess.title}</h2>
              <p role="note" className="leading-relaxed text-text-secondary">
                {pricing.earlyAccess.description}
              </p>
              <ul className="flex list-none flex-col gap-3 p-0">
                {pricing.earlyAccess.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm leading-relaxed">
                    <span aria-hidden="true" className="mt-1 text-status-info">
                      ●
                    </span>
                    <span className="text-text-primary">{point}</span>
                  </li>
                ))}
              </ul>
              <div>
                <Button href="/join" size="lg">
                  {site.ctaLabel}
                </Button>
              </div>
              <p className="text-sm text-text-secondary">
                للاطلاع على اتجاه المنتج: <TextLink href="/features">صفحة الميزات</TextLink>
              </p>
            </Card>
          </div>
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 className="text-xl font-bold sm:text-2xl">{pricing.transparency.title}</h2>
            <p className="leading-relaxed text-text-secondary">{pricing.transparency.body}</p>
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
