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

  it('evaluates metadata policy from the current runtime environment, not the PRE_LAUNCH snapshot', () => {
    const previousFlag = process.env.SITE_INDEXING_ENABLED;
    const previousEnv = process.env.VERCEL_ENV;
    try {
      process.env.SITE_INDEXING_ENABLED = '1';
      process.env.VERCEL_ENV = 'production';
      const published = pageMetadata({
        title: 'الميزات — نكمّل',
        description: 'وصف',
        path: '/features',
      });
      expect(published.robots).toEqual({ index: true, follow: true });
      const privateMetadata = pageMetadata({
        title: 'الإعدادات',
        description: 'وصف',
        path: '/admin/settings',
      });
      expect(privateMetadata.robots).toEqual({ index: false, follow: false });
    } finally {
      if (previousFlag === undefined) delete process.env.SITE_INDEXING_ENABLED;
      else process.env.SITE_INDEXING_ENABLED = previousFlag;
      if (previousEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousEnv;
    }
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
  const resolve = (overrides: Record<string, string | undefined> = {}) =>
    resolvePublicIndexingEnabled(overrides as unknown as NodeJS.ProcessEnv);

  it('is disabled without the explicit runtime flag', () => {
    expect(resolve({})).toBe(false);
    expect(resolve({ VERCEL_ENV: 'production' })).toBe(false);
    expect(resolve({ SITE_INDEXING_ENABLED: 'false', VERCEL_ENV: 'production' })).toBe(false);
  });

  it('never enables for Preview or development', () => {
    expect(resolve({ SITE_INDEXING_ENABLED: '1', VERCEL_ENV: 'preview' })).toBe(false);
    expect(resolve({ SITE_INDEXING_ENABLED: '1', VERCEL_ENV: 'development' })).toBe(false);
  });

  it('fails closed when deployment environment metadata is missing or unknown', () => {
    expect(resolve({ SITE_INDEXING_ENABLED: '1' })).toBe(false);
    expect(resolve({ SITE_INDEXING_ENABLED: '1', VERCEL_ENV: '' })).toBe(false);
    expect(resolve({ SITE_INDEXING_ENABLED: '1', VERCEL_ENV: 'staging' })).toBe(false);
    expect(resolve({ SITE_INDEXING_ENABLED: '1', VERCEL_ENV: 'PRODUCTION ' })).toBe(true);
  });

  it('enables only with the explicit flag plus verified Vercel Production', () => {
    expect(resolve({ SITE_INDEXING_ENABLED: '1', VERCEL_ENV: 'production' })).toBe(true);
    expect(resolve({ SITE_INDEXING_ENABLED: 'true', VERCEL_ENV: 'production' })).toBe(true);
  });

  it('keeps admin noindex under every indexing decision', () => {
    for (const indexing of [false, true]) {
      expect(robotsForPath('/admin', indexing)).toEqual({ index: false, follow: false });
      expect(robotsForPath('/admin/login', indexing)).toEqual({
        index: false,
        follow: false,
      });
      expect(robotsForPath('/features', indexing)).toEqual({
        index: indexing,
        follow: indexing,
      });
    }
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
