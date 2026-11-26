import type { Metadata } from 'next';
import { LegalPageView } from '@/components/pages/LegalPageView';
import { getPublicPageBundle } from '@/lib/cms/public-page';
import { isJoinIntakeEnabled } from '@/lib/join/intake-gate';
import { pageMetadataForSeo } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await getPublicPageBundle('privacy');
  return pageMetadataForSeo('privacy', bundle.seo);
}

export default async function PrivacyPage() {
  const { content } = await getPublicPageBundle('privacy');
  return <LegalPageView content={content} intakeEnabled={isJoinIntakeEnabled()} />;
}
