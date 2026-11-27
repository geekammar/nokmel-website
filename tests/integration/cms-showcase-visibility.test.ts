import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { home } from '@/content/ar/home';
import {
  DEFAULT_FAQ_FOR_RENDER,
  DEFAULT_FAQ_ITEMS,
  composePageContent,
  defaultSectionPayloads,
  extractPageValues,
  type CmsPageContent,
} from '@/content/cms/registry';
import { CmsConflictError } from '@/lib/cms/errors';
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

type FaqInput = { id?: string; question: string; answer: string; visible: boolean };

function defaultFaqInput(): FaqInput[] {
  return DEFAULT_FAQ_ITEMS.map(({ id, question, answer, visible }) => ({
    id,
    question,
    answer,
    visible,
  }));
}

function homeValues(visible: boolean) {
  const content = composePageContent(
    'home',
    defaultSectionPayloads('home'),
    DEFAULT_FAQ_FOR_RENDER,
  );
  const values = extractPageValues('home', content);
  (values.showcase as Record<string, unknown>).visible = visible;
  return values;
}

async function saveVisibility(revision: number, visible: boolean) {
  return savePageDraft(
    {
      pageKey: 'home',
      locale: 'ar',
      expectedRevision: revision,
      values: homeValues(visible),
      faqItems: defaultFaqInput(),
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

function showcaseOf(content: CmsPageContent['home']) {
  return content.showcase;
}

describe('homepage showcase visibility', () => {
  test('stores the visibility preference as hidden by default in public, editor and preview content', async () => {
    const publicHome = await getPublishedPageContent('home', 'ar', { db: pg.db });
    const preview = await getPreviewPageContent('home', 'ar', { db: pg.db });
    const editor = await getEditorPageData('home', 'ar', { db: pg.db });

    expect(showcaseOf(publicHome).visible).toBe(false);
    expect(showcaseOf(preview).visible).toBe(false);
    expect(editor.status).toBe('ok');
    if (editor.status === 'ok') {
      expect((editor.data.values.showcase as { visible: boolean }).visible).toBe(false);
      expect(editor.data.hasDraft).toBe(false);
    }
  });

  test('accepts a legacy published payload without visibility and resolves it to hidden', async () => {
    const payload = structuredClone(defaultSectionPayloads('home').showcase);
    delete (payload as Record<string, unknown>).visible;
    const now = new Date();
    await pg.pool.query(
      `insert into content_sections
        (id, page_key, section_key, locale, draft_payload, published_payload,
         draft_revision, published_revision, updated_at, published_at)
       values ($1, 'home', 'showcase', 'ar', null, $2::jsonb, 0, 1, $3, $3)`,
      ['home:showcase:ar', JSON.stringify(payload), now],
    );

    const publicHome = await getPublishedPageContent('home', 'ar', { db: pg.db });
    const preview = await getPreviewPageContent('home', 'ar', { db: pg.db });
    const editor = await getEditorPageData('home', 'ar', { db: pg.db });

    expect(showcaseOf(publicHome).visible).toBe(false);
    expect(showcaseOf(publicHome).title).toBe(home.showcase.title);
    expect(showcaseOf(publicHome).steps).toEqual(home.showcase.steps);
    expect(showcaseOf(preview).visible).toBe(false);
    expect(editor.status).toBe('ok');
    if (editor.status === 'ok') {
      expect((editor.data.values.showcase as { visible: boolean }).visible).toBe(false);
      expect((editor.data.values.showcase as { title: string }).title).toBe(home.showcase.title);
    }
  });

  test('keeps draft visibility private while preview and review reflect it', async () => {
    await saveVisibility(0, true);

    const publicHome = await getPublishedPageContent('home', 'ar', { db: pg.db });
    const preview = await getPreviewPageContent('home', 'ar', { db: pg.db });
    const review = await getPublicationReview(
      { pageKey: 'home', locale: 'ar', expectedRevision: 1 },
      { db: pg.db },
    );

    expect(showcaseOf(publicHome).visible).toBe(false);
    expect(showcaseOf(preview).visible).toBe(true);
    expect(review.sections).toEqual([
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
  });

  test('publishes the visibility preference without losing the configured showcase content', async () => {
    await saveVisibility(0, true);
    await publishHome(1);
    const visiblePublic = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(showcaseOf(visiblePublic).visible).toBe(true);
    expect(showcaseOf(visiblePublic)).toMatchObject({
      title: home.showcase.title,
      body: home.showcase.body,
      caption: home.showcase.caption,
      steps: home.showcase.steps,
      primaryCta: home.showcase.primaryCta,
    });

    await saveVisibility(1, false);
    const stillVisiblePublic = await getPublishedPageContent('home', 'ar', { db: pg.db });
    const hiddenPreview = await getPreviewPageContent('home', 'ar', { db: pg.db });
    expect(showcaseOf(stillVisiblePublic).visible).toBe(true);
    expect(showcaseOf(hiddenPreview).visible).toBe(false);

    await publishHome(2);
    const hiddenPublic = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(showcaseOf(hiddenPublic).visible).toBe(false);
    expect(showcaseOf(hiddenPublic).title).toBe(home.showcase.title);

    await saveVisibility(2, true);
    const restoredPreview = await getPreviewPageContent('home', 'ar', { db: pg.db });
    expect(showcaseOf(restoredPreview).visible).toBe(true);
    expect(showcaseOf(restoredPreview)).toMatchObject({
      title: home.showcase.title,
      body: home.showcase.body,
      caption: home.showcase.caption,
      steps: home.showcase.steps,
      primaryCta: home.showcase.primaryCta,
    });
  });

  test('rejects a stale visibility write without changing the newer draft or public state', async () => {
    await saveVisibility(0, true);
    await saveVisibility(1, false);
    await expect(saveVisibility(1, true)).rejects.toThrow(CmsConflictError);

    const preview = await getPreviewPageContent('home', 'ar', { db: pg.db });
    const publicHome = await getPublishedPageContent('home', 'ar', { db: pg.db });
    expect(showcaseOf(preview).visible).toBe(false);
    expect(showcaseOf(publicHome).visible).toBe(false);
  });
});
