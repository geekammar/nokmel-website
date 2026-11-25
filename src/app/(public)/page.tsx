import type { Metadata } from 'next';
import { HomeView } from '@/components/pages/HomeView';
import { home } from '@/content/ar/home';
import { getPublishedPageContent } from '@/lib/cms/service';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'نكمّل — متجرك في المحادثة. وبزنسك في مكان واحد.',
  description: home.hero.subheadline,
  path: '/',
});

export default async function HomePage() {
  const content = await getPublishedPageContent('home', 'ar');
  return <HomeView content={content} />;
}
