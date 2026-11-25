import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaqSection } from '@/components/sections/Faq';
import {
  CMS_MAX_EDITABLE_JSON_BYTES,
  CMS_PAGE_KEYS,
  DEFAULT_FAQ_FOR_RENDER,
  DEFAULT_FAQ_ITEMS,
  assertCmsLocale,
  assertCmsPageKey,
  assertEditablePayloadSize,
  buildSectionPayloads,
  cmsFaqItemsInputSchema,
  composePageContent,
  defaultSectionPayloads,
  extractPageValues,
  getSectionDefinition,
  pageEditableSchema,
  type CmsPageContent,
  type CmsPageKey,
} from '@/content/cms/registry';

function defaultContent<K extends CmsPageKey>(pageKey: K): CmsPageContent[K] {
  return composePageContent(
    pageKey,
    defaultSectionPayloads(pageKey),
    DEFAULT_FAQ_FOR_RENDER,
  ) as CmsPageContent[K];
}

describe('CMS content registry', () => {
  it('provides explicitly supported pages and locales', () => {
    expect([...CMS_PAGE_KEYS]).toEqual([
      'home',
      'features',
      'pricing',
      'join',
      'contact',
      'privacy',
      'terms',
    ]);
    for (const pageKey of CMS_PAGE_KEYS) {
      expect(assertCmsPageKey(pageKey)).toBe(pageKey);
    }
    expect(() => assertCmsPageKey('blog')).toThrow();
    expect(assertCmsLocale('ar')).toBe('ar');
    expect(() => assertCmsLocale('en')).toThrow();
    expect(() => assertCmsLocale('ar-SA')).toThrow();
  });

  it('validates every approved default page against its public contract', () => {
    for (const pageKey of CMS_PAGE_KEYS) {
      const content = defaultContent(pageKey);
      expect(content).toBeTruthy();
    }
    const home = defaultContent('home');
    expect(home.hero.headline).toBe('متجرك في المحادثة. وبزنسك في مكان واحد.');
    expect(home.hero.primaryCta.href).toBe('/join');
    expect(home.faq.items).toHaveLength(DEFAULT_FAQ_ITEMS.length);
  });

  it('keeps registry sections aligned with default payload sections', () => {
    for (const pageKey of CMS_PAGE_KEYS) {
      const payloads = defaultSectionPayloads(pageKey);
      const content = defaultContent(pageKey);
      const values = extractPageValues(pageKey, content);
      expect(Object.keys(values).sort()).toEqual(Object.keys(payloads).sort());
    }
  });

  it('rejects unknown sections and preserves approved structural fields', () => {
    expect(() => getSectionDefinition('home', 'unknown')).toThrow();
    const values = extractPageValues('home', defaultContent('home'));
    const payloads = buildSectionPayloads('home', values);
    const hero = payloads.hero as {
      primaryCta: { href: string; label: string };
      secondaryCta: { href: string; label: string };
    };
    expect(hero.primaryCta.href).toBe('/join');
    expect(hero.secondaryCta.href).toBe('#how-it-works');

    const capabilities = payloads.capabilities as {
      items: { status: string; groupTitle: string }[];
    };
    expect(capabilities.items.map((item) => item.status)).toEqual(
      defaultContent('home').capabilities.items.map((item) => item.status),
    );
  });

  it('rejects extra editable fields such as links, images and status overrides', () => {
    const values = extractPageValues('home', defaultContent('home'));
    const withHref = structuredClone(values);
    (withHref.hero.primaryCta as Record<string, unknown>).href = 'javascript:alert(1)';
    expect(() => buildSectionPayloads('home', withHref)).toThrow();

    const withImage = structuredClone(values);
    (withImage.hero as Record<string, unknown>).image = '/brand/other.svg';
    expect(() => buildSectionPayloads('home', withImage)).toThrow();

    const withStatus = structuredClone(values);
    (withStatus.capabilities.items as Record<string, unknown>[])[0].status = 'available';
    expect(() => buildSectionPayloads('home', withStatus)).toThrow();
  });

  it('rejects unsafe hrefs and capability-status tampering in stored payloads', () => {
    const unsafeHero = defaultSectionPayloads('home');
    (unsafeHero.hero as { primaryCta: { href: string } }).primaryCta.href =
      'javascript:alert(1)';
    expect(() =>
      composePageContent('home', unsafeHero, DEFAULT_FAQ_FOR_RENDER),
    ).toThrow();

    const falseCapability = defaultSectionPayloads('home');
    (
      falseCapability.capabilities as { items: { status: string }[] }
    ).items[0].status = 'available';
    expect(() =>
      composePageContent('home', falseCapability, DEFAULT_FAQ_FOR_RENDER),
    ).toThrow();

    const externalCta = defaultSectionPayloads('pricing');
    (externalCta.cta as { secondaryCta: { href: string } }).secondaryCta.href =
      'https://attacker.example';
    expect(() =>
      composePageContent('pricing', externalCta, DEFAULT_FAQ_FOR_RENDER),
    ).toThrow();
  });

  it('cannot activate or restructure the disabled join form', () => {
    const payloads = defaultSectionPayloads('join');
    (payloads.form as Record<string, unknown>).fields = [
      { id: 'evil', name: 'evil', label: 'Evil', type: 'text', required: false },
    ];
    const content = composePageContent('join', payloads, DEFAULT_FAQ_FOR_RENDER);
    expect(content.fields).toHaveLength(4);
    expect(content.fields.map((field) => field.id)).toEqual([
      'join-name',
      'join-phone',
      'join-email',
      'join-activity',
    ]);
    expect(content.submit.hint.length).toBeGreaterThan(0);
  });

  it('rejects oversized input and payloads', () => {
    const values = extractPageValues('home', defaultContent('home'));
    (values.hero as Record<string, unknown>).headline = 'ا'.repeat(500);
    expect(() => buildSectionPayloads('home', values)).toThrow();

    expect(() =>
      assertEditablePayloadSize({ value: 'x'.repeat(CMS_MAX_EDITABLE_JSON_BYTES) }),
    ).toThrow();
  });

  it('validates FAQ item limits and stable identifiers', () => {
    const items = DEFAULT_FAQ_ITEMS.map(({ id, question, answer, visible }) => ({
      id,
      question,
      answer,
      visible,
    }));
    expect(cmsFaqItemsInputSchema.parse(items)).toHaveLength(items.length);
    expect(() => cmsFaqItemsInputSchema.parse([])).toThrow();
    expect(() =>
      cmsFaqItemsInputSchema.parse([
        { question: 'س', answer: 'ج', visible: true, id: 'bad id' },
      ]),
    ).toThrow();
    expect(() =>
      cmsFaqItemsInputSchema.parse([
        { question: '', answer: 'ج', visible: true },
      ]),
    ).toThrow();
  });

  it('renders editor-provided HTML as escaped text, never executable markup', () => {
    const html = renderToStaticMarkup(
      <FaqSection
        title="أسئلة"
        items={[
          {
            question: '<script>alert(1)</script>',
            answer: '<img src=x onerror=alert(2)>',
          },
        ]}
      />,
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
  });

  it('defines the editable schema strictly for every page', () => {
    for (const pageKey of CMS_PAGE_KEYS) {
      const values = extractPageValues(pageKey, defaultContent(pageKey));
      expect(pageEditableSchema(pageKey).safeParse(values).success).toBe(true);
      expect(
        pageEditableSchema(pageKey).safeParse({ ...values, unexpected: 'value' }).success,
      ).toBe(false);
    }
  });
});

describe('published content fallback without CMS configuration', () => {
  it('returns approved defaults when DATABASE_URL is absent', async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { getPublishedPageContent } = await import('@/lib/cms/service');
      const content = await getPublishedPageContent('home', 'ar');
      expect(content.hero.headline).toBe('متجرك في المحادثة. وبزنسك في مكان واحد.');
      expect(content.faq.items).toHaveLength(DEFAULT_FAQ_ITEMS.length);
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
