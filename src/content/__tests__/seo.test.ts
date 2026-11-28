import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SEO_PAGE_DEFAULTS } from '@/content/ar/seo';
import {
  CMS_SEO_LIMITS,
  buildSeoPayloadFromForm,
  getPageSeoDefaults,
  parseStoredSeo,
  resolveEffectiveSeo,
  seoFormValuesFromStored,
  seoStoredSchema,
} from '@/content/cms/seo';
import { CMS_PAGE_KEYS, getPageDefinition } from '@/content/cms/registry';
import { SOCIAL_IMAGES } from '@/content/cms/social-images';
import { PRE_LAUNCH, pageMetadataForSeo } from '@/lib/seo';
import { site, siteUrl } from '@/lib/site';

function validForm() {
  return {
    title: 'عنوان SEO مخصص',
    description: 'وصف SEO مخصص يوضح محتوى الصفحة للزوار.',
    socialTitle: '',
    socialDescription: '',
    socialImage: '',
  };
}

function pngDimensions(filePath: string): { width: number; height: number } {
  const buffer = readFileSync(filePath);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('typed page SEO model', () => {
  it('accepts required fields and optional social overrides', () => {
    const payload = buildSeoPayloadFromForm({
      ...validForm(),
      socialTitle: 'عنوان المشاركة',
      socialDescription: 'وصف المشاركة',
      socialImage: 'mark-transparent-512',
    });
    expect(payload).toEqual({
      title: 'عنوان SEO مخصص',
      description: 'وصف SEO مخصص يوضح محتوى الصفحة للزوار.',
      socialTitle: 'عنوان المشاركة',
      socialDescription: 'وصف المشاركة',
      socialImage: 'mark-transparent-512',
    });
    expect(parseStoredSeo(payload)).toEqual({ ok: true, value: payload });
  });

  it('rejects required empty fields and unknown fields', () => {
    expect(() => buildSeoPayloadFromForm({ ...validForm(), title: '   ' })).toThrow();
    expect(() => buildSeoPayloadFromForm({ ...validForm(), description: '' })).toThrow();
    expect(() =>
      buildSeoPayloadFromForm({ ...validForm(), keywords: 'كلمات' }),
    ).toThrow();
    expect(seoStoredSchema.safeParse({ ...validForm(), unexpected: true }).success).toBe(false);
  });

  it('normalizes whitespace-only optional overrides to unset', () => {
    const payload = buildSeoPayloadFromForm({
      title: '  عنوان مُقلّم  ',
      description: '  وصف مُقلّم  ',
      socialTitle: '   ',
      socialDescription: '\n\t',
      socialImage: '',
    });
    expect(payload).toEqual({
      title: 'عنوان مُقلّم',
      description: 'وصف مُقلّم',
    });
    expect('socialTitle' in payload).toBe(false);
    expect('socialDescription' in payload).toBe(false);
    expect('socialImage' in payload).toBe(false);
  });

  it('enforces storage safety limits without treating them as ranking advice', () => {
    expect(() =>
      buildSeoPayloadFromForm({ ...validForm(), title: 'ا'.repeat(CMS_SEO_LIMITS.title + 1) }),
    ).toThrow();
    expect(() =>
      buildSeoPayloadFromForm({
        ...validForm(),
        description: 'ا'.repeat(CMS_SEO_LIMITS.description + 1),
      }),
    ).toThrow();
    expect(() =>
      buildSeoPayloadFromForm({
        ...validForm(),
        socialTitle: 'ا'.repeat(CMS_SEO_LIMITS.title + 1),
      }),
    ).toThrow();
    expect(() =>
      buildSeoPayloadFromForm({
        ...validForm(),
        socialDescription: 'ا'.repeat(CMS_SEO_LIMITS.description + 1),
      }),
    ).toThrow();
    expect(
      buildSeoPayloadFromForm({ ...validForm(), title: 'ا'.repeat(CMS_SEO_LIMITS.title) }).title,
    ).toHaveLength(CMS_SEO_LIMITS.title);
  });

  it('rejects malformed image identifiers and arbitrary image URLs', () => {
    expect(() =>
      buildSeoPayloadFromForm({ ...validForm(), socialImage: 'not-an-asset' }),
    ).toThrow();
    expect(() =>
      buildSeoPayloadFromForm({
        ...validForm(),
        socialImage: 'https://attacker.example/image.png',
      }),
    ).toThrow();
    expect(() =>
      buildSeoPayloadFromForm({ ...validForm(), socialImage: '/brand/other.png' }),
    ).toThrow();
  });

  it('rejects unsupported page keys for defaults', () => {
    expect(() => getPageSeoDefaults('blog' as never)).toThrow();
    for (const pageKey of CMS_PAGE_KEYS) {
      expect(getPageSeoDefaults(pageKey)).toEqual(SEO_PAGE_DEFAULTS[pageKey]);
    }
  });
});

describe('SEO fallback and inheritance', () => {
  it('falls back to approved page metadata when no published override exists', () => {
    for (const pageKey of CMS_PAGE_KEYS) {
      const effective = resolveEffectiveSeo(pageKey, null);
      expect(effective.title).toBe(SEO_PAGE_DEFAULTS[pageKey].title);
      expect(effective.description).toBe(SEO_PAGE_DEFAULTS[pageKey].description);
      expect(effective.socialTitle).toBe(effective.title);
      expect(effective.socialDescription).toBe(effective.description);
      expect(effective.socialTitleInherited).toBe(true);
      expect(effective.socialDescriptionInherited).toBe(true);
      expect(effective.socialImageId).toBe('social-card-1200x630');
    }
  });

  it('inherits missing social values from effective SEO values', () => {
    const effective = resolveEffectiveSeo('features', {
      title: 'عنوان جديد للميزات',
      description: 'وصف جديد للميزات.',
      socialImage: 'app-icon-light-512',
    });
    expect(effective.socialTitle).toBe('عنوان جديد للميزات');
    expect(effective.socialDescription).toBe('وصف جديد للميزات.');
    expect(effective.socialTitleInherited).toBe(true);
    expect(effective.socialDescriptionInherited).toBe(true);
    expect(effective.image.path).toBe('/brand/icons/app-icon-light-512.png');
  });

  it('uses explicit social overrides independently', () => {
    const effective = resolveEffectiveSeo('home', {
      title: 'عنوان',
      description: 'وصف',
      socialTitle: 'عنوان المشاركة',
      socialDescription: 'وصف المشاركة',
      socialImage: 'mark-transparent-512',
    });
    expect(effective.socialTitle).toBe('عنوان المشاركة');
    expect(effective.socialDescription).toBe('وصف المشاركة');
    expect(effective.socialTitleInherited).toBe(false);
    expect(effective.socialDescriptionInherited).toBe(false);
    expect(effective.socialImageId).toBe('mark-transparent-512');
  });

  it('builds editor values from published overrides and defaults', () => {
    expect(seoFormValuesFromStored('pricing', null)).toEqual({
      title: SEO_PAGE_DEFAULTS.pricing.title,
      description: SEO_PAGE_DEFAULTS.pricing.description,
      socialTitle: '',
      socialDescription: '',
      socialImage: '',
    });
    expect(
      seoFormValuesFromStored('pricing', {
        title: 'عنوان',
        description: 'وصف',
        socialTitle: 'مشاركة',
        socialImage: 'app-icon-dark-512',
      }),
    ).toEqual({
      title: 'عنوان',
      description: 'وصف',
      socialTitle: 'مشاركة',
      socialDescription: '',
      socialImage: 'app-icon-dark-512',
    });
  });
});

describe('public metadata from validated SEO', () => {
  it('preserves canonical domain, actual route, noindex and nofollow', () => {
    for (const pageKey of CMS_PAGE_KEYS) {
      const metadata = pageMetadataForSeo(pageKey, resolveEffectiveSeo(pageKey, null));
      const page = getPageDefinition(pageKey);
      expect(metadata.title).toEqual({ absolute: SEO_PAGE_DEFAULTS[pageKey].title });
      expect(metadata.description).toBe(SEO_PAGE_DEFAULTS[pageKey].description);
      expect(metadata.alternates?.canonical).toBe(page.path);
      expect(metadata.robots).toEqual(PRE_LAUNCH ? { index: false, follow: false } : { index: true, follow: true });
      expect(metadata.openGraph?.url).toBe(`${siteUrl}${page.path === '/' ? '' : page.path}`);
      expect(metadata.openGraph?.images).toEqual([
        expect.objectContaining({
          url: `${siteUrl}/brand/social/nokmel-social-card-1200x630.png`,
          width: 1200,
          height: 630,
        }),
      ]);
      expect(JSON.stringify(metadata)).not.toContain('vercel');
    }
  });

  it('derives Open Graph and Twitter values from effective social metadata', () => {
    const seo = resolveEffectiveSeo('join', {
      title: 'عنوان SEO',
      description: 'وصف SEO',
      socialTitle: 'عنوان المشاركة',
      socialDescription: 'وصف المشاركة',
      socialImage: 'app-icon-light-512',
    });
    const metadata = pageMetadataForSeo('join', seo);
    expect(metadata.openGraph).toMatchObject({
      title: 'عنوان المشاركة',
      description: 'وصف المشاركة',
      siteName: 'Nokmel',
      locale: 'ar_AR',
      type: 'website',
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'عنوان المشاركة',
      description: 'وصف المشاركة',
    });
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({
        url: `${siteUrl}/brand/icons/app-icon-light-512.png`,
        width: 512,
        height: 512,
      }),
    ]);
    expect(metadata.twitter?.images).toEqual([
      `${siteUrl}/brand/icons/app-icon-light-512.png`,
    ]);
    expect(site.domain).toBe('nokmel.tech');
  });

  it('treats stored SEO strings as plain text and escapes markup', () => {
    const rawTitle = '<script>alert(1)</script>';
    const rawDescription = '<img src=x onerror=alert(2)>';
    const metadata = pageMetadataForSeo(
      'home',
      resolveEffectiveSeo('home', {
        title: rawTitle,
        description: rawDescription,
      }),
    );
    expect(metadata.title).toEqual({ absolute: rawTitle });
    expect(metadata.description).toBe(rawDescription);
    expect(metadata.openGraph?.title).toBe(rawTitle);
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement('title', null, rawTitle),
        createElement('meta', { name: 'description', content: rawDescription }),
      ),
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;img src=x onerror=alert(2)&gt;');
    expect(html).not.toContain('<img src=x');
  });
});

describe('approved social image registry', () => {
  it('uses only existing approved PNG assets with actual dimensions', () => {
    expect(SOCIAL_IMAGES.length).toBeGreaterThan(0);
    for (const asset of SOCIAL_IMAGES) {
      const filePath = path.join(process.cwd(), 'public', asset.path);
      expect(existsSync(filePath)).toBe(true);
      expect(pngDimensions(filePath)).toEqual({ width: asset.width, height: asset.height });
      expect(asset.path.startsWith('/brand/')).toBe(true);
      expect(asset.alt.length).toBeGreaterThan(0);
    }
    expect(SOCIAL_IMAGES.some((asset) => asset.id === 'mark-transparent-1024')).toBe(true);
    expect(
      SOCIAL_IMAGES.some(
        (asset) =>
          asset.id === 'social-card-1200x630' &&
          asset.width === 1200 &&
          asset.height === 630,
      ),
    ).toBe(true);
  });
});
