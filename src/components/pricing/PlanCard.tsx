import { publicPlansUi } from '@/content/ar/plans';
import { formatPriceMinor, type PublicPlan } from '@/lib/plans/model';
import {
  PROMOTION_TIMEZONE_LABEL,
  formatCairoDateTime,
  formatSavedPercent,
  type PeriodOffer,
} from '@/lib/plans/promotion';
import { Button } from '@/components/ui/Button';

/**
 * Reusable marketing-plan card (W4/W4.1). Shared by the public pricing page
 * and the owner-only plan preview. Plans are marketing data only; the CTA
 * starts an early-access join request and never a purchase/subscription flow.
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
  const { offer } = plan;
  const hasAnyPrice =
    offer.monthly.baseMinor !== null || offer.yearly.baseMinor !== null;
  const joinHref = `/join?plan=${encodeURIComponent(plan.slug)}&source=pricing`;
  const hasActivePromotion = offer.monthly.discounted || offer.yearly.discounted;
  const endsAt = formatCairoDateTime(offer.endsAt);

  return (
    <article
      data-testid={`plan-card-${plan.slug}`}
      className={`flex h-full flex-col rounded-card border bg-surface p-5 sm:p-6 ${
        plan.featured
          ? 'border-action-secondary ring-1 ring-action-secondary'
          : 'border-border-subtle'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading className="text-xl font-bold text-text-primary">{plan.name}</Heading>
        {plan.featured ? (
          <span className="rounded-control border border-border-subtle bg-page px-3 py-1 text-xs font-semibold text-action-secondary">
            {publicPlansUi.featured}
          </span>
        ) : null}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
        {plan.description}
      </p>

      {hasActivePromotion && offer.label && endsAt ? (
        <div
          data-testid={`plan-promotion-${plan.slug}`}
          className="mt-4 rounded-card border-s-4 border-status-info bg-page p-3 text-sm"
        >
          <p className="font-semibold text-text-primary">
            {publicPlansUi.promotionLabel} «{offer.label}»
          </p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {publicPlansUi.promotionEnds}:{' '}
            <time dateTime={offer.endsAt ?? undefined} dir="ltr">
              {endsAt}
            </time>{' '}
            {PROMOTION_TIMEZONE_LABEL}
          </p>
        </div>
      ) : null}

      <div className="mt-5 rounded-card bg-page p-4">
        {hasAnyPrice ? (
          <dl className="flex flex-col gap-3 text-sm">
            {offer.monthly.baseMinor !== null ? (
              <PriceRow
                label={publicPlansUi.monthly}
                period={offer.monthly}
                currency={plan.currency}
              />
            ) : null}
            {offer.yearly.baseMinor !== null ? (
              <PriceRow
                label={publicPlansUi.yearly}
                period={offer.yearly}
                currency={plan.currency}
              />
            ) : null}
          </dl>
        ) : (
          <p className="text-sm font-semibold text-text-secondary">
            <span className="text-text-primary">{publicPlansUi.monthly}: </span>
            {publicPlansUi.priceLater}
          </p>
        )}
        <p className="mt-2 text-xs leading-5 text-text-secondary">{publicPlansUi.marketingNote}</p>
        {hasActivePromotion ? (
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {publicPlansUi.promotionActiveNote}
          </p>
        ) : null}
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

function PriceRow({
  label,
  period,
  currency,
}: {
  label: string;
  period: PeriodOffer;
  currency: PublicPlan['currency'];
}) {
  const base = formatPriceMinor(period.baseMinor, currency);
  const effective = formatPriceMinor(period.effectiveMinor, currency);
  const saved = formatPriceMinor(period.savedMinor, currency);
  const savedPercent = formatSavedPercent(period.savedPercentBps);

  if (!period.discounted || !base || !effective) {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="font-semibold text-text-secondary">{label}</dt>
        <dd className="text-lg font-bold text-text-primary" dir="ltr">
          {effective ?? base}
        </dd>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <dt className="font-semibold text-text-secondary">{label}</dt>
        <dd className="flex flex-wrap items-baseline gap-2">
          <s
            className="text-sm text-text-secondary line-through"
            aria-label={`${publicPlansUi.originalPriceLabel}: ${base}`}
            dir="ltr"
          >
            {base}
          </s>
          <span className="text-lg font-bold text-text-primary" dir="ltr">
            {effective}
          </span>
        </dd>
      </div>
      {saved ? (
        <p className="text-xs leading-5 text-text-secondary">
          {publicPlansUi.savingsLabel}:{' '}
          <span className="font-semibold text-text-primary" dir="ltr">
            {saved}
          </span>
          {savedPercent ? <span dir="ltr"> ({savedPercent})</span> : null}
        </p>
      ) : null}
    </div>
  );
}
