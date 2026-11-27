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
   * On Vercel only a Production deployment may enable indexing. `preview` and
   * `development` are never indexable. A non-Vercel environment has no
   * `VERCEL_ENV`; there the explicit operator flag is sufficient.
   */
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv && vercelEnv !== 'production') return false;
  return true;
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
