import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { adminUi } from '@/content/ar/admin';
import { pageMetadata } from '@/lib/seo';
import { requireOwner } from '@/lib/owner';

export const metadata: Metadata = pageMetadata({
  title: adminUi.shell.overviewTitle,
  description: adminUi.shell.welcome,
  path: '/admin',
});

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  await requireOwner();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold text-text-primary">{adminUi.shell.overviewTitle}</h1>
      <p className="mt-2 text-base text-text-secondary">{adminUi.shell.welcome}</p>

      <div className="mt-6">
        <Card>
          <h2 className="text-lg font-bold text-text-primary">{adminUi.shell.overviewEmptyTitle}</h2>
          <p className="mt-2 text-sm leading-7 text-text-secondary">
            {adminUi.shell.overviewEmptyBody}
          </p>
        </Card>
      </div>
    </div>
  );
}
