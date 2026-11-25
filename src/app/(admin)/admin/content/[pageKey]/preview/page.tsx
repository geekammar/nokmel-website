import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CmsPageView } from '@/components/pages/CmsPageView';
import { getPageDefinition, isCmsPageKey, type CmsPageContent, type CmsPageKey } from '@/content/cms/registry';
import { adminContentUi } from '@/content/ar/admin-content';
import { getEditorPageData, getPreviewPageContent } from '@/lib/cms/service';
import { requireOwner } from '@/lib/owner';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}): Promise<Metadata> {
  const { pageKey } = await params;
  const page = isCmsPageKey(pageKey) ? getPageDefinition(pageKey) : null;
  return pageMetadata({
    title: `${adminContentUi.previewPage.title} — ${page?.label ?? ''}`,
    description: adminContentUi.previewPage.bannerBody,
    path: '/admin/content',
  });
}

export default async function AdminContentPreviewPage({
  params,
}: {
  params: Promise<{ pageKey: string }>;
}) {
  await requireOwner();
  const { pageKey: rawPageKey } = await params;
  if (!isCmsPageKey(rawPageKey)) notFound();
  const pageKey = rawPageKey as CmsPageKey;
  const page = getPageDefinition(pageKey);

  const editorData = await getEditorPageData(pageKey, 'ar');
  const hasDraft = editorData.status === 'ok' ? editorData.data.hasDraft : false;

  let content: CmsPageContent[CmsPageKey] | null = null;
  try {
    content = (await getPreviewPageContent(pageKey, 'ar')) as CmsPageContent[CmsPageKey];
  } catch {
    content = null;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div
        className="rounded-card border-s-4 border-status-warning bg-surface p-4"
        role="note"
        data-testid="preview-banner"
      >
        <h1 className="text-lg font-bold text-text-primary">
          {adminContentUi.previewPage.bannerTitle}
        </h1>
        <p className="mt-1 text-sm leading-7 text-text-secondary">
          {adminContentUi.previewPage.bannerBody}
        </p>
        {!hasDraft ? (
          <p className="mt-1 text-sm text-text-secondary">
            {adminContentUi.previewPage.noDraftNote}
          </p>
        ) : null}
        <Link
          href={`/admin/content/${pageKey}`}
          className="mt-3 inline-flex min-h-control items-center rounded-control border border-border-interactive px-4 text-sm font-semibold text-text-primary hover:bg-background"
        >
          {adminContentUi.previewPage.returnToEditor}
        </Link>
      </div>

      <div className="mt-4 rounded-card border border-border-subtle bg-page" data-preview-page={page.path}>
        {content ? (
          <CmsPageView pageKey={pageKey} content={content} />
        ) : (
          <div className="p-6" role="alert">
            <h2 className="text-base font-bold text-text-primary">
              {adminContentUi.previewPage.errorTitle}
            </h2>
            <p className="mt-2 text-sm leading-7 text-text-secondary">
              {adminContentUi.previewPage.errorBody}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
