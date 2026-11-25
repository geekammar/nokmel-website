import type { Metadata } from 'next';
import { HomeView } from '@/components/pages/HomeView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { pageMetadataForSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('home');
  return pageMetadataForSeo('home', bundle.seo);
}

export default async function HomePage() {
  const { content } = await getPublicPageBundle('home');
  return <HomeView content={content} />;
}
