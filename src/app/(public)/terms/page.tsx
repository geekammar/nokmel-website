import type { Metadata } from 'next';
import { LegalPageView } from '@/components/pages/LegalPageView';
import { legal } from '@/content/ar/legal';
import { getPublishedPageContent } from '@/lib/cms/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'الشروط والأحكام — نكمّل',
  description: legal.terms.intro,
  path: '/terms',
});

export default async function TermsPage() {
  const content = await getPublishedPageContent('terms', 'ar');
  return <LegalPageView content={content} />;
}
