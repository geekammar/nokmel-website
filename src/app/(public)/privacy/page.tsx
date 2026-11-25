import type { Metadata } from 'next';
import { LegalPageView } from '@/components/pages/LegalPageView';
import { legal } from '@/content/ar/legal';
import { getPublishedPageContent } from '@/lib/cms/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'سياسة الخصوصية — نكمّل',
  description: legal.privacy.intro,
  path: '/privacy',
});

export default async function PrivacyPage() {
  const content = await getPublishedPageContent('privacy', 'ar');
  return <LegalPageView content={content} />;
}
