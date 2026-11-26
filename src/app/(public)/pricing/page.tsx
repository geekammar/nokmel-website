import type { Metadata } from 'next';
import { PricingView } from '@/components/pages/PricingView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { getPublicPlans } from '@/lib/plans/service';
import { pageMetadataForSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('pricing');
  return pageMetadataForSeo('pricing', bundle.seo);
}

export default async function PricingPage() {
  const [bundle, plansResult] = await Promise.all([
    getPublicPageBundle('pricing'),
    getPublicPlans(),
  ]);
  return <PricingView content={bundle.content} plans={plansResult.plans} />;
}
