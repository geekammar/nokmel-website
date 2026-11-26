import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { DEFAULT_FAQ_FOR_RENDER, DEFAULT_FAQ_ITEMS, buildSectionPayloads, composePageContent, defaultSectionPayloads, extractPageValues } from '@/content/cms/registry';
import {
  getEditorPageData,
  getPreviewPageContent,
  getPublishedPageContent,
  publishPageContent,
  savePageDraft,
  discardPageDraft,
} from '@/lib/cms/service';
import { CmsConflictError, CmsNoChangesError, CmsNoDraftError, CmsValidationError } from '@/lib/cms/errors';
import type { Db } from '@/lib/db/types';
import { getDisposablePostgres, applyMigrations, emptyDatabase } from './helpers';

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

function homeDraftValues(headline = 'عنوان مسودة للاختبار') {
  const content = composePageContent('home', defaultSectionPayloads('home'), DEFAULT_FAQ_FOR_RENDER);
  const values = extractPageValues('home', content);
  (values.hero as Record<string, unknown>).headline = headline;
  return values;
}

type FaqInput = { id?: string; question: string; answer: string; visible: boolean };

function defaultFaqInput(): FaqInput[] {
  return DEFAULT_FAQ_ITEMS.map(({ id, question, answer, visible }) => ({
    id,
    question,
    answer,
    visible,
  }));
}

async function saveHome(
  revision: number,
  headline = 'عنوان مسودة للاختبار',
  faqItems: FaqInput[] = defaultFaqInput(),
) {
  return savePageDraft(
    {
      pageKey: 'home',
      locale: 'ar',
      expectedRevision: revision,
      values: homeDraftValues(headline),
      faqItems,
    },
    { db: pg.db },
  );
}

describe('CMS migration and persistence', () => {
  test('creates the CMS tables through additive migrations', async () => {
    const { rows } = await pg.pool.query(
      "select tablename from pg_tables where schemaname = 'public' and tablename in ('content_sections', 'faq_items') order by tablename",
    );
    expect(rows.map((row) => row.tablename)).toEqual(['content_sections', 'faq_items']);
  });

  test('uses approved default content when no published row exists', async () => {
    const content = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(content.hero.headline).toBe('متجرك في المحادثة. وبزنسك في مكان واحد.');
    expect(content.faq.items).toHaveLength(DEFAULT_FAQ_ITEMS.length);
  });

  test('rejects unsupported locale and unknown pages', async () => {
    await expect(getPublishedPageContent('home', 'en', { db: pg.db })).rejects.toThrow(
      CmsValidationError,
    );
    await expect(
      savePageDraft(
        {
          pageKey: 'blog',
          locale: 'ar',
          expectedRevision: 0,
          values: {},
        },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsValidationError);
  });

  test('saving a draft never changes public content', async () => {
    const saved = await saveHome(0, 'عنوان محفوظ في المسودة');
    expect(saved.revision).toBe(1);
    expect(saved.hasDraft).toBe(true);
    expect(saved.hasPublished).toBe(false);

    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.hero.headline).not.toBe('عنوان محفوظ في المسودة');

    const preview = await getPreviewPageContent('home', 'ar', { db: pg.db });
    expect(preview.hero.headline).toBe('عنوان محفوظ في المسودة');

    const { rows } = await pg.pool.query('select count(*)::int as count from content_sections');
    expect(rows[0].count).toBe(8);
  });

  test('publishes atomically and renders the published override', async () => {
    await saveHome(0, 'عنوان منشور جديد');
    const result = await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    expect(result.hasDraft).toBe(false);
    expect(result.hasPublished).toBe(true);

    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.hero.headline).toBe('عنوان منشور جديد');

    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status === 'ok') {
      expect(editor.data.hasDraft).toBe(false);
      expect(editor.data.hasPublished).toBe(true);
      expect(editor.data.lastPublishedAt).not.toBeNull();
    }
  });

  test('discarding a draft preserves the published version and bumps the revision', async () => {
    await saveHome(0, 'نسخة منشورة');
    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    await saveHome(1, 'مسودة يجب تجاهلها');
    const discarded = await discardPageDraft(
      { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
      { db: pg.db },
    );
    expect(discarded.revision).toBe(3);
    expect(discarded.hasDraft).toBe(false);

    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.hero.headline).toBe('نسخة منشورة');

    await expect(
      discardPageDraft(
        { pageKey: 'home', locale: 'ar', expectedRevision: 3 },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsNoChangesError);
  });

  test('rejects stale writes and stale publication', async () => {
    await saveHome(0, 'تعديل المحرر الأول');
    await expect(saveHome(0, 'تعديل المحرر الثاني')).rejects.toThrow(CmsConflictError);

    await saveHome(1, 'مسودة أحدث');
    await expect(
      publishPageContent(
        { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsConflictError);

    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.hero.headline).not.toBe('تعديل المحرر الأول');
    expect(publicContent.hero.headline).not.toBe('تعديل المحرر الثاني');
  });

  test('stale discard cannot destroy a newer draft', async () => {
    await saveHome(0, 'المحرر الأول');
    await saveHome(1, 'مسودة أحدث من المحرر الثاني');
    await expect(
      discardPageDraft(
        { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsConflictError);
    const preview = await getPreviewPageContent('home', 'ar', { db: pg.db });
    expect(preview.hero.headline).toBe('مسودة أحدث من المحرر الثاني');
  });

  test('concurrent saves with the same revision allow exactly one writer', async () => {
    const results = await Promise.allSettled([
      saveHome(0, 'كتابة متزامنة أ'),
      saveHome(0, 'كتابة متزامنة ب'),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(CmsConflictError);
    const { rows } = await pg.pool.query(
      "select max(draft_revision)::int as revision from content_sections where page_key = 'home'",
    );
    expect(rows[0].revision).toBe(1);
  });

  test('cannot publish without a saved draft', async () => {
    await expect(
      publishPageContent(
        { pageKey: 'home', locale: 'ar', expectedRevision: 0 },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsNoDraftError);
  });

  test('failed publication preserves the previous published version', async () => {
    await saveHome(0, 'نسخة سليمة منشورة');
    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );

    await saveHome(1, 'مسودة تالفة');
    await pg.pool.query(
      "update content_sections set draft_payload = '{\"title\": 1}'::jsonb, draft_revision = 3 where page_key = 'home' and section_key = 'hero'",
    );

    await expect(
      publishPageContent(
        { pageKey: 'home', locale: 'ar', expectedRevision: 3 },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsValidationError);

    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.hero.headline).toBe('نسخة سليمة منشورة');
  });
});

describe('FAQ draft and publication semantics', () => {
  test('adds, edits, reorders and hides items, then publishes consistently', async () => {
    const original = defaultFaqInput();
    original[0].question = 'سؤال معدّل في المسودة';
    original.push({
      id: undefined,
      question: 'سؤال جديد من الاختبار',
      answer: 'إجابة جديدة',
      visible: true,
    });
    const saved = await saveHome(0, 'عنوان مع أسئلة', original);
    expect(saved.faqItems).toHaveLength(original.length);
    const newItem = saved.faqItems!.find((item) => item.question === 'سؤال جديد من الاختبار');
    expect(newItem?.id).toMatch(/^faq-/);

    const publicBefore = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicBefore.faq.items.some((item) => item.question === 'سؤال جديد من الاختبار')).toBe(
      false,
    );

    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    const publicAfter = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicAfter.faq.items[0].question).toBe('سؤال معدّل في المسودة');
    expect(publicAfter.faq.items.some((item) => item.question === 'سؤال جديد من الاختبار')).toBe(
      true,
    );
  });

  test('does not auto-rewrite a previously published stale join-availability FAQ answer', async () => {
    const staleAnswer =
      'ليس بعد. النموذج معطّل حالياً وسيُفعَّل مع اقتراب موعد الإطلاق.';
    const items = defaultFaqInput();
    const target = items.find((item) => item.question.includes('نموذج طلب الانضمام'));
    if (!target) throw new Error('join availability FAQ missing');
    target.answer = staleAnswer;
    await saveHome(0, 'عنوان مع إجابة قديمة', items);
    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );

    const publicBefore = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(
      publicBefore.faq.items.find((item) => item.question === target.question)?.answer,
    ).toBe(staleAnswer);

    const stored = await pg.pool.query(
      'select published_answer from faq_items where published_question = $1',
      [target.question],
    );
    expect(stored.rows[0].published_answer).toBe(staleAnswer);

    // Rendering must not silently mutate the owner-published CMS row.
    await getPublishedPageContent('home', 'ar', { db: pg.db });
    const storedAfter = await pg.pool.query(
      'select published_answer from faq_items where published_question = $1',
      [target.question],
    );
    expect(storedAfter.rows[0].published_answer).toBe(staleAnswer);
  });

  test('removing a published FAQ item removes it only after publication', async () => {
    const items = defaultFaqInput();
    await saveHome(0, 'عنوان', items);
    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );

    const removed = items.slice(1);
    await saveHome(1, 'عنوان', removed);
    const stillPublic = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(stillPublic.faq.items).toHaveLength(items.length);

    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
      { db: pg.db },
    );
    const afterPublish = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(afterPublish.faq.items).toHaveLength(items.length - 1);
  });

  test('hidden FAQ items are stored but not rendered publicly', async () => {
    const items = defaultFaqInput();
    items[0].visible = false;
    await saveHome(0, 'عنوان', items);
    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.faq.items.some((item) => item.question === items[0].question)).toBe(false);
  });

  test('preserves the draft order on publication', async () => {
    const items = defaultFaqInput();
    const reordered = [items[2], items[0], items[1], ...items.slice(3)];
    await saveHome(0, 'عنوان', reordered);
    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.faq.items.map((item) => item.question)).toEqual(
      reordered.map((item) => item.question),
    );
  });

  test('refuses to publish when no FAQ item is visible', async () => {
    const items = defaultFaqInput().map((item) => ({ ...item, visible: false }));
    await saveHome(0, 'عنوان', items);
    await expect(
      publishPageContent(
        { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsValidationError);
  });

  test('discard restores published FAQ items and drops new draft-only items', async () => {
    await saveHome(0, 'عنوان', defaultFaqInput());
    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );

    const draft = defaultFaqInput();
    draft[0].question = 'سؤال مسودة';
    draft.push({ id: undefined, question: 'جديد فقط', answer: 'لن ينشر', visible: true });
    await saveHome(1, 'عنوان', draft);
    await discardPageDraft(
      { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
      { db: pg.db },
    );

    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.faq.items[0].question).toBe(DEFAULT_FAQ_ITEMS[0].question);
    expect(publicContent.faq.items.some((item) => item.question === 'جديد فقط')).toBe(false);
    const { rows } = await pg.pool.query('select count(*)::int as count from faq_items');
    expect(rows[0].count).toBe(DEFAULT_FAQ_ITEMS.length);
  });
});

describe('public fallback safety', () => {
  test('invalid published payloads fall back to approved defaults without exposing drafts', async () => {
    await saveHome(0, 'مسودة سرية يجب ألا تظهر');
    await publishPageContent(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    await saveHome(1, 'مسودة أخرى سرية');
    await pg.pool.query(
      "update content_sections set published_payload = '{\"bad\": true}'::jsonb where page_key = 'home' and section_key = 'hero'",
    );

    const publicContent = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(publicContent.hero.headline).toBe('متجرك في المحادثة. وبزنسك في مكان واحد.');
    expect(publicContent.hero.headline).not.toContain('سرية');
  });

  test('database failures return defaults for public requests', async () => {
    const broken = {
      select() {
        throw new Error('database unavailable');
      },
    } as unknown as Db;
    const content = await getPublishedPageContent('home', 'ar', { db: broken });
    expect(content.hero.headline).toBe('متجرك في المحادثة. وبزنسك في مكان واحد.');
  });

  test('builds per-page content for every approved route', async () => {
    for (const pageKey of ['home', 'features', 'pricing', 'join', 'contact', 'privacy', 'terms'] as const) {
      const content = await getPublishedPageContent(pageKey, 'ar', { db: pg.db });
      expect(content).toBeTruthy();
    }
  });

  test('publishes each non-home page and serves its override', async () => {
    const content = composePageContent(
      'features',
      defaultSectionPayloads('features'),
      DEFAULT_FAQ_FOR_RENDER,
    );
    const values = extractPageValues('features', content);
    (values.hero as Record<string, unknown>).title = 'ميزات منشورة من الاختبار';
    await savePageDraft(
      {
        pageKey: 'features',
        locale: 'ar',
        expectedRevision: 0,
        values,
      },
      { db: pg.db },
    );
    await publishPageContent(
      { pageKey: 'features', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    const publicContent = await getPublishedPageContent('features', 'ar', { db: pg.db });
    expect(publicContent.hero.title).toBe('ميزات منشورة من الاختبار');
  });

  test('builds published section payloads from structural defaults, not client structure', () => {
    const payloads = buildSectionPayloads('pricing', (() => {
      const content = composePageContent(
        'pricing',
        defaultSectionPayloads('pricing'),
        DEFAULT_FAQ_FOR_RENDER,
      );
      const values = extractPageValues('pricing', content);
      (values.hero as Record<string, unknown>).title = 'عنوان';
      return values;
    })());
    expect((payloads.hero as { title: string }).title).toBe('عنوان');
    expect(payloads.cta).toHaveProperty('primaryCta.href', '/join');
  });
});
