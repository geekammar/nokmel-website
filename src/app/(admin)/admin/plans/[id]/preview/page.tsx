import type { Metadata } from 'next';
import Link from 'next/link';
import { PlanCard } from '@/components/pricing/PlanCard';
import { adminPlansUi } from '@/content/ar/admin-plans';
import { requireOwner } from '@/lib/owner';
import { planDraftToPublic } from '@/lib/plans/model';
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

      <div className="mt-4">
        {result.status === 'ok' ? (
          <PlanCard plan={planDraftToPublic(result.plan)} preview />
        ) : (
          <div role="alert" className="rounded-card border border-border-subtle bg-surface p-6">
            <p className="text-sm text-text-secondary">
              {adminPlansUi.previewPage.storageError}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
