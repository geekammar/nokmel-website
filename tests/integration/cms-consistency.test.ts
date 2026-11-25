import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  DEFAULT_FAQ_FOR_RENDER,
  DEFAULT_FAQ_ITEMS,
  composePageContent,
  defaultSectionPayloads,
  extractPageValues,
} from '@/content/cms/registry';
import {
  getEditorPageData,
  getPreviewPageContent,
  getPublishedPageContent,
  publishPageContent,
  savePageDraft,
} from '@/lib/cms/service';
import * as schema from '@/lib/db/schema';
import { applyMigrations, emptyDatabase, getDisposablePostgres } from './helpers';

const pg = await getDisposablePostgres();
const databaseName = new URL(pg.url).pathname.replace(/^\//, '');

beforeAll(async () => {
  await applyMigrations(pg);
});

beforeEach(async () => {
  await emptyDatabase(pg);
});

afterAll(async () => {
  await pg.stop();
});

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

async function saveHome(revision: number, headline: string, faqItems: FaqInput[]) {
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

async function publishHome(revision: number) {
  return publishPageContent(
    { pageKey: 'home', locale: 'ar', expectedRevision: revision },
    { db: pg.db },
  );
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

describe('consistent multi-query reads', () => {
  test('public homepage sees one complete publication when another publication commits between reads', async () => {
    const v1Headline = 'عنوان الإصدار المنشور الأول';
    const v2Headline = 'عنوان الإصدار المنشور الثاني';
    const v1Faq = defaultFaqInput();
    v1Faq[0] = { ...v1Faq[0], question: 'سؤال الإصدار الأول' };
    const v2Faq = v1Faq.map((item) => ({ ...item }));
    v2Faq[0] = { ...v2Faq[0], question: 'سؤال الإصدار الثاني' };

    await saveHome(0, v1Headline, v1Faq);
    await publishHome(1);
    await saveHome(1, v2Headline, v2Faq);

    let hookRan = false;
    const content = await getPublishedPageContent('home', 'ar', {
      db: pg.db,
      testHooks: {
        afterSectionRead: async () => {
          hookRan = true;
          await publishHome(2);
        },
      },
    });

    expect(hookRan).toBe(true);
    expect(content.hero.headline).toBe(v1Headline);
    expect(content.faq.items[0].question).toBe('سؤال الإصدار الأول');

    const fresh = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(fresh.hero.headline).toBe(v2Headline);
    expect(fresh.faq.items[0].question).toBe('سؤال الإصدار الثاني');
  });

  test('editor load does not mix a concurrent newer revision with newer FAQ rows', async () => {
    const concurrentQuestion = 'سؤال محفوظ من جلسة أخرى';
    const concurrentFaq = defaultFaqInput();
    concurrentFaq[0] = { ...concurrentFaq[0], question: concurrentQuestion };
    let hookRan = false;

    const editor = await getEditorPageData('home', 'ar', {
      db: pg.db,
      testHooks: {
        afterSectionRead: async () => {
          hookRan = true;
          await saveHome(0, 'مسودة محفوظة من جلسة أخرى', concurrentFaq);
        },
      },
    });

    expect(hookRan).toBe(true);
    expect(editor.status).toBe('ok');
    if (editor.status === 'ok') {
      expect(editor.data.revision).toBe(0);
      expect(editor.data.hasDraft).toBe(false);
      expect(editor.data.faqItems?.some((item) => item.question === concurrentQuestion)).toBe(
        false,
      );
      expect(editor.data.faqItems).toHaveLength(DEFAULT_FAQ_ITEMS.length);
    }

    const fresh = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(fresh.status).toBe('ok');
    if (fresh.status === 'ok') {
      expect(fresh.data.revision).toBe(1);
      expect(fresh.data.hasDraft).toBe(true);
      expect(fresh.data.faqItems?.some((item) => item.question === concurrentQuestion)).toBe(
        true,
      );
    }
  });

  test('draft preview remains coherent when a draft save commits between reads', async () => {
    const v1Headline = 'عنوان منشور قبل المعاينة';
    const v2Headline = 'عنوان مسودة متزامنة';
    const v1Faq = defaultFaqInput();
    v1Faq[0] = { ...v1Faq[0], question: 'سؤال منشور قبل المعاينة' };
    const v2Faq = v1Faq.map((item) => ({ ...item }));
    v2Faq[0] = { ...v2Faq[0], question: 'سؤال مسودة متزامنة' };

    await saveHome(0, v1Headline, v1Faq);
    await publishHome(1);

    let hookRan = false;
    const preview = await getPreviewPageContent('home', 'ar', {
      db: pg.db,
      testHooks: {
        afterSectionRead: async () => {
          hookRan = true;
          await saveHome(1, v2Headline, v2Faq);
        },
      },
    });

    expect(hookRan).toBe(true);
    expect(preview.hero.headline).toBe(v1Headline);
    expect(preview.faq.items[0].question).toBe('سؤال منشور قبل المعاينة');

    const fresh = await getPreviewPageContent('home', 'ar', { db: pg.db });
    expect(fresh.hero.headline).toBe(v2Headline);
    expect(fresh.faq.items[0].question).toBe('سؤال مسودة متزامنة');
  });
});

describe('published-only read projection', () => {
  test('public reads succeed with only published-column privileges and ignore draft state', async () => {
    const roleName = `cms_pub_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const rolePassword = randomUUID();
    const v1Headline = 'عنوان منشور للتحقق من الإسقاط';
    const v1Faq = defaultFaqInput();
    v1Faq[0] = { ...v1Faq[0], question: 'سؤال منشور أول' };
    v1Faq[1] = { ...v1Faq[1], question: 'سؤال منشور ثان' };

    await saveHome(0, v1Headline, v1Faq);
    await publishHome(1);

    await pg.pool.query(`create role ${quoteIdentifier(roleName)} login password '${rolePassword}'`);
    await pg.pool.query(
      `grant connect on database ${quoteIdentifier(databaseName)} to ${quoteIdentifier(roleName)}`,
    );
    await pg.pool.query(
      `grant usage on schema public to ${quoteIdentifier(roleName)}`,
    );
    await pg.pool.query(
      `grant select (page_key, locale, section_key, published_payload) on table public.content_sections to ${quoteIdentifier(roleName)}`,
    );
    await pg.pool.query(
      `grant select (locale, published_question, published_answer, published_sort_order, published_visible) on table public.faq_items to ${quoteIdentifier(roleName)}`,
    );

    const runtimeUrl = new URL(pg.url);
    runtimeUrl.username = roleName;
    runtimeUrl.password = rolePassword;
    const probePool = new Pool({ connectionString: runtimeUrl.toString(), ssl: false, max: 2 });
    try {
      const probeDb = drizzle(probePool, { schema });
      const published = await getPublishedPageContent('home', 'ar', { db: probeDb });
      expect(published.hero.headline).toBe(v1Headline);
      expect(published.faq.items.map((item) => item.question).slice(0, 2)).toEqual([
        'سؤال منشور أول',
        'سؤال منشور ثان',
      ]);

      const publishedOrder = published.faq.items.map((item) => item.question);
      const draftFaq = defaultFaqInput();
      draftFaq[0] = { ...draftFaq[0], question: 'سؤال مسودة غير منشور', visible: false };
      draftFaq[1] = { ...draftFaq[1], question: 'سؤال مسودة آخر' };
      const reordered = [draftFaq[2], draftFaq[1], draftFaq[0], ...draftFaq.slice(3)];
      await saveHome(1, 'عنوان مسودة غير منشور', reordered);

      const afterDraft = await getPublishedPageContent('home', 'ar', { db: probeDb });
      expect(afterDraft.hero.headline).toBe(v1Headline);
      expect(afterDraft.faq.items.map((item) => item.question)).toEqual(publishedOrder);
      expect(JSON.stringify(afterDraft)).not.toContain('غير منشور');
    } finally {
      await probePool.end();
      await pg.pool.query(`drop owned by ${quoteIdentifier(roleName)}`).catch(() => undefined);
      await pg.pool.query(`drop role if exists ${quoteIdentifier(roleName)}`).catch(() => undefined);
    }
  });

  test('published FAQ ordering is stable and driven only by published order', async () => {
    const v1Faq = defaultFaqInput();
    v1Faq[0] = { ...v1Faq[0], question: 'سؤال أول منشور' };
    v1Faq[1] = { ...v1Faq[1], question: 'سؤال ثان منشور' };
    v1Faq[2] = { ...v1Faq[2], question: 'سؤال ثالث منشور' };
    await saveHome(0, 'عنوان ترتيب الأسئلة', v1Faq);
    await publishHome(1);

    const before = await getPublishedPageContent('home', 'ar', { db: pg.db });
    const beforeQuestions = before.faq.items.map((item) => item.question);

    const reordered = [v1Faq[2], v1Faq[0], v1Faq[1], ...v1Faq.slice(3)];
    await saveHome(1, 'عنوان ترتيب الأسئلة', reordered);
    const afterDraft = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(afterDraft.faq.items.map((item) => item.question)).toEqual(beforeQuestions);

    await publishHome(2);
    const afterPublish = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(afterPublish.faq.items.map((item) => item.question)).toEqual(
      reordered.map((item) => item.question),
    );
  });
});
