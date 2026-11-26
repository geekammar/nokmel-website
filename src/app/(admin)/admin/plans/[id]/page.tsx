import type { Metadata } from 'next';
import { adminPlansUi } from '@/content/ar/admin-plans';
import { requireOwner } from '@/lib/owner';
import { getOwnerPlan } from '@/lib/plans/service';
import { pageMetadata } from '@/lib/seo';
import { PlanEditor } from '../PlanEditor';

export const metadata: Metadata = pageMetadata({
  title: adminPlansUi.sectionTitle,
  description: adminPlansUi.sectionDescription,
  path: '/admin/plans',
});

export const dynamic = 'force-dynamic';

export default async function EditPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const { id } = await params;
  const { created } = await searchParams;
  const result = await getOwnerPlan(id);

  if (result.status !== 'ok') {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <div role="alert" className="mt-4 rounded-card border-s-4 border-status-warning bg-surface p-4">
          <h1 className="text-xl font-bold text-text-primary">{adminPlansUi.sectionTitle}</h1>
          <p className="mt-2 text-sm leading-7 text-text-secondary">{result.message}</p>
        </div>
      </div>
    );
  }

  return (
    <PlanEditor
      plan={result.plan}
      justCreated={created === '1'}
      nowIso={new Date().toISOString()}
    />
  );
}
