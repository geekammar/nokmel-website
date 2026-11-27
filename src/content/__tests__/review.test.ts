import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FAQ_FOR_RENDER,
  DEFAULT_FAQ_ITEMS,
  composePageContent,
  defaultSectionPayloads,
  type CmsFaqItem,
} from '@/content/cms/registry';
import { buildPublicationReview } from '@/content/cms/review';
import { SEO_PAGE_DEFAULTS } from '@/content/ar/seo';

function faq(id: string, question: string, visible = true): CmsFaqItem {
  return { id, question, answer: `إجابة ${question}`, visible };
}

const publishedFaq = [
  faq('a', 'السؤال أ'),
  faq('b', 'السؤال ب'),
  faq('c', 'السؤال ج'),
  faq('d', 'السؤال د'),
];

function buildFaqReview(draftFaq: CmsFaqItem[], published: CmsFaqItem[] = publishedFaq) {
  const content = composePageContent(
    'home',
    defaultSectionPayloads('home'),
    DEFAULT_FAQ_FOR_RENDER,
  );
  return buildPublicationReview({
    pageKey: 'home',
    draftContent: content,
    publishedContent: content,
    draftFaq,
    publishedFaq: published,
    seo: null,
    revision: 2,
    publishedRevision: 1,
    lastPublishedAt: null,
    publishedSource: 'published',
  });
}

function visibleIds(review: ReturnType<typeof buildFaqReview>): string[] {
  return review.faq?.finalVisibleOrder.map((item) => item.id) ?? [];
}

describe('FAQ publication review final order (NKW-W32-005)', () => {
  it('reports a pure reorder of existing questions', () => {
    const review = buildFaqReview([publishedFaq[2], publishedFaq[0], publishedFaq[1], publishedFaq[3]]);
    expect(review.faq?.changed).toBe(true);
    expect(review.faq?.reordered).toBe(true);
    expect(review.faq?.added).toEqual([]);
    expect(review.faq?.removed).toEqual([]);
    expect(visibleIds(review)).toEqual(['c', 'a', 'b', 'd']);
    expect(review.faq?.finalVisibleOrder.map((item) => item.position)).toEqual([1, 2, 3, 4]);
  });

  it('shows the intended final position of a question inserted in the middle', () => {
    const inserted = faq('x', 'سؤال جديد في المنتصف');
    const review = buildFaqReview([
      publishedFaq[0],
      publishedFaq[1],
      inserted,
      publishedFaq[2],
      publishedFaq[3],
    ]);
    expect(review.faq?.added).toEqual([
      {
        id: 'x',
        question: 'سؤال جديد في المنتصف',
        position: 3,
        visiblePosition: 3,
        visible: true,
      },
    ]);
    expect(review.faq?.removed).toEqual([]);
    expect(visibleIds(review)).toEqual(['a', 'b', 'x', 'c', 'd']);
    expect(
      review.faq?.finalVisibleOrder.find((item) => item.id === 'x')?.position,
    ).toBe(3);
  });

  it('shows removal positions and shifts later final visible positions', () => {
    const review = buildFaqReview([publishedFaq[1], publishedFaq[2], publishedFaq[3]]);
    expect(review.faq?.removed).toEqual([
      { id: 'a', question: 'السؤال أ', position: 1, visiblePosition: 1 },
    ]);
    expect(visibleIds(review)).toEqual(['b', 'c', 'd']);
    expect(review.faq?.finalVisibleOrder.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it('combines addition, removal and reorder into one final visible order', () => {
    const inserted = faq('x', 'سؤال مضاف');
    const review = buildFaqReview([
      publishedFaq[3],
      inserted,
      publishedFaq[0],
      publishedFaq[2],
    ]);
    expect(review.faq?.added.map((item) => item.id)).toEqual(['x']);
    expect(review.faq?.removed.map((item) => item.id)).toEqual(['b']);
    expect(review.faq?.reordered).toBe(true);
    expect(visibleIds(review)).toEqual(['d', 'x', 'a', 'c']);
  });

  it('excludes hidden questions from the final visible public order', () => {
    const hidden = faq('b', 'السؤال ب', false);
    const review = buildFaqReview([publishedFaq[0], hidden, publishedFaq[2], publishedFaq[3]]);
    expect(visibleIds(review)).toEqual(['a', 'c', 'd']);
    expect(review.faq?.finalVisibleOrder.some((item) => item.id === 'b')).toBe(false);
    expect(review.faq?.hidden).toEqual([
      { id: 'b', question: 'السؤال ب', position: 2 },
    ]);
    expect(review.faq?.visibilityChanged).toEqual([
      { id: 'b', question: 'السؤال ب', before: true, after: false },
    ]);
  });

  it('separates editor positions from visitor positions when hidden items exist (NKW-W33-001)', () => {
    const hiddenDraft = faq('b', 'السؤال ب', false);
    const inserted = faq('x', 'سؤال مضاف بعد المخفي');
    const review = buildFaqReview([
      publishedFaq[0],
      hiddenDraft,
      inserted,
      publishedFaq[2],
      publishedFaq[3],
    ]);
    expect(review.faq?.added).toEqual([
      {
        id: 'x',
        question: 'سؤال مضاف بعد المخفي',
        position: 3,
        visiblePosition: 2,
        visible: true,
      },
    ]);
    expect(review.faq?.hidden).toEqual([
      { id: 'b', question: 'السؤال ب', position: 2 },
    ]);
    expect(visibleIds(review)).toEqual(['a', 'x', 'c', 'd']);
  });

  it('does not assign a visitor position to a hidden removal', () => {
    const publishedWithHidden = [
      publishedFaq[0],
      faq('b', 'السؤال ب', false),
      publishedFaq[2],
      publishedFaq[3],
    ];
    const review = buildFaqReview([publishedFaq[0], publishedFaq[2], publishedFaq[3]], publishedWithHidden);
    expect(review.faq?.removed).toEqual([
      { id: 'b', question: 'السؤال ب', position: 2, visiblePosition: null },
    ]);
  });

  it('reports no FAQ ordering changes when only page text changes', () => {
    const draftPayloads = defaultSectionPayloads('home');
    const draftContent = composePageContent(
      'home',
      draftPayloads,
      DEFAULT_FAQ_FOR_RENDER,
    );
    const changedContent = {
      ...draftContent,
      hero: { ...draftContent.hero, tagline: 'شعار جديد' },
    };
    const review = buildPublicationReview({
      pageKey: 'home',
      draftContent: changedContent,
      publishedContent: draftContent,
      draftFaq: publishedFaq,
      publishedFaq,
      seo: null,
      revision: 2,
      publishedRevision: 1,
      lastPublishedAt: null,
      publishedSource: 'published',
    });
    expect(review.faq?.changed).toBe(false);
    expect(review.faq?.reordered).toBe(false);
    expect(visibleIds(review)).toEqual(['a', 'b', 'c', 'd']);
    expect(review.hasChanges).toBe(true);
    expect(review.sections.map((section) => section.key)).toEqual(['hero']);
  });

  it('keeps before/after wording changes visible alongside final order', () => {
    const edited = { ...faq('b', 'السؤال ب المعدّل'), answer: 'إجابة السؤال ب' };
    const review = buildFaqReview([publishedFaq[0], edited, publishedFaq[2], publishedFaq[3]]);
    expect(review.faq?.edited).toEqual([
      {
        id: 'b',
        question: 'السؤال ب المعدّل',
        changes: [
          {
            field: 'question',
            before: 'السؤال ب',
            after: 'السؤال ب المعدّل',
          },
        ],
      },
    ]);
    expect(visibleIds(review)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('showcase visibility publication review', () => {
  it('reports hidden to visible and visible to hidden changes clearly', () => {
    const hiddenPayloads = defaultSectionPayloads('home');
    const visiblePayloads = structuredClone(hiddenPayloads);
    visiblePayloads.showcase.visible = true;
    const hiddenContent = composePageContent(
      'home',
      hiddenPayloads,
      DEFAULT_FAQ_FOR_RENDER,
    );
    const visibleContent = composePageContent(
      'home',
      visiblePayloads,
      DEFAULT_FAQ_FOR_RENDER,
    );
    const base = {
      pageKey: 'home' as const,
      draftFaq: DEFAULT_FAQ_ITEMS.map((item) => ({ ...item })),
      publishedFaq: DEFAULT_FAQ_ITEMS.map((item) => ({ ...item })),
      seo: null,
      revision: 2,
      publishedRevision: 1,
      lastPublishedAt: null,
      publishedSource: 'published' as const,
    };

    const show = buildPublicationReview({
      ...base,
      draftContent: visibleContent,
      publishedContent: hiddenContent,
    });
    expect(show.sections).toEqual([
      {
        key: 'showcase',
        label: 'العرض المفاهيمي',
        fields: [
          {
            path: 'showcase.visible',
            label: 'إظهار عرض تجربة المنتج',
            before: 'مخفي',
            after: 'ظاهر',
          },
        ],
      },
    ]);
    expect(show.hasChanges).toBe(true);

    const hide = buildPublicationReview({
      ...base,
      draftContent: hiddenContent,
      publishedContent: visibleContent,
    });
    expect(hide.sections[0]?.fields[0]).toMatchObject({
      before: 'ظاهر',
      after: 'مخفي',
    });

    const unchanged = buildPublicationReview({
      ...base,
      draftContent: hiddenContent,
      publishedContent: hiddenContent,
    });
    expect(unchanged.sections).toEqual([]);
    expect(unchanged.hasChanges).toBe(false);
  });
});

describe('SEO publication review', () => {
  const content = composePageContent(
    'home',
    defaultSectionPayloads('home'),
    DEFAULT_FAQ_FOR_RENDER,
  );

  it('reports SEO and inherited social changes against published values', () => {
    const review = buildPublicationReview({
      pageKey: 'home',
      draftContent: content,
      publishedContent: content,
      draftFaq: DEFAULT_FAQ_ITEMS.map((item) => ({ ...item })),
      publishedFaq: DEFAULT_FAQ_ITEMS.map((item) => ({ ...item })),
      seo: {
        draft: {
          title: 'عنوان SEO جديد',
          description: 'وصف SEO جديد.',
        },
        published: null,
      },
      revision: 1,
      publishedRevision: null,
      lastPublishedAt: null,
      publishedSource: 'defaults',
    });
    expect(review.seo?.changed).toBe(true);
    expect(review.seo?.fields.map((field) => field.key)).toEqual([
      'title',
      'description',
      'socialTitle',
      'socialDescription',
    ]);
    expect(review.seo?.fields.slice(2)).toEqual([
      expect.objectContaining({
        before: 'نكمّل — متجرك في المحادثة. وبزنسك في مكان واحد.',
        after: 'عنوان SEO جديد',
        inheritedAfter: true,
      }),
      expect.objectContaining({
        before: expect.any(String),
        after: 'وصف SEO جديد.',
        inheritedAfter: true,
      }),
    ]);
    expect(review.hasChanges).toBe(true);
  });

  it('does not report SEO changes when the draft matches effective published metadata', () => {
    const review = buildPublicationReview({
      pageKey: 'pricing',
      draftContent: composePageContent(
        'pricing',
        defaultSectionPayloads('pricing'),
        DEFAULT_FAQ_FOR_RENDER,
      ),
      publishedContent: composePageContent(
        'pricing',
        defaultSectionPayloads('pricing'),
        DEFAULT_FAQ_FOR_RENDER,
      ),
      draftFaq: null,
      publishedFaq: null,
      seo: {
        draft: {
          title: SEO_PAGE_DEFAULTS.pricing.title,
          description: SEO_PAGE_DEFAULTS.pricing.description,
        },
        published: null,
      },
      revision: 1,
      publishedRevision: null,
      lastPublishedAt: null,
      publishedSource: 'defaults',
    });
    expect(review.hasChanges).toBe(false);
    expect(review.seo?.changed).toBe(false);
  });
});
