import type { Metadata } from 'next';
import { LegalPageView } from '@/components/pages/LegalPageView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { pageMetadataForSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('terms');
  return pageMetadataForSeo('terms', bundle.seo);
}

export default async function TermsPage() {
  const { content } = await getPublicPageBundle('terms');
  return <LegalPageView content={content} />;
}
