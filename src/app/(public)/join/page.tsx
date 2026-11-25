import type { Metadata } from 'next';
import { JoinView } from '@/components/pages/JoinView';
import { join } from '@/content/ar/join';
import { getPublishedPageContent } from '@/lib/cms/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'اطلب الانضمام — نكمّل',
  description: join.hero.lead,
  path: '/join',
});

export default async function JoinPage() {
  const content = await getPublishedPageContent('join', 'ar');
  return <JoinView content={content} />;
}
