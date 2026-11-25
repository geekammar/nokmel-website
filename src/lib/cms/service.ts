import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import {
  CMS_PAGES,
  DEFAULT_FAQ_FOR_RENDER,
  DEFAULT_FAQ_ITEMS,
  assertCmsLocale,
  assertCmsPageKey,
  assertEditablePayloadSize,
  assertFaqRenderable,
  buildSectionPayloads,
  cmsFaqItemsInputSchema,
  composePageContent,
  defaultSectionPayloads,
  extractPageValues,
  getPageDefinition,
  type CmsFaqItem,
  type CmsLocale,
  type CmsPageContent,
  type CmsPageKey,
  type EditablePageValues,
} from '@/content/cms/registry';
import { buildPublicationReview, type PublicationReview } from '@/content/cms/review';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import { contentSections, faqItems } from '@/lib/db/schema';
import type { Db } from '@/lib/db/types';
import {
  CmsConflictError,
  CmsError,
  CmsNoChangesError,
  CmsNoDraftError,
  CmsNotMigratedError,
  CmsStorageError,
  CmsValidationError,
} from './errors';

/**
 * Server-side CMS content service (W3.2).
 *
 * Only predefined pages/sections from the content registry are accepted.
 * Publications are page-level and transactional; every mutation serializes on
 * a page-scoped PostgreSQL advisory lock and checks the expected revision so a
 * stale tab cannot overwrite or publish a newer draft.
 */

export type CmsReadTestHooks = {
  /**
   * Test-only synchronization seam. Runs after the first statement of a
   * related multi-query read transaction, while the reader still holds its
   * snapshot. Application code never supplies this hook.
   */
  afterSectionRead?: () => void | Promise<void>;
};

type CmsServiceOptions = { db?: Db; testHooks?: CmsReadTestHooks };

export type CmsStorageStatus =
  | 'ok'
  | 'unconfigured'
  | 'not_migrated'
  | 'unavailable'
  | 'invalid';

export type EditorPageData = {
  pageKey: CmsPageKey;
  locale: CmsLocale;
  revision: number;
  publishedRevision: number | null;
  values: EditablePageValues;
  faqItems: CmsFaqItem[] | null;
  hasDraft: boolean;
  hasPublished: boolean;
  lastPublishedAt: string | null;
};

export type EditorLoadResult =
  | { status: 'ok'; data: EditorPageData }
  | { status: Exclude<CmsStorageStatus, 'ok'>; message: string };

export type SaveDraftResult = {
  revision: number;
  publishedRevision: number | null;
  values: EditablePageValues;
  faqItems: CmsFaqItem[] | null;
  hasDraft: boolean;
  hasPublished: boolean;
  lastPublishedAt: string | null;
};

export type PublishResult = {
  revision: number;
  publishedRevision: number;
  publishedAt: string;
  hasDraft: false;
  hasPublished: true;
  lastPublishedAt: string;
};

export type PublicationReviewResult = PublicationReview;

export type DiscardResult = {
  revision: number;
  hasDraft: false;
  hasPublished: boolean;
  lastPublishedAt: string | null;
};

type SectionRow = typeof contentSections.$inferSelect;
type FaqRow = typeof faqItems.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type QueryDb = Db | Tx;
type PublishedSectionRow = {
  sectionKey: string;
  publishedPayload: Record<string, unknown> | null;
};
type PublishedFaqRow = {
  question: string | null;
  answer: string | null;
  sortOrder: number | null;
  visible: boolean | null;
};
type SectionPayloadSource = {
  sectionKey: string;
  draftPayload?: Record<string, unknown> | null;
  publishedPayload: Record<string, unknown> | null;
};
type RenderablePublishedFaq = {
  question: string;
  answer: string;
  visible: boolean;
};

function resolveDb(options: CmsServiceOptions): Db {
  return options.db ?? getDb().db;
}

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function logCmsFailure(operation: string, pageKey: string, error: unknown): void {
  const reason =
    error instanceof CmsError
      ? error.name
      : postgresErrorCode(error) === '42P01'
        ? 'not_migrated'
        : error instanceof ConfigError
          ? 'unconfigured'
          : 'unavailable';
  console.error(`[cms] ${operation} failed`, { pageKey, reason });
}

function assertExpectedRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new CmsValidationError('رقم إصدار المحتوى غير صالح.');
  }
  return value;
}

function maxRevision(rows: SectionRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.draftRevision), 0);
}

function lastPublished(rows: SectionRow[], faqRows: FaqRow[]): string | null {
  const dates = [
    ...rows
      .filter((row) => row.publishedPayload !== null)
      .map((row) => row.publishedAt),
    ...faqRows.filter((row) => row.publishedQuestion !== null).map((row) => row.publishedAt),
  ].filter((value): value is Date => value instanceof Date);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
}

function hasPublishedContent(rows: SectionRow[], faqRows: FaqRow[]): boolean {
  return (
    rows.some((row) => row.publishedPayload !== null) ||
    faqRows.some((row) => row.publishedQuestion !== null)
  );
}

function currentPublishedRevision(rows: SectionRow[]): number | null {
  const revisions = rows
    .filter((row) => row.publishedPayload !== null)
    .map((row) => row.publishedRevision)
    .filter((value): value is number => typeof value === 'number');
  return revisions.length > 0 ? Math.max(...revisions) : null;
}

function faqDraftDiffers(rows: FaqRow[]): boolean {
  return rows.some(
    (row) =>
      row.publishedQuestion === null ||
      row.draftDeleted ||
      row.draftQuestion !== row.publishedQuestion ||
      row.draftAnswer !== row.publishedAnswer ||
      row.draftSortOrder !== row.publishedSortOrder ||
      row.draftVisible !== row.publishedVisible,
  );
}

function draftFaqItems(rows: FaqRow[]): CmsFaqItem[] {
  return rows
    .filter((row) => !row.draftDeleted)
    .sort((a, b) => a.draftSortOrder - b.draftSortOrder)
    .map((row) => ({
      id: row.id,
      question: row.draftQuestion,
      answer: row.draftAnswer,
      visible: row.draftVisible,
    }));
}

function publishedReviewFaqItems(rows: FaqRow[]): CmsFaqItem[] {
  return rows
    .filter((row) => row.publishedQuestion !== null)
    .sort((a, b) => (a.publishedSortOrder ?? 0) - (b.publishedSortOrder ?? 0))
    .map((row) => ({
      id: row.id,
      question: row.publishedQuestion ?? '',
      answer: row.publishedAnswer ?? '',
      visible: row.publishedVisible ?? false,
    }));
}

function publishedFaqItems(rows: PublishedFaqRow[]): RenderablePublishedFaq[] {
  return rows.map((row) => {
    if (
      row.question === null ||
      row.answer === null ||
      row.sortOrder === null ||
      row.visible === null
    ) {
      throw new CmsValidationError('بيانات أسئلة منشورة غير صالحة.');
    }
    return { question: row.question, answer: row.answer, visible: row.visible };
  });
}

function effectiveSectionPayloads(
  rows: readonly SectionPayloadSource[],
  mode: 'draft' | 'published',
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const value =
      mode === 'draft' ? (row.draftPayload ?? row.publishedPayload) : row.publishedPayload;
    if (value === null || value === undefined) continue;
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new CmsValidationError('محتوى محفوظ غير صالح.');
    }
    result[row.sectionKey] = value;
  }
  return result;
}

function composeValidated(
  pageKey: CmsPageKey,
  payloads: Record<string, Record<string, unknown>>,
  faq: readonly { question: string; answer: string }[],
): CmsPageContent[CmsPageKey] {
  try {
    return composePageContent(pageKey, payloads, faq);
  } catch (error) {
    if (error instanceof ZodError) throw new CmsValidationError();
    throw error;
  }
}

function defaultPageContent<K extends CmsPageKey>(pageKey: K): CmsPageContent[K] {
  return composeValidated(
    pageKey,
    defaultSectionPayloads(pageKey),
    DEFAULT_FAQ_FOR_RENDER,
  ) as unknown as CmsPageContent[K];
}

/**
 * Owner editor/preview reads: full rows are restricted to these paths.
 */
async function readFaqRows(db: QueryDb, locale: CmsLocale): Promise<FaqRow[]> {
  return db
    .select()
    .from(faqItems)
    .where(eq(faqItems.locale, locale))
    .orderBy(asc(faqItems.draftSortOrder));
}

async function readSectionRows(
  db: QueryDb,
  pageKey: CmsPageKey,
  locale: CmsLocale,
): Promise<SectionRow[]> {
  return db
    .select()
    .from(contentSections)
    .where(and(eq(contentSections.pageKey, pageKey), eq(contentSections.locale, locale)));
}

/**
 * Public reads: published-only projection. Draft payloads, answers, ordering,
 * visibility and revisions are never selected.
 */
async function readPublishedSectionRows(
  db: QueryDb,
  pageKey: CmsPageKey,
  locale: CmsLocale,
): Promise<PublishedSectionRow[]> {
  return db
    .select({
      sectionKey: contentSections.sectionKey,
      publishedPayload: contentSections.publishedPayload,
    })
    .from(contentSections)
    .where(and(eq(contentSections.pageKey, pageKey), eq(contentSections.locale, locale)));
}

async function readPublishedFaqRows(
  db: QueryDb,
  locale: CmsLocale,
): Promise<PublishedFaqRow[]> {
  return db
    .select({
      question: faqItems.publishedQuestion,
      answer: faqItems.publishedAnswer,
      sortOrder: faqItems.publishedSortOrder,
      visible: faqItems.publishedVisible,
    })
    .from(faqItems)
    .where(and(eq(faqItems.locale, locale), isNotNull(faqItems.publishedQuestion)))
    .orderBy(asc(faqItems.publishedSortOrder));
}

export async function getEditorPageData(
  rawPageKey: unknown,
  rawLocale: unknown,
  options: CmsServiceOptions = {},
): Promise<EditorLoadResult> {
  let pageKey: CmsPageKey;
  let locale: CmsLocale;
  try {
    pageKey = assertCmsPageKey(rawPageKey);
    locale = assertCmsLocale(rawLocale);
  } catch {
    return { status: 'invalid', message: 'صفحة محتوى أو لغة غير معروفة.' };
  }

  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    if (error instanceof ConfigError) {
      return {
        status: 'unconfigured',
        message: 'تخزين المحتوى غير مهيأ في هذه البيئة. لا يمكن حفظ أو نشر التعديلات.',
      };
    }
    logCmsFailure('editor-load', pageKey, error);
    return { status: 'unavailable', message: 'تعذّر الوصول إلى تخزين المحتوى.' };
  }

  let rows: SectionRow[];
  let faqRows: FaqRow[] = [];
  try {
    const snapshot = await db.transaction(
      async (tx) => {
        const sectionRows = await readSectionRows(tx, pageKey, locale);
        if (pageKey !== 'home') {
          return { sectionRows, faqRows: [] as FaqRow[] };
        }
        await options.testHooks?.afterSectionRead?.();
        const faq = await readFaqRows(tx, locale);
        return { sectionRows, faqRows: faq };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
    rows = snapshot.sectionRows;
    faqRows = snapshot.faqRows;
  } catch (error) {
    if (postgresErrorCode(error) === '42P01') {
      return {
        status: 'not_migrated',
        message: 'جداول المحتوى غير مهيأة بعد. طبّق migrations قاعدة البيانات أولاً.',
      };
    }
    logCmsFailure('editor-load', pageKey, error);
    return { status: 'unavailable', message: 'تعذّر الوصول إلى تخزين المحتوى.' };
  }

  try {
    const overrides = effectiveSectionPayloads(rows, 'draft');
    const faq =
      pageKey === 'home'
        ? faqRows.length > 0
          ? draftFaqItems(faqRows)
          : DEFAULT_FAQ_ITEMS.map((item) => ({ ...item }))
        : undefined;
    const content = composePageContent(pageKey, overrides, faq);
    const values = extractPageValues(pageKey, content);
    const hasDraft =
      rows.some((row) => row.draftPayload !== null) ||
      (pageKey === 'home' && faqDraftDiffers(faqRows));

    return {
      status: 'ok',
      data: {
        pageKey,
        locale,
        revision: maxRevision(rows),
        publishedRevision: currentPublishedRevision(rows),
        values,
        faqItems: pageKey === 'home' ? (faq ?? []) : null,
        hasDraft,
        hasPublished: hasPublishedContent(rows, faqRows),
        lastPublishedAt: lastPublished(rows, faqRows),
      },
    };
  } catch (error) {
    logCmsFailure('editor-load-validation', pageKey, error);
    return {
      status: 'invalid',
      message: 'المحتوى المحفوظ غير صالح. لا يمكن تحريره حتى تتم معالجة البيانات.',
    };
  }
}

export async function getPublishedPageContent<K extends CmsPageKey>(
  rawPageKey: K,
  rawLocale: unknown = 'ar',
  options: CmsServiceOptions = {},
): Promise<CmsPageContent[K]> {
  const pageKey = assertCmsPageKey(rawPageKey);
  const locale = assertCmsLocale(rawLocale);

  if (!options.db && !process.env.DATABASE_URL?.trim()) {
    return defaultPageContent(pageKey) as unknown as CmsPageContent[K];
  }

  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logCmsFailure('public-load', pageKey, error);
    return defaultPageContent(pageKey) as unknown as CmsPageContent[K];
  }

  try {
    const snapshot = await db.transaction(
      async (tx) => {
        const sectionRows = await readPublishedSectionRows(tx, pageKey, locale);
        let faqRows: PublishedFaqRow[] = [];
        if (pageKey === 'home') {
          await options.testHooks?.afterSectionRead?.();
          faqRows = await readPublishedFaqRows(tx, locale);
        }
        return { sectionRows, faqRows };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );

    const overrides = effectiveSectionPayloads(snapshot.sectionRows, 'published');
    let faqForRender = DEFAULT_FAQ_FOR_RENDER;

    if (pageKey === 'home' && snapshot.faqRows.length > 0) {
      const publishedItems = publishedFaqItems(snapshot.faqRows);
      const visible = publishedItems.filter((item) => item.visible);
      assertFaqRenderable(publishedItems);
      faqForRender = visible.map(({ question, answer }) => ({ question, answer }));
    }

    return composeValidated(pageKey, overrides, faqForRender) as unknown as CmsPageContent[K];
  } catch (error) {
    logCmsFailure('public-load', pageKey, error);
    return defaultPageContent(pageKey) as unknown as CmsPageContent[K];
  }
}

export async function getPreviewPageContent<K extends CmsPageKey>(
  rawPageKey: K,
  rawLocale: unknown = 'ar',
  options: CmsServiceOptions = {},
): Promise<CmsPageContent[K]> {
  const pageKey = assertCmsPageKey(rawPageKey);
  const locale = assertCmsLocale(rawLocale);
  const db = resolveDb(options);

  try {
    const snapshot = await db.transaction(
      async (tx) => {
        const sectionRows = await readSectionRows(tx, pageKey, locale);
        if (pageKey !== 'home') {
          return { sectionRows, faqRows: [] as FaqRow[] };
        }
        await options.testHooks?.afterSectionRead?.();
        const faq = await readFaqRows(tx, locale);
        return { sectionRows, faqRows: faq };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );

    const overrides = effectiveSectionPayloads(snapshot.sectionRows, 'draft');
    let faqForRender = DEFAULT_FAQ_FOR_RENDER;

    if (pageKey === 'home' && snapshot.faqRows.length > 0) {
      const items = draftFaqItems(snapshot.faqRows);
      assertFaqRenderable(items);
      faqForRender = items
        .filter((item) => item.visible)
        .map(({ question, answer }) => ({ question, answer }));
    }

    return composeValidated(pageKey, overrides, faqForRender) as unknown as CmsPageContent[K];
  } catch (error) {
    if (error instanceof CmsError) throw error;
    if (postgresErrorCode(error) === '42P01') throw new CmsNotMigratedError();
    throw new CmsStorageError();
  }
}

export async function getPublicationReview(
  args: { pageKey: unknown; locale: unknown; expectedRevision: unknown },
  options: CmsServiceOptions = {},
): Promise<PublicationReview> {
  const pageKey = assertCmsPageKey(args.pageKey);
  const locale = assertCmsLocale(args.locale);
  const expectedRevision = assertExpectedRevision(args.expectedRevision);
  const db = resolveDb(options);

  try {
    const snapshot = await db.transaction(
      async (tx) => {
        const rows = await readSectionRows(tx, pageKey, locale);
        let faqRows: FaqRow[] = [];
        if (pageKey === 'home') faqRows = await readFaqRows(tx, locale);
        return { rows, faqRows };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );

    const { rows, faqRows } = snapshot;
    const revision = maxRevision(rows);
    if (revision !== expectedRevision) throw new CmsConflictError();

    const faqDiffers = pageKey === 'home' && faqDraftDiffers(faqRows);
    const hasSectionDraft = rows.some((row) => row.draftPayload !== null);
    if (!hasSectionDraft && !faqDiffers) throw new CmsNoDraftError();

    const draftFaq =
      pageKey === 'home'
        ? faqRows.length > 0
          ? draftFaqItems(faqRows)
          : DEFAULT_FAQ_ITEMS.map((item) => ({ ...item }))
        : null;
    const publishedFaq =
      pageKey === 'home'
        ? faqRows.some((row) => row.publishedQuestion !== null)
          ? publishedReviewFaqItems(faqRows)
          : DEFAULT_FAQ_ITEMS.map((item) => ({ ...item }))
        : null;

    const draftContent = composeValidated(
      pageKey,
      effectiveSectionPayloads(rows, 'draft'),
      (draftFaq ?? DEFAULT_FAQ_ITEMS).map(({ question, answer }) => ({ question, answer })),
    );
    const publishedContent = composeValidated(
      pageKey,
      effectiveSectionPayloads(rows, 'published'),
      (publishedFaq ?? DEFAULT_FAQ_ITEMS).map(({ question, answer }) => ({ question, answer })),
    );

    return buildPublicationReview({
      pageKey,
      draftContent,
      publishedContent,
      draftFaq,
      publishedFaq,
      revision,
      publishedRevision: currentPublishedRevision(rows),
      lastPublishedAt: lastPublished(rows, faqRows),
      publishedSource: hasPublishedContent(rows, faqRows) ? 'published' : 'defaults',
    });
  } catch (error) {
    if (error instanceof CmsError) throw error;
    if (postgresErrorCode(error) === '42P01') throw new CmsNotMigratedError();
    throw new CmsStorageError();
  }
}

async function lockPage(tx: QueryDb, pageKey: CmsPageKey, locale: CmsLocale): Promise<void> {
  const key = `nokmel.cms.page:${pageKey}:${locale}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key})::bigint)`);
}

type SaveDraftArgs = {
  pageKey: unknown;
  locale: unknown;
  expectedRevision: unknown;
  values: unknown;
  faqItems?: unknown;
};

export async function savePageDraft(
  args: SaveDraftArgs,
  options: CmsServiceOptions = {},
): Promise<SaveDraftResult> {
  const pageKey = assertCmsPageKey(args.pageKey);
  const locale = assertCmsLocale(args.locale);
  const expectedRevision = assertExpectedRevision(args.expectedRevision);

  if (pageKey === 'home') {
    if (args.faqItems === undefined) {
      throw new CmsValidationError('قائمة الأسئلة الشائعة مطلوبة للصفحة الرئيسية.');
    }
    assertEditablePayloadSize(args.faqItems);
  } else if (args.faqItems !== undefined) {
    throw new CmsValidationError('الأسئلة الشائعة خاصة بالصفحة الرئيسية فقط.');
  }

  assertEditablePayloadSize(args.values);
  const parsedFaq =
    pageKey === 'home' ? cmsFaqItemsInputSchema.parse(args.faqItems) : undefined;
  const sectionPayloads = buildSectionPayloads(pageKey, args.values);
  const parsedValues = extractPageValues(
    pageKey,
    composeValidated(
      pageKey,
      sectionPayloads,
      parsedFaq?.map(({ question, answer }) => ({ question, answer })) ?? [],
    ),
  );

  const db = resolveDb(options);

  return db.transaction(async (tx) => {
    await lockPage(tx, pageKey, locale);
    const rows = await readSectionRows(tx, pageKey, locale);
    if (maxRevision(rows) !== expectedRevision) {
      throw new CmsConflictError();
    }
    const faqRows = pageKey === 'home' ? await readFaqRows(tx, locale) : [];
    const nextRevision = expectedRevision + 1;
    const now = new Date();

    for (const section of getPageDefinition(pageKey).sections) {
      const payload = sectionPayloads[section.key];
      if (!payload) throw new CmsValidationError('قسم محتوى غير معروف.');
      await tx
        .insert(contentSections)
        .values({
          id: `${pageKey}:${section.key}:${locale}`,
          pageKey,
          sectionKey: section.key,
          locale,
          draftPayload: payload,
          draftRevision: nextRevision,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [contentSections.pageKey, contentSections.sectionKey, contentSections.locale],
          set: {
            draftPayload: payload,
            draftRevision: nextRevision,
            updatedAt: now,
          },
        });
    }

    let savedFaq: CmsFaqItem[] | null = null;
    if (pageKey === 'home' && parsedFaq) {
      savedFaq = await syncFaqDrafts(tx, locale, parsedFaq, faqRows, now);
    }

    return {
      revision: nextRevision,
      publishedRevision: currentPublishedRevision(rows),
      values: parsedValues,
      faqItems: savedFaq,
      hasDraft: true,
      hasPublished: hasPublishedContent(rows, faqRows),
      lastPublishedAt: lastPublished(rows, faqRows),
    };
  });
}

async function syncFaqDrafts(
  tx: QueryDb,
  locale: CmsLocale,
  items: readonly { id?: string; question: string; answer: string; visible: boolean }[],
  existingRows: FaqRow[],
  now: Date,
): Promise<CmsFaqItem[]> {
  const defaultIds = new Set(DEFAULT_FAQ_ITEMS.map((item) => item.id));
  const existing = new Map(existingRows.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const saved: CmsFaqItem[] = [];

  for (const [index, item] of items.entries()) {
    let id = item.id;
    if (id) {
      if (seen.has(id)) throw new CmsValidationError('معرّف سؤال مكرر.');
      seen.add(id);
      const row = existing.get(id);
      if (row) {
        await tx
          .update(faqItems)
          .set({
            draftQuestion: item.question,
            draftAnswer: item.answer,
            draftSortOrder: index,
            draftVisible: item.visible,
            draftDeleted: false,
            updatedAt: now,
          })
          .where(eq(faqItems.id, id));
      } else if (defaultIds.has(id)) {
        await tx.insert(faqItems).values({
          id,
          locale,
          draftQuestion: item.question,
          draftAnswer: item.answer,
          draftSortOrder: index,
          draftVisible: item.visible,
          updatedAt: now,
        });
      } else {
        throw new CmsValidationError('معرّف سؤال غير معروف.');
      }
    } else {
      id = `faq-${randomUUID()}`;
      seen.add(id);
      await tx.insert(faqItems).values({
        id,
        locale,
        draftQuestion: item.question,
        draftAnswer: item.answer,
        draftSortOrder: index,
        draftVisible: item.visible,
        updatedAt: now,
      });
    }
    saved.push({ id, question: item.question, answer: item.answer, visible: item.visible });
  }

  for (const row of existingRows) {
    if (seen.has(row.id)) continue;
    if (row.publishedQuestion !== null) {
      await tx
        .update(faqItems)
        .set({ draftDeleted: true, updatedAt: now })
        .where(eq(faqItems.id, row.id));
    } else {
      await tx.delete(faqItems).where(eq(faqItems.id, row.id));
    }
  }

  return saved;
}

export async function publishPageContent(
  args: { pageKey: unknown; locale: unknown; expectedRevision: unknown },
  options: CmsServiceOptions = {},
): Promise<PublishResult> {
  const pageKey = assertCmsPageKey(args.pageKey);
  const locale = assertCmsLocale(args.locale);
  const expectedRevision = assertExpectedRevision(args.expectedRevision);
  const db = resolveDb(options);

  return db.transaction(async (tx) => {
    await lockPage(tx, pageKey, locale);
    const rows = await readSectionRows(tx, pageKey, locale);
    if (maxRevision(rows) !== expectedRevision) {
      throw new CmsConflictError();
    }
    const faqRows = pageKey === 'home' ? await readFaqRows(tx, locale) : [];
    const faqDiffers = pageKey === 'home' && faqDraftDiffers(faqRows);
    const hasSectionDraft = rows.some((row) => row.draftPayload !== null);
    if (!hasSectionDraft && !faqDiffers) {
      throw new CmsNoDraftError();
    }

    const overrides = effectiveSectionPayloads(rows, 'draft');
    let faqForRender = DEFAULT_FAQ_FOR_RENDER;
    let draftFaqs: CmsFaqItem[] | null = null;
    if (pageKey === 'home') {
      if (faqRows.length > 0) {
        draftFaqs = draftFaqItems(faqRows);
        assertFaqRenderable(draftFaqs);
        faqForRender = draftFaqs
          .filter((item) => item.visible)
          .map(({ question, answer }) => ({ question, answer }));
      }
    }

    composeValidated(pageKey, overrides, faqForRender);

    const now = new Date();
    for (const row of rows) {
      if (row.draftPayload === null) continue;
      await tx
        .update(contentSections)
        .set({
          publishedPayload: row.draftPayload,
          publishedRevision: row.draftRevision,
          publishedAt: now,
          draftPayload: null,
          updatedAt: now,
        })
        .where(eq(contentSections.id, row.id));
    }

    if (pageKey === 'home' && faqRows.length > 0) {
      for (const row of faqRows) {
        if (row.draftDeleted) {
          await tx.delete(faqItems).where(eq(faqItems.id, row.id));
          continue;
        }
        await tx
          .update(faqItems)
          .set({
            publishedQuestion: row.draftQuestion,
            publishedAnswer: row.draftAnswer,
            publishedSortOrder: row.draftSortOrder,
            publishedVisible: row.draftVisible,
            publishedAt: now,
            draftDeleted: false,
            updatedAt: now,
          })
          .where(eq(faqItems.id, row.id));
      }
    }

    return {
      revision: expectedRevision,
      publishedRevision: expectedRevision,
      publishedAt: now.toISOString(),
      hasDraft: false,
      hasPublished: true,
      lastPublishedAt: now.toISOString(),
    };
  });
}

export async function discardPageDraft(
  args: { pageKey: unknown; locale: unknown; expectedRevision: unknown },
  options: CmsServiceOptions = {},
): Promise<DiscardResult> {
  const pageKey = assertCmsPageKey(args.pageKey);
  const locale = assertCmsLocale(args.locale);
  const expectedRevision = assertExpectedRevision(args.expectedRevision);
  const db = resolveDb(options);

  return db.transaction(async (tx) => {
    await lockPage(tx, pageKey, locale);
    const rows = await readSectionRows(tx, pageKey, locale);
    if (maxRevision(rows) !== expectedRevision) {
      throw new CmsConflictError();
    }
    const faqRows = pageKey === 'home' ? await readFaqRows(tx, locale) : [];
    const hasSectionDraft = rows.some((row) => row.draftPayload !== null);
    const faqDiffers = pageKey === 'home' && faqDraftDiffers(faqRows);
    if (!hasSectionDraft && !faqDiffers) {
      throw new CmsNoChangesError();
    }

    const nextRevision = expectedRevision + 1;
    const now = new Date();
    for (const row of rows) {
      await tx
        .update(contentSections)
        .set({ draftPayload: null, draftRevision: nextRevision, updatedAt: now })
        .where(eq(contentSections.id, row.id));
    }

    if (pageKey === 'home') {
      for (const row of faqRows) {
        if (row.publishedQuestion === null) {
          await tx.delete(faqItems).where(eq(faqItems.id, row.id));
          continue;
        }
        await tx
          .update(faqItems)
          .set({
            draftQuestion: row.publishedQuestion,
            draftAnswer: row.publishedAnswer ?? row.draftAnswer,
            draftSortOrder: row.publishedSortOrder ?? row.draftSortOrder,
            draftVisible: row.publishedVisible ?? true,
            draftDeleted: false,
            updatedAt: now,
          })
          .where(eq(faqItems.id, row.id));
      }
    }

    return {
      revision: nextRevision,
      hasDraft: false,
      hasPublished: hasPublishedContent(rows, faqRows),
      lastPublishedAt: lastPublished(rows, faqRows),
    };
  });
}

export function listCmsPages() {
  return CMS_PAGES;
}

export { CmsConflictError, CmsNoChangesError, CmsNoDraftError, CmsStorageError, CmsValidationError };
