import type { Metadata } from 'next';
import { adminPlansUi } from '@/content/ar/admin-plans';
import { requireOwner } from '@/lib/owner';
import { pageMetadata } from '@/lib/seo';
import { PlanEditor } from '../PlanEditor';

export const metadata: Metadata = pageMetadata({
  title: `${adminPlansUi.createTitle} — ${adminPlansUi.sectionTitle}`,
  description: adminPlansUi.createDescription,
  path: '/admin/plans',
});

export const dynamic = 'force-dynamic';

export default async function NewPlanPage() {
  await requireOwner();
  return <PlanEditor />;
}
