import { ContactView } from '@/components/pages/ContactView';
import { FeaturesView } from '@/components/pages/FeaturesView';
import { HomeView } from '@/components/pages/HomeView';
import { JoinView } from '@/components/pages/JoinView';
import { LegalPageView } from '@/components/pages/LegalPageView';
import { PricingView } from '@/components/pages/PricingView';
import type { ContactContent } from '@/content/ar/contact';
import type { FeaturesContent } from '@/content/ar/features';
import type { HomeContent } from '@/content/ar/home';
import type { JoinContent } from '@/content/ar/join';
import type { PricingContent } from '@/content/ar/pricing';
import type { CmsPageContent, CmsPageKey, LegalPageContent } from '@/content/cms/registry';

/**
 * Renders the same public page views used by the live routes. Only the
 * owner-authorized preview route uses this switch; public routes call the
 * typed views directly.
 */
export function CmsPageView({
  pageKey,
  content,
}: {
  pageKey: CmsPageKey;
  content: CmsPageContent[CmsPageKey];
}) {
  switch (pageKey) {
    case 'home':
      return <HomeView content={content as HomeContent} />;
    case 'features':
      return <FeaturesView content={content as FeaturesContent} />;
    case 'pricing':
      return <PricingView content={content as PricingContent} />;
    case 'join':
      return <JoinView content={content as JoinContent} />;
    case 'contact':
      return <ContactView content={content as ContactContent} />;
    case 'privacy':
    case 'terms':
      return <LegalPageView content={content as LegalPageContent} />;
  }
}
