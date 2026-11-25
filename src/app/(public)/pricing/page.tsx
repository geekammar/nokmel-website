import type { Metadata } from 'next';
import { PricingView } from '@/components/pages/PricingView';
import { pricing } from '@/content/ar/pricing';
import { getPublishedPageContent } from '@/lib/cms/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'الأسعار — نكمّل',
  description: pricing.hero.lead,
  path: '/pricing',
});

export default async function PricingPage() {
  const content = await getPublishedPageContent('pricing', 'ar');
  return <PricingView content={content} />;
}
