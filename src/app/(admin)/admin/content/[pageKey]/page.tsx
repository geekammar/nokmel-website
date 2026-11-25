import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CMS_PAGES, getPageDefinition, isCmsPageKey } from '@/content/cms/registry';
import { adminContentUi } from '@/content/ar/admin-content';
import { getEditorPageData, type CmsStorageStatus } from '@/lib/cms/service';
import { requireOwner } from '@/lib/owner';
import { pageMetadata } from '@/lib/seo';
import { ContentEditor } from './editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}): Promise<Metadata> {
  const { pageKey } = await params;
  const page = CMS_PAGES.find((candidate) => candidate.key === pageKey);
  return pageMetadata({
    title: `${page?.label ?? 'محتوى'} — ${adminContentUi.sectionTitle}`,
    description: adminContentUi.sectionDescription,
    path: '/admin/content',
  });
}

function storageMessage(status: Exclude<CmsStorageStatus, 'ok'>, fallback: string): string {
  if (status === 'unconfigured') return adminContentUi.storage.unconfigured;
  if (status === 'not_migrated') return adminContentUi.storage.not_migrated;
  if (status === 'unavailable') return adminContentUi.storage.unavailable;
  if (status === 'invalid') return adminContentUi.storage.invalid;
  return fallback;
}

export default async function AdminContentEditorPage({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}) {
  await requireOwner();
  const { pageKey } = await params;
  if (!isCmsPageKey(pageKey)) notFound();
  const page = getPageDefinition(pageKey);
  const result = await getEditorPageData(pageKey, 'ar');

  return (
    <div className="mx-auto w-full max-w-4xl">
      {result.status !== 'ok' ? (
        <div className="mt-4 rounded-card border-s-4 border-status-warning bg-surface p-4" role="alert">
          <h1 className="text-xl font-bold text-text-primary">{page.label}</h1>
          <p className="mt-2 text-sm leading-7 text-text-secondary">
            {storageMessage(result.status, result.message)}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <ContentEditor pageKey={pageKey} initial={result.data} />
        </div>
      )}
    </div>
  );
}
