import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRE_LAUNCH, pageMetadata } from '@/lib/seo';

describe('page metadata and pre-launch indexing safety', () => {
  it('keeps the pre-launch barrier enabled', () => {
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

  it('builds canonical URLs from the approved target domain, not a deployment domain', () => {
    const metadata = pageMetadata({
      title: 'الأسعار — نكمّل',
      description: 'وصف',
      path: '/pricing',
    });
    expect(metadata.alternates?.canonical).toBe('/pricing');
    expect(JSON.stringify(metadata)).not.toContain('vercel');
    const siteLib = readFileSync(path.join(process.cwd(), 'src/lib/site.ts'), 'utf8');
    expect(siteLib).toContain('nokmel.tech');
    expect(siteLib).not.toContain('vercel.app');
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
  });

  it('disallows crawlers in robots.txt while pre-launch and documents the launch step', () => {
    const robots = readFileSync(path.join(process.cwd(), 'public/robots.txt'), 'utf8');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /');
    expect(robots).toContain('PRE_LAUNCH');
  });

  it('documents how future indexing becomes an intentional launch step', () => {
    const seo = readFileSync(path.join(process.cwd(), 'src/lib/seo.ts'), 'utf8');
    expect(seo).toContain('PRE_LAUNCH = true');
    expect(seo).toContain('launch');
  });
});
