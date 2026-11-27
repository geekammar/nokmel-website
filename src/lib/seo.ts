import type { Metadata } from 'next';
import {
  getSocialImage,
  type SocialImageId,
} from '@/content/cms/social-images';
import { getPageDefinition, type CmsPageKey } from '@/content/cms/registry';
import type { EffectiveSeo } from '@/content/cms/seo';
import { isPublicIndexingEnabled } from '@/lib/launch-controls';
import { siteUrl } from '@/lib/site';

/**
 * Pre-launch indexing barrier.
 *
 * Public pages are `noindex, nofollow` unless the explicit, runtime-only
 * `SITE_INDEXING_ENABLED` release flag is set in a non-Preview deployment.
 * `PRE_LAUNCH` mirrors that decision for existing callers/tests. `robots.txt`
 * and `sitemap.xml` are generated from the same gate, so metadata, robots and
 * sitemap can never disagree.
 *
 * Admin/login/protected-preview paths stay `noindex, nofollow` unconditionally,
 * even after public indexing is enabled.
 */
export const PRE_LAUNCH = !isPublicIndexingEnabled();
const PRIVATE_PATH_PREFIX = '/admin';

export function robotsForPath(
  path: string,
  indexingEnabled: boolean,
): Metadata['robots'] {
  const privatePath =
    path === PRIVATE_PATH_PREFIX || path.startsWith(`${PRIVATE_PATH_PREFIX}/`);
  return indexingEnabled && !privatePath
    ? { index: true, follow: true }
    : { index: false, follow: false };
}

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
    robots: robotsForPath(path, !PRE_LAUNCH),
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
