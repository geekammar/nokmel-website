import type { Metadata } from 'next';
import Link from 'next/link';
import { PlanCard } from '@/components/pricing/PlanCard';
import { adminPlansUi } from '@/content/ar/admin-plans';
import { requireOwner } from '@/lib/owner';
import { planDraftToPublic, type OwnerPlan } from '@/lib/plans/model';
import {
  PROMOTION_TIMEZONE_LABEL,
  formatCairoDateTime,
} from '@/lib/plans/promotion';
import { getOwnerPlan } from '@/lib/plans/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: adminPlansUi.previewPage.title,
  description: adminPlansUi.previewPage.bannerBody,
  path: '/admin/plans',
});

export const dynamic = 'force-dynamic';

export default async function AdminPlanPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const result = await getOwnerPlan(id);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        role="note"
        data-testid="plan-preview-banner"
        className="rounded-card border-s-4 border-status-warning bg-surface p-4"
      >
        <h1 className="text-lg font-bold text-text-primary">
          {adminPlansUi.previewPage.bannerTitle}
        </h1>
        <p className="mt-1 text-sm leading-7 text-text-secondary">
          {adminPlansUi.previewPage.bannerBody}
        </p>
        <Link
          href={result.status === 'ok' ? `/admin/plans/${result.plan.id}` : '/admin/plans'}
          className="mt-3 inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background"
        >
          {adminPlansUi.previewPage.backToEditor}
        </Link>
      </div>

      {result.status === 'ok' ? (
        <PreviewContent plan={result.plan} />
      ) : (
        <div className="mt-4" role="alert">
          <div className="rounded-card border border-border-subtle bg-surface p-6">
            <p className="text-sm text-text-secondary">
              {adminPlansUi.previewPage.storageError}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewContent({ plan }: { plan: OwnerPlan }) {
  const asOf = new Date();
  const draftPlan = planDraftToPublic(plan, asOf);
  const offer = draftPlan.offer;
  const start = formatCairoDateTime(offer.startsAt);
  const end = formatCairoDateTime(offer.endsAt);
  const canSimulate = offer.state === 'scheduled';
  const simulatedPlan = canSimulate
    ? planDraftToPublic(plan, new Date(offer.startsAt ?? asOf.toISOString()))
    : null;

  return (
    <>
      <section
        data-testid="plan-preview-promotion-status"
        className="mt-4 rounded-card border border-border-subtle bg-surface p-4"
      >
        <h2 className="text-base font-bold text-text-primary">
          {adminPlansUi.previewPromotion.statusTitle}
        </h2>
        <p className="mt-2 text-sm font-semibold text-text-primary">
          {adminPlansUi.promotion.draftStatus}:{' '}
          {adminPlansUi.promotion.stateLabels[offer.state]}
        </p>
        {offer.label ? (
          <p className="mt-1 text-sm text-text-primary">
            {adminPlansUi.promotion.label}: {offer.label}
          </p>
        ) : null}
        {offer.target ? (
          <p className="mt-1 text-sm text-text-secondary">
            {adminPlansUi.promotion.target}:{' '}
            {adminPlansUi.promotion.targetLabels[offer.target]}
          </p>
        ) : null}
        {start && end ? (
          <p className="mt-1 text-sm text-text-secondary">
            {adminPlansUi.previewPromotion.schedule}:{' '}
            <span dir="ltr">{start}</span> — <span dir="ltr">{end}</span>{' '}
            {PROMOTION_TIMEZONE_LABEL}
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-5 text-text-secondary">
          {adminPlansUi.promotion.currentTimeNote}
        </p>
      </section>

      <h2 className="mt-6 text-lg font-bold text-text-primary">
        {adminPlansUi.previewPromotion.currentPresentation}
      </h2>
      <div className="mt-3">
        <PlanCard plan={draftPlan} preview />
      </div>

      {simulatedPlan ? (
        <section data-testid="plan-preview-promotion-simulation" className="mt-6">
          <h2 className="text-lg font-bold text-text-primary">
            {adminPlansUi.previewPromotion.simulationTitle}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {adminPlansUi.previewPromotion.simulationNote}
          </p>
          <div className="mt-3">
            <PlanCard plan={simulatedPlan} preview />
          </div>
        </section>
      ) : offer.state === 'expired' ? (
        <p className="mt-4 text-sm text-text-secondary">
          {adminPlansUi.previewPromotion.noSimulationExpired}
        </p>
      ) : offer.state === 'disabled' ? (
        <p className="mt-4 text-sm text-text-secondary">
          {adminPlansUi.previewPromotion.noSimulationDisabled}
        </p>
      ) : null}

      <p className="mt-6 break-all text-xs text-text-secondary" dir="ltr">
        {adminPlansUi.previewPromotion.effectiveVersion}: {offer.version}
      </p>
    </>
  );
}