import type { Metadata } from 'next';
import { JoinView } from '@/components/pages/JoinView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { pageMetadataForSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('join');
  return pageMetadataForSeo('join', bundle.seo);
}

export default async function JoinPage() {
  const { content } = await getPublicPageBundle('join');
  return <JoinView content={content} />;
}
