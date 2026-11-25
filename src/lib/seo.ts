import type { Metadata } from 'next';
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

const openGraphImage = {
  url: '/brand/logos/nokmel-mark-transparent-1024.png',
  width: 1024,
  height: 785,
  alt: 'Nokmel Completion Mark',
} as const;

type PageMetadataInput = {
  title: string;
  description: string;
  path: `/${string}`;
};

export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: PRE_LAUNCH ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `${siteUrl}${path === '/' ? '' : path}`,
      siteName: 'Nokmel',
      locale: 'ar_AR',
      type: 'website',
      images: [openGraphImage],
    },
  };
}
