import type { Metadata } from 'next';
import { PricingView } from '@/components/pages/PricingView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { pageMetadataForSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('pricing');
  return pageMetadataForSeo('pricing', bundle.seo);
}

export default async function PricingPage() {
  const { content } = await getPublicPageBundle('pricing');
  return <PricingView content={content} />;
}
