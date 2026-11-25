import type { Metadata } from 'next';
import { FeaturesView } from '@/components/pages/FeaturesView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { pageMetadataForSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('features');
  return pageMetadataForSeo('features', bundle.seo);
}

export default async function FeaturesPage() {
  const { content } = await getPublicPageBundle('features');
  return <FeaturesView content={content} />;
}
