import type { Metadata } from 'next';
import Link from 'next/link';
import { adminPlansUi } from '@/content/ar/admin-plans';
import { requireOwner } from '@/lib/owner';
import { getOwnerPlans } from '@/lib/plans/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: adminPlansUi.sectionTitle,
  description: adminPlansUi.sectionDescription,
  path: '/admin/plans',
});

export const dynamic = 'force-dynamic';

function statusClass(status: 'draft' | 'published' | 'hidden'): string {
  if (status === 'published') return 'border-status-success text-status-success';
  if (status === 'hidden') return 'border-status-warning text-status-warning';
  return 'border-border-subtle text-text-secondary';
}

function statusLabel(status: 'draft' | 'published' | 'hidden'): string {
  if (status === 'published') return adminPlansUi.status.published;
  if (status === 'hidden') return adminPlansUi.status.hidden;
  return adminPlansUi.status.draft;
}

function formatTimestamp(value: string | null): string {
  if (!value) return '';
  return `${value.slice(0, 16).replace('T', ' ')} UTC`;
}

export default async function AdminPlansPage() {
  await requireOwner();
  const result = await getOwnerPlans();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{adminPlansUi.sectionTitle}</h1>
          <p className="mt-2 text-base leading-7 text-text-secondary">
            {adminPlansUi.sectionDescription}
          </p>
        </div>
        <Link
          href="/admin/plans/new"
          className="inline-flex min-h-control items-center rounded-control bg-action-primary-bg px-5 font-semibold text-action-primary-fg hover:bg-action-primary-bg-hover"
          data-testid="plan-create"
        >
          {adminPlansUi.create}
        </Link>
      </div>

      <p
        role="note"
        className="mt-4 rounded-card border-s-4 border-status-info bg-surface p-4 text-sm leading-6 text-text-secondary"
      >
        {adminPlansUi.marketingNote}
      </p>

      {result.status !== 'ok' ? (
        <div role="alert" className="mt-6 rounded-card border-s-4 border-status-warning bg-surface p-4">
          <p className="text-sm leading-6 text-text-secondary">{result.message}</p>
        </div>
      ) : result.plans.length === 0 ? (
        <div
          data-testid="plan-empty"
          className="mt-6 rounded-card border border-border-subtle bg-surface p-6"
        >
          <h2 className="text-lg font-bold text-text-primary">{adminPlansUi.emptyTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-text-secondary">
            {adminPlansUi.emptyBody}
          </p>
        </div>
      ) : (
        <section className="mt-6" aria-labelledby="plan-list-title">
          <h2 id="plan-list-title" className="text-lg font-bold text-text-primary">
            {adminPlansUi.listTitle}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{adminPlansUi.listDescription}</p>
          <ul
            data-testid="plan-list"
            className="mt-4 flex list-none flex-col divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface p-0"
          >
            {result.plans.map((plan) => (
              <li
                key={plan.id}
                data-testid={`plan-list-item-${plan.slug}`}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text-primary">{plan.draft.name}</span>
                    <span
                      className={`rounded-control border px-2 py-0.5 text-xs font-semibold ${statusClass(plan.status)}`}
                    >
                      {statusLabel(plan.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary" dir="ltr">
                    {plan.slug} · #{plan.draft.displayOrder}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {adminPlansUi.status.revision}: {plan.revision} ·{' '}
                    {adminPlansUi.status.lastPublished}:{' '}
                    {plan.publishedAt ? (
                      <span dir="ltr">{formatTimestamp(plan.publishedAt)}</span>
                    ) : (
                      adminPlansUi.status.notPublished
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/plans/${plan.id}`}
                    className="inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background"
                    data-testid={`plan-edit-${plan.slug}`}
                  >
                    {adminPlansUi.openEditor}
                  </Link>
                  <Link
                    href={`/admin/plans/${plan.id}/preview`}
                    className="inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background"
                  >
                    {adminPlansUi.preview}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.status === 'ok' && result.plans.length > 0 ? (
        <p className="mt-4 text-sm text-text-secondary">
          <Link href="/pricing" className="font-semibold text-action-secondary underline-offset-4 hover:underline">
            {adminPlansUi.publicPage}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
