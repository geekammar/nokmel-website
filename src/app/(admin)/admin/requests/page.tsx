import type { Metadata } from 'next';
import Link from 'next/link';
import { adminRequestsUi } from '@/content/ar/admin-requests';
import { listJoinRequests, type JoinRequestStatus } from '@/lib/join/service';
import { requireOwner } from '@/lib/owner';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: adminRequestsUi.sectionTitle,
  description: adminRequestsUi.sectionDescription,
  path: '/admin/requests',
});

export const dynamic = 'force-dynamic';

function parseStatus(value: string | string[] | undefined): JoinRequestStatus | 'all' {
  if (value === 'new' || value === 'contacted' || value === 'closed') return value;
  return 'all';
}

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== 'string') return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

function statusLabel(status: JoinRequestStatus): string {
  if (status === 'contacted') return adminRequestsUi.statusContacted;
  if (status === 'closed') return adminRequestsUi.statusClosed;
  return adminRequestsUi.statusNew;
}

function statusClass(status: JoinRequestStatus): string {
  if (status === 'contacted') return 'border-status-info text-status-info';
  if (status === 'closed') return 'border-border-subtle text-text-secondary';
  return 'border-status-success text-status-success';
}

function sourceLabel(source: 'direct' | 'pricing' | 'join'): string {
  if (source === 'pricing') return adminRequestsUi.sourcePricing;
  if (source === 'join') return adminRequestsUi.sourceJoin;
  return adminRequestsUi.sourceDirect;
}

function formatTimestamp(value: string): string {
  return `${value.slice(0, 16).replace('T', ' ')} UTC`;
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const params = await searchParams;
  const status = parseStatus(params.status);
  const page = parsePage(params.page);
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const result = await listJoinRequests({ status, page, query, pageSize: 20 });

  function filterHref(nextStatus: JoinRequestStatus | 'all'): string {
    const search = new URLSearchParams();
    if (nextStatus !== 'all') search.set('status', nextStatus);
    if (query) search.set('q', query);
    const suffix = search.toString();
    return suffix ? `/admin/requests?${suffix}` : '/admin/requests';
  }

  function pageHref(nextPage: number): string {
    const search = new URLSearchParams();
    if (status !== 'all') search.set('status', status);
    if (query) search.set('q', query);
    if (nextPage > 1) search.set('page', String(nextPage));
    const suffix = search.toString();
    return suffix ? `/admin/requests?${suffix}` : '/admin/requests';
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-2xl font-bold text-text-primary">{adminRequestsUi.sectionTitle}</h1>
      <p className="mt-2 text-base leading-7 text-text-secondary">
        {adminRequestsUi.sectionDescription}
      </p>
      <p
        role="note"
        className="mt-4 rounded-card border-s-4 border-status-warning bg-surface p-4 text-sm leading-6 text-text-secondary"
      >
        {adminRequestsUi.privacyNote}
      </p>

      {result.status !== 'ok' ? (
        <div role="alert" className="mt-6 rounded-card border-s-4 border-status-warning bg-surface p-4">
          <p className="text-sm leading-6 text-text-secondary">{result.message}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-4">
            <nav aria-label={adminRequestsUi.filterLabel} className="flex flex-wrap gap-2">
              {(['all', 'new', 'contacted', 'closed'] as const).map((filter) => {
                const count =
                  filter === 'all'
                    ? result.counts.new + result.counts.contacted + result.counts.closed
                    : result.counts[filter];
                const active = status === filter;
                return (
                  <Link
                    key={filter}
                    href={filterHref(filter)}
                    aria-current={active ? 'page' : undefined}
                    data-testid={`request-filter-${filter}`}
                    className={`inline-flex min-h-control items-center rounded-control border px-4 text-sm font-semibold ${
                      active
                        ? 'border-action-primary-bg bg-action-primary-bg text-action-primary-fg'
                        : 'border-border-interactive text-text-primary hover:bg-surface'
                    }`}
                  >
                    {filter === 'all'
                      ? adminRequestsUi.filterAll
                      : statusLabel(filter)}{' '}
                    <span className="ms-2 text-xs opacity-80">({count})</span>
                  </Link>
                );
              })}
            </nav>

            <form method="get" action="/admin/requests" className="flex flex-wrap items-end gap-3">
              {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
              <label htmlFor="request-search" className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-semibold text-text-primary">
                {adminRequestsUi.searchLabel}
                <input
                  id="request-search"
                  name="q"
                  type="search"
                  defaultValue={query}
                  maxLength={100}
                  placeholder={adminRequestsUi.searchPlaceholder}
                  className="min-h-control w-full rounded-control border border-border-interactive bg-surface px-4 text-base font-normal text-text-primary placeholder:text-text-secondary"
                />
              </label>
              <button
                type="submit"
                className="min-h-control rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-surface"
              >
                {adminRequestsUi.search}
              </button>
              {query ? (
                <Link
                  href={filterHref(status)}
                  className="inline-flex min-h-control items-center rounded-control px-3 text-sm font-semibold text-action-secondary underline-offset-4 hover:underline"
                >
                  {adminRequestsUi.clearSearch}
                </Link>
              ) : null}
            </form>
          </div>

          <p className="mt-4 text-sm text-text-secondary" data-testid="request-counts">
            {adminRequestsUi.showingCounts
              .replace('{new}', String(result.counts.new))
              .replace('{contacted}', String(result.counts.contacted))
              .replace('{closed}', String(result.counts.closed))}
          </p>

          {result.requests.length === 0 ? (
            <div
              data-testid="request-empty"
              className="mt-4 rounded-card border border-border-subtle bg-surface p-6"
            >
              <h2 className="text-lg font-bold text-text-primary">{adminRequestsUi.emptyTitle}</h2>
              <p className="mt-2 text-sm leading-7 text-text-secondary">
                {query || status !== 'all'
                  ? adminRequestsUi.emptyFiltered
                  : adminRequestsUi.emptyBody}
              </p>
            </div>
          ) : (
            <ul
              data-testid="request-list"
              className="mt-4 flex list-none flex-col divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface p-0"
            >
              {result.requests.map((request) => (
                <li key={request.id} data-testid={`request-item-${request.id}`}>
                  <Link
                    href={`/admin/requests/${request.id}`}
                    className="flex min-h-control flex-col gap-2 px-4 py-4 hover:bg-background sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-text-primary">{request.name}</span>
                        <span
                          className={`rounded-control border px-2 py-0.5 text-xs font-semibold ${statusClass(request.status)}`}
                        >
                          {statusLabel(request.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-secondary" dir="ltr">
                        {request.phone}
                      </p>
                      {request.email ? (
                        <p className="mt-0.5 break-all text-xs text-text-secondary" dir="ltr">
                          {request.email}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-text-secondary">
                        {adminRequestsUi.businessActivity}:{' '}
                        {request.businessActivity ?? adminRequestsUi.noBusinessActivity}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {adminRequestsUi.plan}:{' '}
                        {request.planNameSnapshot ?? adminRequestsUi.noPlan} ·{' '}
                        {adminRequestsUi.source}: {sourceLabel(request.source)}
                      </p>
                    </div>
                    <div className="text-xs text-text-secondary sm:text-end">
                      <p dir="ltr">{formatTimestamp(request.createdAt)}</p>
                      <span className="mt-1 inline-block font-semibold text-action-secondary">
                        {adminRequestsUi.openRequest}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {result.filteredTotal > result.pageSize ? (
            <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label={adminRequestsUi.listTitle}>
              <span className="text-sm text-text-secondary">
                {adminRequestsUi.pageInfo.replace('{page}', String(result.page))} · {result.filteredTotal}
              </span>
              <div className="flex gap-2">
                {result.page > 1 ? (
                  <Link
                    href={pageHref(result.page - 1)}
                    className="inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-surface"
                  >
                    {adminRequestsUi.previous}
                  </Link>
                ) : null}
                {result.page * result.pageSize < result.filteredTotal ? (
                  <Link
                    href={pageHref(result.page + 1)}
                    className="inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-surface"
                  >
                    {adminRequestsUi.next}
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
