import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  DEFAULT_FAQ_FOR_RENDER,
  DEFAULT_FAQ_ITEMS,
  buildSectionPayloads,
  composePageContent,
  defaultSectionPayloads,
  extractPageValues,
} from '@/content/cms/registry';
import {
  seoFormValuesFromStored,
  type SeoFormValues,
} from '@/content/cms/seo';
import { SEO_PAGE_DEFAULTS } from '@/content/ar/seo';
import { CmsConflictError, CmsValidationError } from '@/lib/cms/errors';
import {
  discardPageDraft,
  getEditorPageData,
  getPublicationReview,
  getPublishedPageBundle,
  getPublishedPageContent,
  getPublishedPageSeo,
  publishPageContent,
  savePageDraft,
  saveSeoDraft,
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

function defaultSeo(pageKey: Parameters<typeof seoFormValuesFromStored>[0]): SeoFormValues {
  return seoFormValuesFromStored(pageKey, null);
}

function homeDraftValues(headline = 'عنوان محتوى محفوظ') {
  const content = composePageContent(
    'home',
    defaultSectionPayloads('home'),
    DEFAULT_FAQ_FOR_RENDER,
  );
  const values = extractPageValues('home', content);
  (values.hero as Record<string, unknown>).headline = headline;
  return values;
}

function seoWith(overrides: Partial<SeoFormValues>): SeoFormValues {
  return { ...defaultSeo('home'), ...overrides };
}

async function saveSeo(revision: number, values: SeoFormValues) {
  return saveSeoDraft(
    { pageKey: 'home', locale: 'ar', expectedRevision: revision, values },
    { db: pg.db },
  );
}

async function saveContent(revision: number, headline = 'عنوان محتوى محفوظ', faq = defaultFaqInput()) {
  return savePageDraft(
    {
      pageKey: 'home',
      locale: 'ar',
      expectedRevision: revision,
      values: homeDraftValues(headline),
      faqItems: faq,
    },
    { db: pg.db },
  );
}

async function publish(revision: number, pageKey: 'home' = 'home') {
  return publishPageContent(
    { pageKey, locale: 'ar', expectedRevision: revision },
    { db: pg.db },
  );
}

describe('SEO defaults and backward compatibility', () => {
  test('empty CMS database returns approved defaults for all seven routes', async () => {
    for (const pageKey of ['home', 'features', 'pricing', 'join', 'contact', 'privacy', 'terms'] as const) {
      const seo = await getPublishedPageSeo(pageKey, 'ar', { db: pg.db });
      expect(seo.title).toBe(SEO_PAGE_DEFAULTS[pageKey].title);
      expect(seo.description).toBe(SEO_PAGE_DEFAULTS[pageKey].description);
      expect(seo.socialImageId).toBe('mark-transparent-1024');
    }
  });

  test('W3.2 content records remain valid and editable without an SEO row', async () => {
    const content = composePageContent(
      'features',
      defaultSectionPayloads('features'),
      DEFAULT_FAQ_FOR_RENDER,
    );
    const values = extractPageValues('features', content);
    (values.hero as Record<string, unknown>).lead = 'مقدمة W3.2 محفوظة.';
    await savePageDraft(
      { pageKey: 'features', locale: 'ar', expectedRevision: 0, values },
      { db: pg.db },
    );
    await publishPageContent(
      { pageKey: 'features', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );

    const editor = await getEditorPageData('features', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status !== 'ok') return;
    expect(editor.data.seo.values).toEqual(seoFormValuesFromStored('features', null));
    expect(editor.data.seo.hasDraft).toBe(false);
    expect(editor.data.seo.hasPublished).toBe(false);
    expect(editor.data.hasDraft).toBe(false);

    const { rows } = await pg.pool.query(
      "select count(*)::int as count from content_sections where page_key = 'features' and section_key = 'seo'",
    );
    expect(rows[0].count).toBe(0);
    expect((await getPublishedPageContent('features', 'ar', { db: pg.db })).hero.lead).toBe(
      'مقدمة W3.2 محفوظة.',
    );
  });
});

describe('SEO draft and publication', () => {
  test('saves an SEO draft without changing public metadata or content', async () => {
    const result = await saveSeo(0, seoWith({ title: 'عنوان SEO مسودة', description: 'وصف مسودة.' }));
    expect(result.revision).toBe(1);
    expect(result.seo.hasDraft).toBe(true);

    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status === 'ok') {
      expect(editor.data.seo.values.title).toBe('عنوان SEO مسودة');
      expect(editor.data.hasDraft).toBe(true);
    }

    const publicSeo = await getPublishedPageSeo('home', 'ar', { db: pg.db });
    expect(publicSeo.title).toBe(SEO_PAGE_DEFAULTS.home.title);
    expect(publicSeo.description).toBe(SEO_PAGE_DEFAULTS.home.description);
    const publicBundle = await getPublishedPageBundle('home', 'ar', { db: pg.db });
    expect(publicBundle.content.hero.headline).toBe(
      'متجرك في المحادثة. وبزنسك في مكان واحد.',
    );
    expect(JSON.stringify(publicBundle)).not.toContain('عنوان SEO مسودة');
  });

  test('publishes SEO overrides and exposes social fallbacks', async () => {
    await saveSeo(0, seoWith({
      title: 'عنوان منشور مخصص',
      description: 'وصف منشور مخصص.',
      socialImage: 'app-icon-light-512',
    }));
    await publish(1);

    const seo = await getPublishedPageSeo('home', 'ar', { db: pg.db });
    expect(seo.title).toBe('عنوان منشور مخصص');
    expect(seo.description).toBe('وصف منشور مخصص.');
    expect(seo.socialTitle).toBe('عنوان منشور مخصص');
    expect(seo.socialDescription).toBe('وصف منشور مخصص.');
    expect(seo.socialTitleInherited).toBe(true);
    expect(seo.socialImageId).toBe('app-icon-light-512');
  });

  test('publishing SEO alone does not alter body content', async () => {
    await saveSeo(0, seoWith({ title: 'SEO فقط', description: 'وصف SEO فقط.' }));
    await publish(1);
    const content = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(content.hero.headline).toBe('متجرك في المحادثة. وبزنسك في مكان واحد.');
    expect(content.faq.items).toEqual(
      DEFAULT_FAQ_FOR_RENDER.map(({ question, answer }) => ({ question, answer })),
    );
  });
});

describe('content and SEO draft coexistence', () => {
  test('saving SEO preserves pending content and FAQ drafts', async () => {
    const faq = defaultFaqInput();
    faq[0] = { ...faq[0], question: 'سؤال مسودة محفوظ' };
    await saveContent(0, 'عنوان مسودة محفوظ', faq);
    const savedSeo = await saveSeo(1, seoWith({ title: 'SEO مع محتوى', description: 'وصف SEO.' }));
    expect(savedSeo.revision).toBe(2);

    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status !== 'ok') return;
    expect((editor.data.values.hero as Record<string, unknown>).headline).toBe(
      'عنوان مسودة محفوظ',
    );
    expect(editor.data.faqItems?.[0].question).toBe('سؤال مسودة محفوظ');
    expect(editor.data.seo.values.title).toBe('SEO مع محتوى');
    expect(editor.data.revision).toBe(2);
  });

  test('saving content preserves a pending SEO draft', async () => {
    await saveSeo(0, seoWith({ title: 'SEO محفوظ أولاً', description: 'وصف SEO.' }));
    const savedContent = await saveContent(1, 'محتوى بعد SEO');
    expect(savedContent.revision).toBe(2);

    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status !== 'ok') return;
    expect(editor.data.seo.values.title).toBe('SEO محفوظ أولاً');
    expect(editor.data.seo.hasDraft).toBe(true);
    expect((editor.data.values.hero as Record<string, unknown>).headline).toBe(
      'محتوى بعد SEO',
    );
  });

  test('publication review includes content, SEO and FAQ changes and publishes them atomically', async () => {
    const faq = defaultFaqInput();
    faq[1] = { ...faq[1], answer: 'إجابة FAQ مراجعة.' };
    await saveContent(0, 'عنوان مراجعة شامل', faq);
    await saveSeo(1, seoWith({
      title: 'عنوان SEO مراجعة',
      description: 'وصف SEO مراجعة.',
      socialTitle: 'عنوان مشاركة مراجعة',
    }));
    const review = await getPublicationReview(
      { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
      { db: pg.db },
    );
    expect(review.sections.map((section) => section.key)).toEqual(['hero']);
    expect(review.seo?.changed).toBe(true);
    expect(review.seo?.fields.map((field) => field.key)).toEqual([
      'title',
      'description',
      'socialTitle',
      'socialDescription',
    ]);
    expect(review.faq?.changed).toBe(true);

    await publish(review.revision);
    const bundle = await getPublishedPageBundle('home', 'ar', { db: pg.db });
    expect(bundle.content.hero.headline).toBe('عنوان مراجعة شامل');
    expect(bundle.seo.title).toBe('عنوان SEO مراجعة');
    expect(bundle.seo.socialTitle).toBe('عنوان مشاركة مراجعة');
    expect(bundle.content.faq.items[1].answer).toBe('إجابة FAQ مراجعة.');
  });

  test('stale SEO save and stale publication review are rejected', async () => {
    await saveContent(0, 'مسودة أولى');
    await saveSeo(1, seoWith({ title: 'SEO أول', description: 'وصف أول.' }));
    await expect(saveSeo(1, seoWith({ title: 'SEO قديم', description: 'وصف قديم.' }))).rejects.toThrow(
      CmsConflictError,
    );

    const review = await getPublicationReview(
      { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
      { db: pg.db },
    );
    await saveSeo(2, seoWith({ title: 'SEO أحدث', description: 'وصف أحدث.' }));
    await expect(publish(review.revision)).rejects.toThrow(CmsConflictError);
  });

  test('discard removes an SEO draft but preserves published metadata', async () => {
    await saveSeo(0, seoWith({ title: 'SEO منشور', description: 'وصف منشور.' }));
    await publish(1);
    await saveSeo(1, seoWith({ title: 'SEO مسودة', description: 'وصف مسودة.' }));

    await discardPageDraft(
      { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
      { db: pg.db },
    );
    const seo = await getPublishedPageSeo('home', 'ar', { db: pg.db });
    expect(seo.title).toBe('SEO منشور');
    expect(seo.description).toBe('وصف منشور.');
    const editor = await getEditorPageData('home', 'ar', { db: pg.db });
    expect(editor.status).toBe('ok');
    if (editor.status === 'ok') {
      expect(editor.data.seo.hasDraft).toBe(false);
      expect(editor.data.seo.values.title).toBe('SEO منشور');
    }
  });
});

describe('SEO fallback and read safety', () => {
  test('invalid published SEO falls back to approved defaults', async () => {
    await saveSeo(0, seoWith({ title: 'SEO صالح', description: 'وصف صالح.' }));
    await publish(1);
    await pg.pool.query(
      "update content_sections set published_payload = '{\"title\": 1}'::jsonb where page_key = 'home' and section_key = 'seo'",
    );
    const seo = await getPublishedPageSeo('home', 'ar', { db: pg.db });
    expect(seo.title).toBe(SEO_PAGE_DEFAULTS.home.title);
    expect(seo.description).toBe(SEO_PAGE_DEFAULTS.home.description);
  });

  test('invalid SEO draft is rejected by review and publication without changing public metadata', async () => {
    await saveSeo(0, seoWith({ title: 'SEO منشور', description: 'وصف منشور.' }));
    await publish(1);
    await saveSeo(1, seoWith({ title: 'SEO مسودة', description: 'وصف مسودة.' }));
    await pg.pool.query(
      "update content_sections set draft_payload = '{\"title\": 1}'::jsonb where page_key = 'home' and section_key = 'seo'",
    );
    await expect(
      getPublicationReview(
        { pageKey: 'home', locale: 'ar', expectedRevision: 2 },
        { db: pg.db },
      ),
    ).rejects.toThrow(CmsValidationError);
    await expect(publish(2)).rejects.toThrow(CmsValidationError);
    expect((await getPublishedPageSeo('home', 'ar', { db: pg.db })).title).toBe('SEO منشور');
  });

  test('database failures return approved SEO defaults', async () => {
    const broken = {
      select() {
        throw new Error('database unavailable');
      },
    } as never;
    const seo = await getPublishedPageSeo('home', 'ar', { db: broken });
    expect(seo.title).toBe(SEO_PAGE_DEFAULTS.home.title);
  });

  test('public SEO reads work with published-only column privileges and ignore drafts', async () => {
    const roleName = `cms_seo_pub_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const rolePassword = randomUUID();
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;

    await saveSeoDraft(
      {
        pageKey: 'features',
        locale: 'ar',
        expectedRevision: 0,
        values: { title: 'SEO منشور للميزات', description: 'وصف SEO منشور.' },
      },
      { db: pg.db },
    );
    await publishPageContent(
      { pageKey: 'features', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );
    await saveSeoDraft(
      {
        pageKey: 'features',
        locale: 'ar',
        expectedRevision: 1,
        values: { title: 'SEO مسودة للميزات', description: 'وصف مسودة.' },
      },
      { db: pg.db },
    );

    await pg.pool.query(`create role ${quote(roleName)} login password '${rolePassword}'`);
    await pg.pool.query(
      `grant connect on database ${quote(databaseName)} to ${quote(roleName)}`,
    );
    await pg.pool.query(`grant usage on schema public to ${quote(roleName)}`);
    await pg.pool.query(
      `grant select (page_key, locale, section_key, published_payload) on table public.content_sections to ${quote(roleName)}`,
    );

    const runtimeUrl = new URL(pg.url);
    runtimeUrl.username = roleName;
    runtimeUrl.password = rolePassword;
    const probePool = new Pool({ connectionString: runtimeUrl.toString(), ssl: false, max: 2 });
    try {
      const probeDb = drizzle(probePool, { schema });
      const seo = await getPublishedPageSeo('features', 'ar', { db: probeDb });
      expect(seo.title).toBe('SEO منشور للميزات');
      expect(seo.description).toBe('وصف SEO منشور.');
      expect(JSON.stringify(seo)).not.toContain('مسودة');
    } finally {
      await probePool.end();
      await pg.pool.query(`drop owned by ${quote(roleName)}`).catch(() => undefined);
      await pg.pool.query(`drop role if exists ${quote(roleName)}`).catch(() => undefined);
    }
  });

  test('public bundle and SEO reads never select draft payloads', async () => {
    await saveSeo(0, seoWith({ title: 'SEO مسودة سرية', description: 'وصف مسودة سري.' }));
    const publicBundle = await getPublishedPageBundle('home', 'ar', { db: pg.db });
    expect(publicBundle.seo.title).toBe(SEO_PAGE_DEFAULTS.home.title);
    expect(JSON.stringify(publicBundle)).not.toContain('SEO مسودة سرية');
    const { rows } = await pg.pool.query(
      "select published_payload from content_sections where page_key = 'home' and section_key = 'seo'",
    );
    expect(rows[0].published_payload).toBeNull();
  });

  test('a publication committing between reads cannot mix content and SEO states', async () => {
    await saveContent(0, 'عنوان الإصدار الأول');
    await saveSeo(1, seoWith({ title: 'SEO الإصدار الأول', description: 'وصف الإصدار الأول.' }));
    await publish(2);

    await saveContent(2, 'عنوان الإصدار الثاني');
    await saveSeo(3, seoWith({ title: 'SEO الإصدار الثاني', description: 'وصف الإصدار الثاني.' }));

    let hookRan = false;
    const bundle = await getPublishedPageBundle('home', 'ar', {
      db: pg.db,
      testHooks: {
        afterSectionRead: async () => {
          hookRan = true;
          await publish(4);
        },
      },
    });
    expect(hookRan).toBe(true);
    expect(bundle.content.hero.headline).toBe('عنوان الإصدار الأول');
    expect(bundle.seo.title).toBe('SEO الإصدار الأول');
    const fresh = await getPublishedPageBundle('home', 'ar', { db: pg.db });
    expect(fresh.content.hero.headline).toBe('عنوان الإصدار الثاني');
    expect(fresh.seo.title).toBe('SEO الإصدار الثاني');
  });
});

test('public content build helper is unaffected by SEO section keys', () => {
  const payloads = buildSectionPayloads('home', extractPageValues(
    'home',
    composePageContent('home', defaultSectionPayloads('home'), DEFAULT_FAQ_FOR_RENDER),
  ));
  expect(payloads).not.toHaveProperty('seo');
});
