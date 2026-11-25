import type { Metadata } from 'next';
import { FeaturesView } from '@/components/pages/FeaturesView';
import { features } from '@/content/ar/features';
import { getPublishedPageContent } from '@/lib/cms/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'الميزات — نكمّل',
  description: features.hero.lead,
  path: '/features',
});

export default async function FeaturesPage() {
  const content = await getPublishedPageContent('features', 'ar');
  return <FeaturesView content={content} />;
}
