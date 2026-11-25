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
  const sections = adminUi.nav as ReadonlyArray<{ id: string; label: string; available: boolean }>;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold text-text-primary">{adminUi.shell.overviewTitle}</h1>
      <p className="mt-2 text-base text-text-secondary">{adminUi.shell.welcome}</p>

      <div className="mt-6">
        <Card>
          <h2 className="text-lg font-bold text-text-primary">
            {sections.find((section) => section.id === 'overview')?.label}
          </h2>
          <p className="mt-3 text-sm leading-7 text-text-secondary">{adminUi.shell.overviewBody}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {sections.map((section) => (
              <li
                key={section.id}
                className="flex min-h-control flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle px-3"
              >
                <span className="text-sm font-semibold text-text-primary">{section.label}</span>
                <span
                  className={`text-xs font-semibold ${
                    section.available ? 'text-status-success' : 'text-text-secondary'
                  }`}
                >
                  {section.available ? adminUi.shell.availableNow : adminUi.shell.unavailableNote}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
