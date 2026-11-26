import type { Metadata } from 'next';
import Link from 'next/link';
import { adminRequestsUi } from '@/content/ar/admin-requests';
import { getJoinRequest } from '@/lib/join/service';
import { requireOwner } from '@/lib/owner';
import { formatPriceMinor, type SupportedCurrencyCode } from '@/lib/plans/model';
import {
  PROMOTION_TIMEZONE_LABEL,
  formatCairoDateTime,
  formatSavedPercent,
} from '@/lib/plans/promotion';
import { pageMetadata } from '@/lib/seo';
import { NotificationStatusPanel } from './NotificationStatusPanel';
import { RequestActions } from './RequestActions';

export const metadata: Metadata = pageMetadata({
  title: adminRequestsUi.sectionTitle,
  description: adminRequestsUi.sectionDescription,
  path: '/admin/requests',
});

export const dynamic = 'force-dynamic';

function statusLabel(status: 'new' | 'contacted' | 'closed'): string {
  if (status === 'contacted') return adminRequestsUi.statusContacted;
  if (status === 'closed') return adminRequestsUi.statusClosed;
  return adminRequestsUi.statusNew;
}

function sourceLabel(source: 'direct' | 'pricing' | 'join'): string {
  if (source === 'pricing') return adminRequestsUi.sourcePricing;
  if (source === 'join') return adminRequestsUi.sourceJoin;
  return adminRequestsUi.sourceDirect;
}

function formatTimestamp(value: string): string {
  return `${value.slice(0, 16).replace('T', ' ')} UTC`;
}

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const result = await getJoinRequest(id);

  if (result.status !== 'ok') {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/admin/requests" className="text-sm font-semibold text-action-secondary underline-offset-4 hover:underline">
          {adminRequestsUi.backToList}
        </Link>
        <div role="alert" className="mt-4 rounded-card border-s-4 border-status-warning bg-surface p-4">
          <h1 className="text-lg font-bold text-text-primary">{adminRequestsUi.sectionTitle}</h1>
          <p className="mt-2 text-sm leading-7 text-text-secondary">{result.message}</p>
        </div>
      </div>
    );
  }

  const request = result.request;
  const snapshot = request.offerSnapshot;
  const hasFullSnapshot = snapshot !== null;
  const planName = snapshot?.planName ?? request.planNameSnapshot;
  const hasPlanSnapshot = planName !== null;
  const price =
    !hasFullSnapshot && hasPlanSnapshot && request.planCurrencySnapshot
      ? formatPriceMinor(request.planPriceMinorSnapshot, request.planCurrencySnapshot)
      : null;
  const pricePeriod =
    request.planPricePeriodSnapshot === 'monthly'
      ? adminRequestsUi.priceMonthly
      : request.planPricePeriodSnapshot === 'yearly'
        ? adminRequestsUi.priceYearly
        : null;
  const priceLabel =
    request.planPricePeriodSnapshot === 'monthly'
      ? adminRequestsUi.priceMonthlySnapshot
      : request.planPricePeriodSnapshot === 'yearly'
        ? adminRequestsUi.priceYearlySnapshot
        : adminRequestsUi.priceSnapshot;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/admin/requests" className="text-sm font-semibold text-action-secondary underline-offset-4 hover:underline">
        {adminRequestsUi.backToList}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{request.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {adminRequestsUi.submittedAt}: <span dir="ltr">{formatTimestamp(request.createdAt)}</span>
            {' · '}
            {adminRequestsUi.updatedAt}: <span dir="ltr">{formatTimestamp(request.updatedAt)}</span>
          </p>
        </div>
        <span className="rounded-control border border-border-subtle bg-surface px-3 py-1 text-sm font-semibold text-text-primary">
          {statusLabel(request.status)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="request-contact-title" className="rounded-card border border-border-subtle bg-surface p-4">
          <h2 id="request-contact-title" className="text-base font-bold text-text-primary">
            {adminRequestsUi.contactDetails}
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div>
              <dt className="font-semibold text-text-secondary">الاسم</dt>
              <dd className="text-text-primary">{request.name}</dd>
            </div>
            <div>
              <dt className="font-semibold text-text-secondary">الهاتف</dt>
              <dd className="text-text-primary" dir="ltr">
                {request.phone}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-text-secondary">البريد الإلكتروني</dt>
              <dd className="break-all text-text-primary" dir="ltr">
                {request.email ?? adminRequestsUi.notProvided}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-text-secondary">{adminRequestsUi.businessActivity}</dt>
              <dd className="whitespace-pre-wrap break-words text-text-primary">
                {request.businessActivity ?? adminRequestsUi.noBusinessActivity}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="request-offer-title" className="rounded-card border border-border-subtle bg-surface p-4 sm:col-span-2">
          <h2 id="request-offer-title" className="text-base font-bold text-text-primary">
            {adminRequestsUi.offerSnapshot}
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div>
              <dt className="font-semibold text-text-secondary">{adminRequestsUi.plan}</dt>
              <dd className="text-text-primary">{planName ?? adminRequestsUi.noPlan}</dd>
            </div>

            {hasFullSnapshot && snapshot ? (
              <>
                <p className="mt-1 font-semibold text-text-primary">
                  {adminRequestsUi.historicalOfferTitle}
                </p>
                {(snapshot.promotion?.monthlySavedMinor ?? 0) > 0 ? (
                  <>
                    <HistoricalPriceRow
                      label={adminRequestsUi.historicalOriginalMonthly}
                      minor={snapshot.baseMonthlyPriceMinor}
                      currency={snapshot.currency}
                    />
                    <HistoricalPriceRow
                      label={adminRequestsUi.historicalEffectiveMonthly}
                      minor={snapshot.effectiveMonthlyPriceMinor}
                      currency={snapshot.currency}
                    />
                  </>
                ) : (
                  <HistoricalPriceRow
                    label={adminRequestsUi.priceMonthlySnapshot}
                    minor={snapshot.effectiveMonthlyPriceMinor}
                    currency={snapshot.currency}
                  />
                )}
                {(snapshot.promotion?.yearlySavedMinor ?? 0) > 0 ? (
                  <>
                    <HistoricalPriceRow
                      label={adminRequestsUi.historicalOriginalYearly}
                      minor={snapshot.baseYearlyPriceMinor}
                      currency={snapshot.currency}
                    />
                    <HistoricalPriceRow
                      label={adminRequestsUi.historicalEffectiveYearly}
                      minor={snapshot.effectiveYearlyPriceMinor}
                      currency={snapshot.currency}
                    />
                  </>
                ) : (
                  <HistoricalPriceRow
                    label={adminRequestsUi.priceYearlySnapshot}
                    minor={snapshot.effectiveYearlyPriceMinor}
                    currency={snapshot.currency}
                  />
                )}
                {snapshot.promotion ? (
                  <div className="mt-2 rounded-card bg-background p-3 text-sm">
                    <p className="font-semibold text-text-primary">
                      {adminRequestsUi.historicalPromotion}
                    </p>
                    <p className="mt-1 text-text-primary">
                      {adminRequestsUi.historicalPromotionLabel}:{' '}
                      {snapshot.promotion.label}
                    </p>
                    <p className="mt-1 text-text-secondary">
                      {adminRequestsUi.historicalPromotionType}:{' '}
                      {
                        adminRequestsUi.historicalPromotionTypes[
                          snapshot.promotion.discountType
                        ]
                      }{' '}
                      · {adminRequestsUi.historicalPromotionTarget}:{' '}
                      {
                        adminRequestsUi.historicalPromotionTargets[
                          snapshot.promotion.target
                        ]
                      }
                    </p>
                    <p className="mt-1 text-text-secondary">
                      {adminRequestsUi.historicalPromotionPeriod}:{' '}
                      <span dir="ltr">
                        {formatCairoDateTime(snapshot.promotion.startsAt)}
                      </span>{' '}
                      —{' '}
                      <span dir="ltr">
                        {formatCairoDateTime(snapshot.promotion.endsAt)}
                      </span>{' '}
                      {PROMOTION_TIMEZONE_LABEL}
                    </p>
                    {snapshot.promotion.monthlySavedMinor !== null ? (
                      <p className="mt-1 text-text-secondary">
                        {adminRequestsUi.historicalSavings} (
                        {adminRequestsUi.historicalEffectiveMonthly}):{' '}
                        <span dir="ltr">
                          {formatPriceMinor(
                            snapshot.promotion.monthlySavedMinor,
                            snapshot.currency,
                          )}
                          {snapshot.promotion.monthlySavedPercentBps !== null
                            ? ` (${formatSavedPercent(
                                snapshot.promotion.monthlySavedPercentBps,
                              )})`
                            : ''}
                        </span>
                      </p>
                    ) : null}
                    {snapshot.promotion.yearlySavedMinor !== null ? (
                      <p className="mt-1 text-text-secondary">
                        {adminRequestsUi.historicalSavings} (
                        {adminRequestsUi.historicalEffectiveYearly}):{' '}
                        <span dir="ltr">
                          {formatPriceMinor(
                            snapshot.promotion.yearlySavedMinor,
                            snapshot.currency,
                          )}
                          {snapshot.promotion.yearlySavedPercentBps !== null
                            ? ` (${formatSavedPercent(
                                snapshot.promotion.yearlySavedPercentBps,
                              )})`
                            : ''}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-text-secondary">
                    {adminRequestsUi.historicalNoPromotion}
                  </p>
                )}
                <p className="text-xs leading-5 text-text-secondary">
                  {adminRequestsUi.historicalCapturedAt}:{' '}
                  <span dir="ltr">{formatCairoDateTime(snapshot.capturedAt)}</span>{' '}
                  {PROMOTION_TIMEZONE_LABEL}
                </p>
                <p className="break-all text-xs leading-5 text-text-secondary" dir="ltr">
                  {adminRequestsUi.historicalVersion}: {snapshot.effectiveOfferVersion}
                </p>
              </>
            ) : (
              <div>
                <dt className="font-semibold text-text-secondary">
                  {hasPlanSnapshot ? priceLabel : adminRequestsUi.priceSnapshot}
                </dt>
                <dd className="text-text-primary" dir={price ? 'ltr' : undefined}>
                  {!hasPlanSnapshot
                    ? adminRequestsUi.priceNotApplicable
                    : price
                      ? `${price}${pricePeriod ? ` · ${pricePeriod}` : ''}`
                      : adminRequestsUi.priceNotAnnounced}
                </dd>
              </div>
            )}

            <div>
              <dt className="font-semibold text-text-secondary">{adminRequestsUi.source}</dt>
              <dd className="text-text-primary">{sourceLabel(request.source)}</dd>
            </div>
          </dl>
          {request.offerSnapshotInvalid ? (
            <p className="mt-3 rounded-card border-s-4 border-status-warning bg-background p-3 text-xs leading-5 text-text-primary">
              {adminRequestsUi.historicalSnapshotInvalid}
            </p>
          ) : null}
          {hasFullSnapshot ? (
            <p className="mt-3 text-xs leading-5 text-text-secondary">
              {adminRequestsUi.historicalOfferNote}
            </p>
          ) : hasPlanSnapshot ? (
            <p className="mt-3 text-xs leading-5 text-text-secondary">
              {adminRequestsUi.legacyOfferSnapshotNote}
            </p>
          ) : (
            <p className="mt-3 text-xs leading-5 text-text-secondary">
              {adminRequestsUi.noPlanSnapshotNote}
            </p>
          )}
        </section>
      </div>

      {request.utmSource || request.utmMedium || request.utmCampaign ? (
        <section aria-labelledby="request-acquisition-title" className="mt-4 rounded-card border border-border-subtle bg-surface p-4">
          <h2 id="request-acquisition-title" className="text-base font-bold text-text-primary">
            {adminRequestsUi.acquisition}
          </h2>
          <dl className="mt-3 flex flex-col gap-1 text-sm" dir="ltr">
            <div className="flex flex-wrap gap-2">
              <dt className="font-semibold text-text-secondary">{adminRequestsUi.utmSource}:</dt>
              <dd className="break-all text-text-primary">{request.utmSource ?? adminRequestsUi.notProvided}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="font-semibold text-text-secondary">{adminRequestsUi.utmMedium}:</dt>
              <dd className="break-all text-text-primary">{request.utmMedium ?? adminRequestsUi.notProvided}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="font-semibold text-text-secondary">{adminRequestsUi.utmCampaign}:</dt>
              <dd className="break-all text-text-primary">{request.utmCampaign ?? adminRequestsUi.notProvided}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <NotificationStatusPanel id={request.id} notification={request.notification} />

      <div className="mt-5">
        <RequestActions
          id={request.id}
          initialRevision={request.revision}
          initialStatus={request.status}
          initialNotes={request.notes}
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-text-secondary">{adminRequestsUi.privacyNote}</p>
    </div>
  );
}

function HistoricalPriceRow({
  label,
  minor,
  currency,
}: {
  label: string;
  minor: number | null;
  currency: SupportedCurrencyCode;
}) {
  if (minor === null) return null;
  const formatted = formatPriceMinor(minor, currency);
  return (
    <div>
      <dt className="font-semibold text-text-secondary">{label}</dt>
      <dd className="text-text-primary" dir="ltr">
        {formatted}
      </dd>
    </div>
  );
}
