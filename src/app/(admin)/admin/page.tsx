import type { Metadata } from 'next';
import Link from 'next/link';
import { adminOverviewUi, } from '@/content/ar/admin-overview';
import {
  cairoReportingRange,
  parseOverviewPeriod,
  OVERVIEW_PERIODS,
  REPORTING_TIMEZONE_LABEL,
  type OverviewPeriod,
} from '@/lib/overview/cairo';
import {
  loadOverviewMetrics,
  type OverviewMetrics,
  type OverviewResult,
} from '@/lib/overview/service';
import {
  loadDashboardAnalytics,
  type DashboardAnalyticsState,
} from '@/lib/analytics/service';
import { formatCairoDateTime } from '@/lib/plans/promotion';
import { pageMetadata } from '@/lib/seo';
import { requireOwner } from '@/lib/owner';

export const metadata: Metadata = pageMetadata({
  title: adminOverviewUi.title,
  description: adminOverviewUi.description,
  path: '/admin',
});

export const dynamic = 'force-dynamic';

const cardClass = 'rounded-card border border-border-subtle bg-surface p-4';
const sectionTitleClass = 'text-lg font-bold text-text-primary';

function SourceLabel({ source }: { source: 'direct' | 'pricing' | 'join' }) {
  return (
    <span>
      {source === 'pricing'
        ? adminOverviewUi.sources.pricing
        : source === 'join'
          ? adminOverviewUi.sources.join
          : adminOverviewUi.sources.direct}
    </span>
  );
}

function StatusLabel({ status }: { status: 'new' | 'contacted' | 'closed' }) {
  return <span>{adminOverviewUi.status[status]}</span>;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function KpiCard({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: number;
  hint: string;
  testId?: string;
}) {
  return (
    <div className={cardClass} data-testid={testId}>
      <p className="text-sm font-semibold text-text-secondary">{label}</p>
      <p className="mt-1 text-3xl font-bold text-text-primary" dir="ltr">
        {formatCount(value)}
      </p>
      <p className="mt-2 text-xs leading-5 text-text-secondary">{hint}</p>
    </div>
  );
}

function BarList({
  rows,
  empty,
}: {
  rows: Array<{ label: string; count: number }>;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-secondary">{empty}</p>;
  }
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="flex list-none flex-col gap-3 p-0">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words text-text-primary">{row.label}</span>
            <span className="shrink-0 font-semibold text-text-primary" dir="ltr">
              {formatCount(row.count)}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-background" aria-hidden="true">
            <div
              className="h-full rounded-full bg-action-secondary"
              style={{ width: `${Math.round((row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DailySeries({ metrics }: { metrics: OverviewMetrics }) {
  const max = Math.max(1, ...metrics.daily.map((day) => day.count));
  return (
    <div>
      <div
        role="img"
        aria-label={`${adminOverviewUi.daily.chartLabel}: ${metrics.startDate} — ${metrics.endDate}`}
        className="flex h-28 items-end gap-px rounded-control bg-background p-2"
        dir="ltr"
      >
        {metrics.daily.map((day) => (
          <div
            key={day.date}
            className="min-w-0 flex-1 rounded-t-sm bg-action-secondary"
            style={{ height: `${Math.max(day.count === 0 ? 0 : 4, Math.round((day.count / max) * 100))}%` }}
            title={`${day.date}: ${day.count}`}
          />
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-action-secondary">
          {adminOverviewUi.daily.tableSummary}
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{adminOverviewUi.daily.title}</caption>
            <thead>
              <tr className="text-start">
                <th scope="col" className="border-b border-border-subtle p-2 text-start">
                  {adminOverviewUi.daily.date}
                </th>
                <th scope="col" className="border-b border-border-subtle p-2 text-start">
                  {adminOverviewUi.daily.count}
                </th>
              </tr>
            </thead>
            <tbody>
              {metrics.daily.map((day) => (
                <tr key={day.date}>
                  <td className="border-b border-border-subtle p-2" dir="ltr">
                    {day.date}
                  </td>
                  <td className="border-b border-border-subtle p-2" dir="ltr">
                    {day.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function OverviewContent({ metrics }: { metrics: OverviewMetrics }) {
  const hasPeriodRequests = metrics.receivedInPeriod > 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={adminOverviewUi.kpi.received}
          value={metrics.receivedInPeriod}
          hint={adminOverviewUi.kpi.receivedHint}
          testId="overview-received"
        />
        <div
          className="rounded-card border-2 border-action-secondary bg-surface p-4"
          data-testid="overview-backlog"
        >
          <p className="text-sm font-semibold text-text-secondary">
            {adminOverviewUi.kpi.backlog}
          </p>
          <p className="mt-1 text-3xl font-bold text-text-primary" dir="ltr">
            {formatCount(metrics.currentNewBacklog)}
          </p>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            {adminOverviewUi.kpi.backlogHint}
          </p>
        </div>
        <KpiCard
          label={adminOverviewUi.kpi.contacted}
          value={metrics.periodStatus.contacted}
          hint={adminOverviewUi.kpi.contactedHint}
          testId="overview-contacted"
        />
        <KpiCard
          label={adminOverviewUi.kpi.closed}
          value={metrics.periodStatus.closed}
          hint={adminOverviewUi.kpi.closedHint}
          testId="overview-closed"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={cardClass}>
          <p className="text-sm font-semibold text-text-secondary">
            {adminOverviewUi.kpi.utm}
            <span className="ms-2 text-text-primary" dir="ltr">
              {formatCount(metrics.periodWithUtm)}
            </span>
          </p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {adminOverviewUi.kpi.utmHint}
          </p>
        </div>
        <div className={cardClass} data-testid="overview-no-plan">
          <p className="text-sm font-semibold text-text-secondary">
            {adminOverviewUi.kpi.noPlan}
            <span className="ms-2 text-text-primary" dir="ltr">
              {formatCount(metrics.periodNoPlan)}
            </span>
          </p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {adminOverviewUi.kpi.noPlanHint}
          </p>
        </div>
      </div>

      {!hasPeriodRequests ? (
        <div role="note" className="rounded-card border-s-4 border-status-info bg-surface p-4">
          <h2 className="text-base font-bold text-text-primary">
            {adminOverviewUi.zero.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {adminOverviewUi.zero.body}
          </p>
        </div>
      ) : null}

      <section className={cardClass} aria-labelledby="overview-daily-title">
        <h2 id="overview-daily-title" className={sectionTitleClass}>
          {adminOverviewUi.daily.title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {adminOverviewUi.daily.description}
        </p>
        <div className="mt-3">
          <DailySeries metrics={metrics} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardClass} aria-labelledby="overview-sources-title">
          <h2 id="overview-sources-title" className={sectionTitleClass}>
            {adminOverviewUi.sources.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {adminOverviewUi.sources.description}
          </p>
          <div className="mt-3">
            <BarList
              empty={adminOverviewUi.sources.empty}
              rows={metrics.sources.map((row) => ({
                label:
                  row.source === 'pricing'
                    ? adminOverviewUi.sources.pricing
                    : row.source === 'join'
                      ? adminOverviewUi.sources.join
                      : adminOverviewUi.sources.direct,
                count: row.count,
              }))}
            />
          </div>
        </section>

        <section className={cardClass} aria-labelledby="overview-plans-title">
          <h2 id="overview-plans-title" className={sectionTitleClass}>
            {adminOverviewUi.plans.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {adminOverviewUi.plans.description}
          </p>
          <div className="mt-3">
            <BarList
              empty={adminOverviewUi.plans.empty}
              rows={metrics.plans.map((row) => ({
                label: row.planName ?? adminOverviewUi.plans.noPlan,
                count: row.count,
              }))}
            />
          </div>
        </section>

        <section className={cardClass} aria-labelledby="overview-promotions-title">
          <h2 id="overview-promotions-title" className={sectionTitleClass}>
            {adminOverviewUi.promotions.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {adminOverviewUi.promotions.description}
          </p>
          <div className="mt-3">
            <BarList
              empty={adminOverviewUi.promotions.empty}
              rows={[
                { label: adminOverviewUi.promotions.active, count: metrics.promotions.active },
                { label: adminOverviewUi.promotions.noActive, count: metrics.promotions.noActive },
                {
                  label: adminOverviewUi.promotions.legacyUnknown,
                  count: metrics.promotions.legacyUnknown,
                },
                { label: adminOverviewUi.promotions.unknown, count: metrics.promotions.unknown },
                { label: adminOverviewUi.promotions.noPlan, count: metrics.promotions.noPlan },
              ].filter((row) => row.count > 0)}
            />
          </div>
        </section>

        <section className={cardClass} aria-labelledby="overview-latest-title">
          <h2 id="overview-latest-title" className={sectionTitleClass}>
            {adminOverviewUi.latest.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            {adminOverviewUi.latest.description}
          </p>
          {metrics.latest.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">{adminOverviewUi.latest.empty}</p>
          ) : (
            <ul className="mt-3 flex list-none flex-col gap-3 p-0" data-testid="overview-latest">
              {metrics.latest.map((request) => (
                <li
                  key={request.id}
                  className="rounded-control border border-border-subtle p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-semibold text-text-primary">
                      {request.name}
                    </p>
                    <Link
                      href={`/admin/requests/${request.id}`}
                      className="text-xs font-semibold text-action-secondary underline-offset-4 hover:underline"
                    >
                      {adminOverviewUi.latest.open}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    {adminOverviewUi.latest.status}: <StatusLabel status={request.status} />
                    {' · '}
                    {adminOverviewUi.latest.source}: <SourceLabel source={request.source} />
                    {' · '}
                    {adminOverviewUi.latest.plan}:{' '}
                    {request.planName ?? adminOverviewUi.latest.noPlan}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary" dir="ltr">
                    {formatCairoDateTime(request.createdAt)} {REPORTING_TIMEZONE_LABEL}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function AnalyticsSection({
  analytics,
  receivedInPeriod,
}: {
  analytics: DashboardAnalyticsState;
  receivedInPeriod: number | null;
}) {
  const ui = adminOverviewUi.analytics;
  if (analytics.status === 'disabled') {
    return (
      <section className={cardClass} aria-labelledby="overview-analytics-title">
        <h2 id="overview-analytics-title" className={sectionTitleClass}>
          {ui.title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{ui.description}</p>
        <p role="note" className="mt-3 rounded-card bg-background p-3 text-sm text-text-primary">
          {ui.disabled}
        </p>
      </section>
    );
  }
  if (analytics.status === 'not_configured') {
    return (
      <section className={cardClass} aria-labelledby="overview-analytics-title">
        <h2 id="overview-analytics-title" className={sectionTitleClass}>
          {ui.title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{ui.description}</p>
        <p role="note" className="mt-3 rounded-card bg-background p-3 text-sm text-text-primary">
          {ui.notConfigured}
        </p>
      </section>
    );
  }
  if (analytics.status === 'unavailable') {
    return (
      <section className={cardClass} aria-labelledby="overview-analytics-title">
        <h2 id="overview-analytics-title" className={sectionTitleClass}>
          {ui.title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">{ui.description}</p>
        <div
          role="alert"
          className="mt-3 rounded-card border-s-4 border-status-warning bg-background p-3 text-sm text-text-primary"
          data-testid="overview-analytics-unavailable"
        >
          <p className="font-semibold">{ui.unavailable}</p>
          <p className="mt-1 text-text-secondary">{ui.unavailableReasons[analytics.reason]}</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-text-secondary">{ui.freshness}</p>
      </section>
    );
  }

  const report = analytics.report;
  const hasJoinSuccessEvents =
    report.events !== null && report.events.joinRequestSuccess > 0;
  const showConversion =
    hasJoinSuccessEvents &&
    report.totals.sessions > 0 &&
    report.conversion.status === 'available';
  const showRatio =
    receivedInPeriod !== null &&
    report.totals.totalUsers > 0;
  const ratio = showRatio ? (receivedInPeriod / report.totals.totalUsers) * 100 : null;

  return (
    <section className={cardClass} aria-labelledby="overview-analytics-title">
      <h2 id="overview-analytics-title" className={sectionTitleClass}>
        {ui.title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{ui.description}</p>

      {report.partial ? (
        <p
          role="note"
          className="mt-3 rounded-card border-s-4 border-status-warning bg-background p-3 text-xs leading-6 text-text-primary"
        >
          {ui.partial}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: ui.users, value: report.totals.totalUsers },
          { label: ui.sessions, value: report.totals.sessions },
          { label: ui.pageViews, value: report.totals.screenPageViews },
          { label: ui.pricingViews, value: report.pricingPageViews },
          { label: ui.joinViews, value: report.joinPageViews },
          { label: ui.joinCtaClicks, value: report.events?.joinCtaClicks ?? null },
          {
            label: ui.joinSuccessEvents,
            value: report.events?.joinRequestSuccess ?? null,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-control bg-background p-3">
            <p className="text-xs font-semibold text-text-secondary">{item.label}</p>
            <p className="mt-1 text-xl font-bold text-text-primary" dir="ltr">
              {item.value === null ? '—' : formatCount(item.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold text-text-primary">{ui.topPages}</h3>
          <BarList
            empty={ui.emptyRows}
            rows={report.topPages.map((page) => ({
              label: page.path,
              count: page.pageViews,
            }))}
          />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-primary">{ui.sources}</h3>
          <BarList
            empty={ui.emptyRows}
            rows={report.sources.map((source) => ({
              label: source.sourceMedium,
              count: source.sessions,
            }))}
          />
        </div>
      </div>

      <div className="mt-5 rounded-control bg-background p-3 text-sm">
        <p className="font-semibold text-text-primary">{ui.conversionTitle}</p>
        {showConversion && report.conversion.status === 'available' ? (
          <p className="mt-1 text-text-primary">
            {ui.conversionValue}:{' '}
            <span dir="ltr">{(report.conversion.rate * 100).toFixed(1)}%</span>
          </p>
        ) : (
          <p className="mt-1 text-text-secondary">
            {hasJoinSuccessEvents ? ui.conversionUnavailable : ui.noEvents}
          </p>
        )}
        <p className="mt-1 text-xs leading-5 text-text-secondary">{ui.conversionNote}</p>
        <p className="mt-3 font-semibold text-text-primary">{ui.ratioLabel}</p>
        {showRatio && ratio !== null ? (
          <p className="mt-1 text-text-primary" dir="ltr">
            {ratio.toFixed(1)}%
          </p>
        ) : (
          <p className="mt-1 text-text-secondary">{ui.ratioUnavailable}</p>
        )}
        <p className="mt-1 text-xs leading-5 text-text-secondary">{ui.ratioNote}</p>
      </div>

      <p className="mt-3 text-xs leading-5 text-text-secondary">{ui.eventsNote}</p>
      <p className="mt-2 text-xs leading-5 text-text-secondary">
        {ui.fetchedAt}:{' '}
        <span dir="ltr">{formatCairoDateTime(report.fetchedAt) ?? report.fetchedAt}</span>{' '}
        {REPORTING_TIMEZONE_LABEL}
        {report.cached ? ` · ${ui.cached}` : ''}
      </p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{ui.freshness}</p>
    </section>
  );
}

function PeriodTabs({ period }: { period: OverviewPeriod }) {
  return (
    <nav aria-label={adminOverviewUi.periodLabel} className="flex flex-wrap gap-2">
      {OVERVIEW_PERIODS.map((value) => (
        <Link
          key={value}
          href={`/admin?period=${value}`}
          aria-current={period === value ? 'page' : undefined}
          className={`inline-flex min-h-control items-center rounded-control border px-4 text-sm font-semibold ${
            period === value
              ? 'border-action-primary-bg bg-action-primary-bg text-action-primary-fg'
              : 'border-border-interactive bg-surface text-text-primary hover:bg-background'
          }`}
          data-testid={`overview-period-${value}`}
        >
          {adminOverviewUi.periods[value]}
        </Link>
      ))}
    </nav>
  );
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const params = await searchParams;
  const period = parseOverviewPeriod(params.period);
  const now = new Date();
  const range = cairoReportingRange(now, period);
  const [overview, analytics] = await Promise.all([
    loadOverviewMetrics(period, { now }),
    loadDashboardAnalytics({ startDate: range.startDate, endDate: range.endDate }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="text-2xl font-bold text-text-primary">{adminOverviewUi.title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
        {adminOverviewUi.description}
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <PeriodTabs period={period} />
        <p className="text-xs leading-5 text-text-secondary">
          {adminOverviewUi.periodNote} {adminOverviewUi.currentRange}:{' '}
          <span dir="ltr">
            {range.startDate} — {range.endDate}
          </span>{' '}
          ({REPORTING_TIMEZONE_LABEL})
        </p>
      </div>

      <div className="mt-5">
        {overview.status === 'ok' ? (
          <OverviewContent metrics={overview.metrics} />
        ) : (
          <div role="alert" className="rounded-card border-s-4 border-status-warning bg-surface p-4">
            <h2 className="text-base font-bold text-text-primary">
              {adminOverviewUi.storageErrorTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{overview.message}</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <AnalyticsSection
          analytics={analytics}
          receivedInPeriod={overview.status === 'ok' ? overview.metrics.receivedInPeriod : null}
        />
      </div>
    </div>
  );
}

export type { OverviewResult };
