import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { join } from '@/content/ar/join';
import {
  DEFAULT_FAQ_FOR_RENDER,
  DEFAULT_FAQ_ITEMS,
  composePageContent,
  defaultSectionPayloads,
  extractPageValues,
  type CmsFaqItem,
} from '@/content/cms/registry';
import { CmsConflictError, CmsNoDraftError } from '@/lib/cms/errors';
import {
  getEditorPageData,
  getPreviewPageContent,
  getPublicationReview,
  getPublishedPageContent,
  publishPageContent,
  savePageDraft,
} from '@/lib/cms/service';
import { applyMigrations, emptyDatabase, getDisposablePostgres } from './helpers';

const pg = await getDisposablePostgres();

beforeAll(async () => {
  await applyMigrations(pg);
});

beforeEach(async () => {
  await emptyDatabase(pg);
});

afterAll(async () => {
  await pg.stop();
});

const DEFAULT_HEADLINE = 'متجرك في المحادثة. وإدارة طلباتك في مكان واحد.';

type FaqInput = { id?: string; question: string; answer: string; visible: boolean };

function defaultFaqInput(): FaqInput[] {
  return DEFAULT_FAQ_ITEMS.map(({ id, question, answer, visible }) => ({
    id,
    question,
    answer,
    visible,
  }));
}

function homeDraftValues(headline: string) {
  const content = composePageContent(
    'home',
    defaultSectionPayloads('home'),
    DEFAULT_FAQ_FOR_RENDER,
  );
  const values = extractPageValues('home', content);
  (values.hero as Record<string, unknown>).headline = headline;
  return values;
}

async function saveHome(
  revision: number,
  headline: string,
  faqItems: FaqInput[] = defaultFaqInput(),
  mutate?: (values: ReturnType<typeof homeDraftValues>) => void,
) {
  const values = homeDraftValues(headline);
  mutate?.(values);
  return savePageDraft(
    {
      pageKey: 'home',
      locale: 'ar',
      expectedRevision: revision,
      values,
      faqItems,
    },
    { db: pg.db },
  );
}

async function publishHome(revision: number) {
  return publishPageContent(
    { pageKey: 'home', locale: 'ar', expectedRevision: revision },
    { db: pg.db },
  );
}

function faqRenderPairs(items: readonly CmsFaqItem[]) {
  return items.map(({ question, answer }) => ({ question, answer }));
}

function faqInputPairs(items: readonly FaqInput[]) {
  return items.map(({ question, answer }) => ({ question, answer }));
}

describe('effective content parity', () => {
  test('Scenario A: empty CMS database gives identical defaults to public, editor and preview', async () => {
    const publicHome = await getPublishedPageContent('home', 'ar', { db: pg.db });
    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    const preview = await getPreviewPageContent('home', 'ar', { db: pg.db });

    const expectedFaq = DEFAULT_FAQ_ITEMS.map(({ question, answer }) => ({
      question,
      answer,
    }));
    expect(publicHome.faq.items).toEqual(expectedFaq);
    expect(preview.faq.items).toEqual(expectedFaq);
    expect(editor.status).toBe('ok');
    if (editor.status === 'ok') {
      expect(editor.data.faqItems?.map(({ question, answer }) => ({ question, answer }))).toEqual(
        expectedFaq,
      );
      expect(editor.data.publishedRevision).toBeNull();
      expect(editor.data.hasDraft).toBe(false);
    }
  });

  test('Scenario E: join field structure is code-controlled and identical on public and preview', async () => {
    const publicJoin = await getPublishedPageContent('join', 'ar', { db: pg.db });
    const previewJoin = await getPreviewPageContent('join', 'ar', { db: pg.db });
    expect(publicJoin.fields).toEqual(join.fields);
    expect(previewJoin.fields).toEqual(join.fields);

    const content = composePageContent(
      'join',
      defaultSectionPayloads('join'),
      DEFAULT_FAQ_FOR_RENDER,
    );
    const values = extractPageValues('join', content);
    (values.hero as Record<string, unknown>).lead = 'مقدمة انضمام منشورة للاختبار.';
    await savePageDraft(
      { pageKey: 'join', locale: 'ar', expectedRevision: 0, values },
      { db: pg.db },
    );
    await publishPageContent(
      { pageKey: 'join', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );

    const afterPublish = await getPublishedPageContent('join', 'ar', { db: pg.db });
    const previewAfter = await getPreviewPageContent('join', 'ar', { db: pg.db });
    expect(afterPublish.hero.lead).toBe('مقدمة انضمام منشورة للاختبار.');
    expect(afterPublish.fields).toEqual(join.fields);
    expect(previewAfter.fields).toEqual(join.fields);
  });
});

describe('published content preservation', () => {
  test('Scenario B: changing only the tagline preserves existing published FAQ exactly', async () => {
    const customFaq = defaultFaqInput().map((item, index) =>
      index === 0
        ? item
        : {
            ...item,
            answer: `إجابة منشورة مخصصة ${index + 1} — يجب ألا تتغير عند نشر الشعار فقط.`,
          },
    );
    await saveHome(0, 'عنوان منشور أول', customFaq);
    await publishHome(1);

    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status !== 'ok') return;
    expect(editor.data.faqItems?.map(({ question, answer, visible }) => ({ question, answer, visible }))).toEqual(
      customFaq.map(({ question, answer, visible }) => ({ question, answer, visible })),
    );
    expect(editor.data.publishedRevision).toBe(1);

    const values = structuredClone(editor.data.values);
    (values.hero as Record<string, unknown>).tagline = 'شعار جديد من الاختبار';
    const saved = await savePageDraft(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1, values, faqItems: customFaq },
      { db: pg.db },
    );
    expect(saved.revision).toBe(2);

    const review = await getPublicationReview(
      { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
      { db: pg.db },
    );
    expect(review.publishedSource).toBe('published');
    expect(review.publishedRevision).toBe(1);
    expect(review.sections).toHaveLength(1);
    expect(review.sections[0].key).toBe('hero');
    expect(review.sections[0].fields.map((field) => field.path)).toEqual(['hero.tagline']);
    expect(review.sections[0].fields[0].before).toBe('خلي بزنسك يكمل.');
    expect(review.sections[0].fields[0].after).toBe('شعار جديد من الاختبار');
    expect(review.faq?.changed).toBe(false);

    await publishHome(2);
    const publicHome = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicHome.hero.tagline).toBe('شعار جديد من الاختبار');
    expect(publicHome.faq.items).toEqual(faqInputPairs(customFaq));
  });

  test('Scenario C: unrelated published homepage sections retain their overrides', async () => {
    await saveHome(0, 'عنوان منشور ثابت', defaultFaqInput(), (values) => {
      (values.finalCta as Record<string, unknown>).title = 'ختام منشور ثابت';
    });
    await publishHome(1);

    const publishedBefore = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publishedBefore.hero.headline).toBe('عنوان منشور ثابت');
    expect(publishedBefore.finalCta.title).toBe('ختام منشور ثابت');

    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status !== 'ok') return;
    const values = structuredClone(editor.data.values);
    (values.problems as Record<string, unknown>).title = 'عنوان مشكلات جديد فقط';
    await savePageDraft(
      {
        pageKey: 'home',
        locale: 'ar',
        expectedRevision: 1,
        values,
        faqItems: defaultFaqInput(),
      },
      { db: pg.db },
    );
    await publishHome(2);

    const publishedAfter = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publishedAfter.hero.headline).toBe('عنوان منشور ثابت');
    expect(publishedAfter.finalCta.title).toBe('ختام منشور ثابت');
    expect(publishedAfter.problems.title).toBe('عنوان مشكلات جديد فقط');
    expect(publishedAfter.faq.items).toEqual(faqRenderPairs(
      DEFAULT_FAQ_ITEMS.map((item) => ({ ...item })),
    ));
  });
});

describe('publication review', () => {
  test('first publication reviews against approved defaults', async () => {
    await saveHome(0, 'عنوان أول نشر', defaultFaqInput());
    const review = await getPublicationReview(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    expect(review.publishedSource).toBe('defaults');
    expect(review.publishedRevision).toBeNull();
    expect(review.hasChanges).toBe(true);
    expect(review.sections).toHaveLength(1);
    expect(review.sections[0].fields[0]).toMatchObject({
      path: 'hero.headline',
      before: DEFAULT_HEADLINE,
      after: 'عنوان أول نشر',
    });
    expect(review.faq?.changed).toBe(false);
  });

  test('reports no changes when the saved draft equals the effective content', async () => {
    await saveHome(0, DEFAULT_HEADLINE, defaultFaqInput());
    const review = await getPublicationReview(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    expect(review.hasChanges).toBe(false);
    expect(review.sections).toEqual([]);
    expect(review.faq?.changed).toBe(false);
  });

  test('Scenario D: review includes FAQ changes saved in a previous editing session', async () => {
    await saveHome(0, 'عنوان منشور سابق', defaultFaqInput());
    await publishHome(1);

    const draftFaq = defaultFaqInput();
    draftFaq[1] = { ...draftFaq[1], answer: 'إجابة مسودة معدّلة مسبقاً.' };
    draftFaq[4] = { ...draftFaq[4], visible: false };
    const reordered = [draftFaq[2], draftFaq[0], draftFaq[1], ...draftFaq.slice(3)];
    reordered.push({
      id: undefined,
      question: 'سؤال مسودة مضاف سابقاً',
      answer: 'إجابة سؤال مضاف.',
      visible: true,
    });
    await saveHome(1, 'عنوان منشور سابق', reordered);

    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status !== 'ok') return;
    const values = structuredClone(editor.data.values);
    (values.hero as Record<string, unknown>).tagline = 'شعار أحدث من الجلسة الحالية';
    await savePageDraft(
      {
        pageKey: 'home',
        locale: 'ar',
        expectedRevision: editor.data.revision,
        values,
        faqItems: editor.data.faqItems ?? defaultFaqInput(),
      },
      { db: pg.db },
    );

    const review = await getPublicationReview(
      { pageKey: 'home', locale: 'ar', expectedRevision: 3 },
      { db: pg.db },
    );
    expect(review.sections.map((section) => section.key)).toEqual(['hero']);
    expect(review.faq?.changed).toBe(true);
    expect(review.faq?.added.map((item) => item.question)).toContain('سؤال مسودة مضاف سابقاً');
    expect(review.faq?.visibilityChanged).toHaveLength(1);
    expect(review.faq?.reordered).toBe(true);
    expect(review.faq?.edited.length).toBeGreaterThan(0);

    await publishHome(3);
    const publicHome = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicHome.hero.tagline).toBe('شعار أحدث من الجلسة الحالية');
    expect(publicHome.faq.items.some((item) => item.question === 'سؤال مسودة مضاف سابقاً')).toBe(
      true,
    );
    expect(publicHome.faq.items.some((item) => item.question === draftFaq[4].question)).toBe(
      false,
    );
  });

  test('a review cannot re-publish after another publication consumed the draft', async () => {
    await saveHome(0, 'عنوان منشور من جلسة أخرى');
    await saveHome(1, 'مسودة مراجعة');
    const review = await getPublicationReview(
      { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
      { db: pg.db },
    );
    expect(review.revision).toBe(2);

    await publishHome(review.revision);
    const published = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(published.hero.headline).toBe('مسودة مراجعة');

    await expect(
      publishPageContent(
        { pageKey: 'home', locale: 'ar', expectedRevision: review.revision },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsNoDraftError);

    const after = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(after.hero.headline).toBe('مسودة مراجعة');
  });

  test('rejects a review for a stale revision without changing published content', async () => {
    await saveHome(0, 'مراجعة قديمة');
    await saveHome(1, 'مسودة أحدث');
    await expect(
      getPublicationReview(
        { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsConflictError);
    const publicHome = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicHome.hero.headline).toBe(DEFAULT_HEADLINE);
  });
});
