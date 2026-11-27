import { describe, expect, it } from 'vitest';
import { PRE_LAUNCH, pageMetadata, robotsForPath } from '@/lib/seo';
import { buildRobotsPolicy, buildSitemapEntries, resolvePublicIndexingEnabled } from '@/lib/launch-controls';
import { CMS_PAGE_KEYS } from '@/content/cms/registry';
import { siteUrl } from '@/lib/site';

describe('page metadata and pre-launch indexing safety', () => {
  it('keeps the pre-launch barrier enabled by default', () => {
    expect(PRE_LAUNCH).toBe(true);
  });

  it('marks public pages noindex/nofollow while pre-launch', () => {
    const metadata = pageMetadata({
      title: 'الميزات — نكمّل',
      description: 'وصف',
      path: '/features',
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps private paths noindex even when public indexing is enabled', () => {
    expect(robotsForPath('/admin', true)).toEqual({ index: false, follow: false });
    expect(robotsForPath('/admin/settings', true)).toEqual({
      index: false,
      follow: false,
    });
    expect(robotsForPath('/features', true)).toEqual({ index: true, follow: true });
    expect(robotsForPath('/features', false)).toEqual({ index: false, follow: false });
  });

  it('builds canonical URLs from the approved target domain, not a deployment domain', () => {
    const metadata = pageMetadata({
      title: 'الأسعار — نكمّل',
      description: 'وصف',
      path: '/pricing',
    });
    expect(metadata.alternates?.canonical).toBe('/pricing');
    expect(JSON.stringify(metadata)).not.toContain('vercel');
  });

  it('exposes title, description and Open Graph per page', () => {
    const metadata = pageMetadata({
      title: 'الأسعار — نكمّل',
      description: 'وصف الصفحة',
      path: '/pricing',
    });
    expect(metadata.title).toEqual({ absolute: 'الأسعار — نكمّل' });
    expect(metadata.description).toBe('وصف الصفحة');
    expect(metadata.openGraph).toMatchObject({
      title: 'الأسعار — نكمّل',
      description: 'وصف الصفحة',
      url: 'https://nokmel.tech/pricing',
      type: 'website',
      locale: 'ar_AR',
    });
    expect(metadata.openGraph?.images).toHaveLength(1);
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: `${siteUrl}/brand/social/nokmel-social-card-1200x630.png`,
        width: 1200,
        height: 630,
      }),
    ]);
  });
});

describe('public indexing release control', () => {
  const enabled = (overrides: Record<string, string | undefined> = {}) =>
    resolvePublicIndexingEnabled({
      SITE_INDEXING_ENABLED: '1',
      ...overrides,
    } as unknown as NodeJS.ProcessEnv);

  it('is disabled without the explicit runtime flag', () => {
    expect(resolvePublicIndexingEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      resolvePublicIndexingEnabled({
        SITE_INDEXING_ENABLED: 'false',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('can be enabled only outside Preview/development Vercel deployments', () => {
    expect(enabled()).toBe(true);
    expect(enabled({ VERCEL_ENV: 'production' })).toBe(true);
    expect(enabled({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(enabled({ VERCEL_ENV: 'development' })).toBe(false);
  });

  it('produces a coherent pre-launch robots policy without a sitemap', () => {
    const policy = buildRobotsPolicy(false);
    expect(policy).toEqual({
      rules: [{ userAgent: '*', disallow: '/' }],
    });
  });

  it('produces launch robots rules that keep admin/api excluded', () => {
    const policy = buildRobotsPolicy(true);
    expect(policy.rules).toEqual([
      { userAgent: '*', allow: '/', disallow: ['/admin/', '/api/'] },
    ]);
    expect(policy.sitemap).toBe(`${siteUrl}/sitemap.xml`);
  });

  it('exposes no sitemap entries before launch and all seven routes after launch', () => {
    expect(buildSitemapEntries(false)).toEqual([]);
    const entries = buildSitemapEntries(true);
    expect(entries).toHaveLength(CMS_PAGE_KEYS.length);
    expect(entries[0]?.url).toBe(siteUrl);
    expect(entries.map((entry) => entry.url)).toContain(`${siteUrl}/pricing`);
    for (const entry of entries) {
      expect(entry.url.startsWith('https://nokmel.tech')).toBe(true);
      expect(entry.url).not.toContain('vercel');
    }
  });
});
