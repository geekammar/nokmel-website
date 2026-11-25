import type { Metadata } from 'next';
import {
  getSocialImage,
  type SocialImageId,
} from '@/content/cms/social-images';
import { getPageDefinition, type CmsPageKey } from '@/content/cms/registry';
import type { EffectiveSeo } from '@/content/cms/seo';
import { siteUrl } from '@/lib/site';

/**
 * Pre-launch indexing barrier.
 *
 * While `PRE_LAUNCH` is `true` every public page is served with
 * `noindex, nofollow`, and `public/robots.txt` disallows all crawlers.
 * This is an intentional, centralized launch gate — not a permanent
 * noindex rule. Public indexing is switched on only with explicit launch
 * approval (W6) by:
 *   1. setting `PRE_LAUNCH = false` here, and
 *   2. replacing `public/robots.txt` with the launch indexing rules.
 */
export const PRE_LAUNCH = true;

type PageMetadataInput = {
  title: string;
  description: string;
  path: `/${string}`;
  socialTitle?: string;
  socialDescription?: string;
  socialImage?: SocialImageId;
};

function socialImageUrl(id: SocialImageId | undefined): string {
  return new URL(getSocialImage(id).path, siteUrl).toString();
}

export function pageMetadata({
  title,
  description,
  path,
  socialTitle,
  socialDescription,
  socialImage,
}: PageMetadataInput): Metadata {
  const image = getSocialImage(socialImage);
  const effectiveSocialTitle = socialTitle?.trim() || title;
  const effectiveSocialDescription = socialDescription?.trim() || description;
  const imageUrl = socialImageUrl(image.id);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: PRE_LAUNCH ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: effectiveSocialTitle,
      description: effectiveSocialDescription,
      url: `${siteUrl}${path === '/' ? '' : path}`,
      siteName: 'Nokmel',
      locale: 'ar_AR',
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: image.width,
          height: image.height,
          alt: image.alt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: effectiveSocialTitle,
      description: effectiveSocialDescription,
      images: [imageUrl],
    },
  };
}

export function pageMetadataForSeo(pageKey: CmsPageKey, seo: EffectiveSeo): Metadata {
  const page = getPageDefinition(pageKey);
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: page.path,
    socialTitle: seo.socialTitle,
    socialDescription: seo.socialDescription,
    socialImage: seo.socialImageId,
  });
}
