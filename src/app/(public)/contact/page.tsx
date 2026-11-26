import type { Metadata } from 'next';
import { ContactView } from '@/components/pages/ContactView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { pageMetadataForSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('contact');
  return pageMetadataForSeo('contact', bundle.seo);
}

export default async function ContactPage() {
  const { content } = await getPublicPageBundle('contact');
  return <ContactView content={content} />;
}
