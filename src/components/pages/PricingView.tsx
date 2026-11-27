import { CtaBand, PageHero } from '@/components/sections/Hero';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { TextLink } from '@/components/ui/TextLink';
import { publicPlansUi } from '@/content/ar/plans';
import type { PricingContent } from '@/content/ar/pricing';
import type { PublicPlan } from '@/lib/plans/model';
import { site } from '@/lib/site';
import { PlanCard } from '@/components/pricing/PlanCard';

export function PricingView({
  content,
  plans = [],
}: {
  content: PricingContent;
  plans?: PublicPlan[];
}) {
  return (
    <>
      <PageHero title={content.hero.title} lead={content.hero.lead} />

      {plans.length > 0 ? (
        <Section spacing="compact" aria-labelledby="published-plans-title">
          <Container>
            <div className="flex max-w-3xl flex-col gap-2">
              <h2 id="published-plans-title" className="text-2xl font-bold sm:text-3xl">
                {publicPlansUi.sectionTitle}
              </h2>
              <p className="leading-relaxed text-text-secondary">
                {publicPlansUi.sectionLead}
              </p>
            </div>
            <div
              className={`mt-8 grid items-stretch gap-5 ${
                plans.length === 1
                  ? 'mx-auto max-w-md'
                  : plans.length === 2
                    ? 'mx-auto max-w-3xl sm:grid-cols-2'
                    : 'sm:grid-cols-2 lg:grid-cols-3'
              }`}
              data-testid="published-plans"
            >
              {plans.map((plan) => (
                <PlanCard key={plan.slug} plan={plan} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <Section spacing="compact" className={plans.length > 0 ? 'border-t border-border-subtle' : ''}>
        <Container className="grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="flex flex-col rounded-card bg-surface p-6 sm:p-8">
            <h2 className="text-2xl font-bold">{content.earlyAccess.title}</h2>
            <p role="note" className="mt-3 leading-relaxed text-text-secondary">
              {content.earlyAccess.description}
            </p>
            <ul className="mt-6 flex list-none flex-col divide-y divide-border-subtle p-0">
              {content.earlyAccess.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <span aria-hidden="true" className="mt-1 text-action-secondary">
                    ✓
                  </span>
                  <span className="leading-relaxed text-text-primary">{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button href="/join" size="lg">
                {site.ctaLabel}
              </Button>
              <TextLink href="/features">الميزات</TextLink>
            </div>
            <p className="mt-4 text-sm text-text-secondary">
              لا يوجد دفع أو اشتراك في هذه المرحلة.
            </p>
          </div>

          <div className="flex flex-col gap-4 lg:pt-2">
            <span aria-hidden="true" className="h-0.5 w-10 bg-action-secondary" />
            <h2 className="text-xl font-bold sm:text-2xl">{content.transparency.title}</h2>
            <p className="leading-relaxed text-text-secondary">{content.transparency.body}</p>
            <p className="rounded-card border-s-4 border-status-warning bg-surface p-4 text-sm leading-relaxed text-text-secondary">
              {plans.length > 0
                ? publicPlansUi.noPurchaseWithPlans
                : content.noPurchase.warning}
            </p>
          </div>
        </Container>
      </Section>

      <CtaBand
        title={content.cta.title}
        body={content.cta.body}
        primary={content.cta.primaryCta}
        secondary={content.cta.secondaryCta}
      />
    </>
  );
}
