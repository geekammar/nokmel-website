import type { Metadata } from 'next';
import Link from 'next/link';
import { CMS_PAGES } from '@/content/cms/registry';
import { adminContentUi } from '@/content/ar/admin-content';
import { requireOwner } from '@/lib/owner';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: adminContentUi.sectionTitle,
  description: adminContentUi.sectionDescription,
  path: '/admin/content',
});

export const dynamic = 'force-dynamic';

export default async function AdminContentIndexPage() {
  await requireOwner();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold text-text-primary">{adminContentUi.sectionTitle}</h1>
      <p className="mt-2 text-base leading-7 text-text-secondary">
        {adminContentUi.sectionDescription}
      </p>

      <p
        role="note"
        className="mt-4 rounded-card border-s-4 border-status-info bg-surface p-4 text-sm leading-7 text-text-secondary"
      >
        {adminContentUi.seoNote}
      </p>

      <section className="mt-8" aria-labelledby="content-pages-title">
        <h2 id="content-pages-title" className="text-lg font-bold text-text-primary">
          {adminContentUi.pagesTitle}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{adminContentUi.pagesDescription}</p>
        <ul className="mt-4 flex list-none flex-col divide-y divide-border-subtle rounded-card border border-border-subtle bg-surface p-0">
          {CMS_PAGES.map((page) => (
            <li key={page.key}>
              <Link
                href={`/admin/content/${page.key}`}
                data-testid={`content-page-link-${page.key}`}
                className="flex min-h-control flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-background"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-text-primary">{page.label}</span>
                  <span className="mt-0.5 block text-xs text-text-secondary" dir="ltr">
                    {page.path}
                  </span>
                </span>
                <span className="text-sm font-semibold text-action-secondary">
                  {adminContentUi.openPage}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
