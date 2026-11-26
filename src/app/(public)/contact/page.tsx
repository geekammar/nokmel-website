import type { Metadata } from 'next';
import { ContactView } from '@/components/pages/ContactView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { pageMetadataForSeo } from '@/lib/seo';
import { publicSettingsChannels } from '@/lib/settings/model';
import { loadPublicSettings } from '@/lib/settings/service';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('contact');
  return pageMetadataForSeo('contact', bundle.seo);
}

export default async function ContactPage() {
  const [bundle, settings] = await Promise.all([
    getPublicPageBundle('contact'),
    loadPublicSettings(),
  ]);
  return (
    <ContactView
      content={bundle.content}
      channels={publicSettingsChannels(settings.settings)}
    />
  );
}
