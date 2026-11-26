import { publicPlansUi } from '@/content/ar/plans';
import { formatPriceMinor, type PublicPlan } from '@/lib/plans/model';
import { Button } from '@/components/ui/Button';

/**
 * Reusable marketing-plan card (W4). Shared by the public pricing page and the
 * owner-only plan preview. Plans are marketing data only; the CTA starts an
 * early-access join request and never a purchase/subscription flow.
 */
export function PlanCard({
  plan,
  preview = false,
  headingLevel = 3,
}: {
  plan: PublicPlan;
  preview?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const monthly = formatPriceMinor(plan.monthlyPriceMinor, plan.currency);
  const yearly = formatPriceMinor(plan.yearlyPriceMinor, plan.currency);
  const hasAnyPrice = monthly !== null || yearly !== null;
  const joinHref = `/join?plan=${encodeURIComponent(plan.slug)}&source=pricing`;

  return (
    <article
      data-testid={`plan-card-${plan.slug}`}
      className={`flex h-full flex-col rounded-card border bg-surface p-6 ${
        plan.featured
          ? 'border-action-secondary ring-2 ring-action-secondary'
          : 'border-border-subtle'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading className="text-xl font-bold text-text-primary">{plan.name}</Heading>
        {plan.featured ? (
          <span className="rounded-control border border-border-subtle bg-background px-3 py-1 text-xs font-semibold text-action-secondary">
            {publicPlansUi.featured}
          </span>
        ) : null}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
        {plan.description}
      </p>

      <div className="mt-5 rounded-card bg-background p-4">
        {hasAnyPrice ? (
          <dl className="flex flex-col gap-2 text-sm">
            {monthly !== null ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="font-semibold text-text-secondary">{publicPlansUi.monthly}</dt>
                <dd className="text-lg font-bold text-text-primary" dir="ltr">
                  {monthly}
                </dd>
              </div>
            ) : null}
            {yearly !== null ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="font-semibold text-text-secondary">{publicPlansUi.yearly}</dt>
                <dd className="text-lg font-bold text-text-primary" dir="ltr">
                  {yearly}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm font-semibold text-text-secondary">
            <span className="text-text-primary">{publicPlansUi.monthly}: </span>
            {publicPlansUi.priceLater}
          </p>
        )}
        <p className="mt-2 text-xs leading-5 text-text-secondary">{publicPlansUi.marketingNote}</p>
      </div>

      {plan.features.length > 0 ? (
        <ul className="mt-5 flex list-none flex-col gap-2 p-0 text-sm">
          {plan.features.map((feature, index) => (
            <li key={`${index}-${feature}`} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-0.5 text-action-secondary">
                ✓
              </span>
              <span className="whitespace-pre-wrap break-words leading-6 text-text-primary">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto pt-6">
        {preview ? (
          <Button disabled size="lg" className="w-full">
            {plan.ctaLabel}
          </Button>
        ) : (
          <Button href={joinHref} size="lg" className="w-full">
            {plan.ctaLabel}
          </Button>
        )}
        {preview ? (
          <p className="mt-2 text-xs text-text-secondary">{publicPlansUi.previewCtaNote}</p>
        ) : null}
      </div>
    </article>
  );
}
