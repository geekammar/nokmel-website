import type { MetadataRoute } from 'next';
import { CMS_PAGE_KEYS, getPageDefinition } from '@/content/cms/registry';
import { siteUrl } from '@/lib/site';

/**
 * Public indexing release control (W6-B06).
 *
 * Indexing is disabled by default and can be enabled only by an explicit
 * runtime flag in a non-Preview deployment. The flag is deliberately not a
 * `NEXT_PUBLIC_*` value and is not committed in this repository. Preview and
 * Vercel development deployments always remain `noindex, nofollow`, even if
 * the flag is set there by mistake, so a launch build can never accidentally
 * index a preview host.
 *
 * The owner-authorized launch procedure is documented in
 * `docs/W6_LAUNCH_READINESS.md`.
 */

export const PUBLIC_INDEXING_ENV_VAR = 'SITE_INDEXING_ENABLED';
const ENABLING_VALUES = new Set(['1', 'true']);

export function resolvePublicIndexingEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[PUBLIC_INDEXING_ENV_VAR]?.trim().toLowerCase();
  if (!raw || !ENABLING_VALUES.has(raw)) return false;

  /**
   * The approved hosting path is Vercel. Positive `VERCEL_ENV=production`
   * identification is required in addition to the explicit flag. Missing,
   * invalid, Preview, development or unknown environment metadata always
   * keeps indexing disabled. A non-Vercel deployment is deliberately not
   * supported by this release control; it would need a separate, explicit
   * environment contract rather than inferring production from an absent
   * `VERCEL_ENV`.
   */
  return env.VERCEL_ENV?.trim().toLowerCase() === 'production';
}

export function isPublicIndexingEnabled(): boolean {
  return resolvePublicIndexingEnabled();
}

export function buildRobotsPolicy(indexing: boolean): MetadataRoute.Robots {
  if (!indexing) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

export function buildSitemapEntries(indexing: boolean): MetadataRoute.Sitemap {
  if (!indexing) return [];
  return CMS_PAGE_KEYS.map((pageKey) => {
    const page = getPageDefinition(pageKey);
    return {
      url: `${siteUrl}${page.path === '/' ? '' : page.path}`,
      changeFrequency: 'monthly' as const,
      priority: page.path === '/' ? 1 : 0.8,
    };
  });
}
