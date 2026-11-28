import { createHash } from 'node:crypto';
import { chmodSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Client } from 'pg';
import { z } from 'zod';
import {
  CMS_MAX_EDITABLE_JSON_BYTES,
  CMS_MAX_FAQ_ITEMS,
  CMS_PAGE_KEYS,
  assertFaqRenderable,
  cmsFaqIdSchema,
  cmsFaqItemInputSchema,
  composePageContent,
  defaultSectionPayloads,
  getSectionDefinition,
  type CmsPageKey,
  type SectionPayload,
} from '@/content/cms/registry';
import { CMS_SEO_SECTION_KEY, parseStoredSeo } from '@/content/cms/seo';
import { resolveDatabaseConnectionPolicy } from '@/lib/db/connection-policy';

/**
 * W6-R05 controlled published-content transfer.
 *
 * Exports only explicitly selected published CMS/FAQ/SEO rows, validates them
 * offline against the real registry schemas, refuses an unexpected target, and
 * imports transactionally into a fresh migrated database. It never reads or
 * writes accounts, sessions, plans, join requests, rate-limit data, private
 * settings or integration configuration.
 *
 * A nonempty content target, wrong target identity, malformed/extra content or
 * digest mismatch aborts without committing. No URL or credential is printed.
 */

export const CONTENT_TRANSFER_FORMAT = 'nokmel-content-transfer';
export const CONTENT_TRANSFER_VERSION = 1;
export const CONTENT_TRANSFER_SOURCE_ENV = 'CONTENT_TRANSFER_SOURCE_URL';
export const CONTENT_TRANSFER_TARGET_ENV = 'CONTENT_TRANSFER_TARGET_URL';
export const CONTENT_TRANSFER_ADVISORY_LOCK = 'nokmel.w6.content_import';
export const CONTENT_TRANSFER_MAX_SECTIONS = 100;
export const CONTENT_TRANSFER_MAX_FILE_BYTES = 2 * 1024 * 1024;

export class ContentTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentTransferError';
  }
}

const isoDate = z
  .string()
  .refine((value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  }, 'التاريخ يجب أن يكون ISO-8601 UTC صالحاً.');

const payloadSchema = z.unknown().refine(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  'الحمولة يجب أن تكون كائن JSON.',
);

const sectionRowSchema = z
  .object({
    id: z.string().min(1).max(200),
    page_key: z.enum(CMS_PAGE_KEYS),
    section_key: z.string().min(1).max(80),
    locale: z.literal('ar'),
    published_payload: payloadSchema,
    published_revision: z.number().int().min(1).max(1_000_000),
    published_at: isoDate,
  })
  .strict();

const faqRowSchema = z
  .object({
    id: cmsFaqIdSchema,
    locale: z.literal('ar'),
    published_question: z.string().min(1).max(300),
    published_answer: z.string().min(1).max(2000),
    published_sort_order: z.number().int().min(0).max(9999),
    published_visible: z.boolean(),
    published_at: isoDate,
  })
  .strict();

const fileSchema = z
  .object({
    format: z.literal(CONTENT_TRANSFER_FORMAT),
    version: z.literal(CONTENT_TRANSFER_VERSION),
    generated_at: isoDate,
    source_identity: z.string().min(1).max(300),
    pages: z.array(z.enum(CMS_PAGE_KEYS)).min(1).max(CMS_PAGE_KEYS.length),
    section_count: z.number().int().min(0).max(CONTENT_TRANSFER_MAX_SECTIONS),
    faq_count: z.number().int().min(0).max(CMS_MAX_FAQ_ITEMS),
    digest: z.string().regex(/^[0-9a-f]{64}$/),
    sections: z.array(sectionRowSchema).max(CONTENT_TRANSFER_MAX_SECTIONS),
    faq: z.array(faqRowSchema).max(CMS_MAX_FAQ_ITEMS),
  })
  .strict();

export type ContentTransferSection = z.infer<typeof sectionRowSchema>;
export type ContentTransferFaq = z.infer<typeof faqRowSchema>;
export type ContentTransferFile = z.infer<typeof fileSchema>;

export type ContentTransferSummary = {
  sourceIdentity: string;
  targetIdentity?: string;
  pages: CmsPageKey[];
  sectionCount: number;
  faqCount: number;
  digest: string;
  dryRun?: boolean;
};

type CanonicalSection = ContentTransferSection;
type CanonicalFaq = ContentTransferFaq;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function canonicalContentDigest(
  sections: readonly CanonicalSection[],
  faq: readonly CanonicalFaq[],
  pages: readonly string[],
): string {
  const normalized = canonicalize({
    pages: [...pages].sort(),
    sections: [...sections].sort((a, b) => a.id.localeCompare(b.id)),
    faq: [...faq].sort(
      (a, b) =>
        a.published_sort_order - b.published_sort_order || a.id.localeCompare(b.id),
    ),
  });
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function assertExactShape(value: unknown, template: unknown, path: string): void {
  if (template === null || value === null) {
    if (value !== template) {
      throw new ContentTransferError(`بنية غير صالحة في ${path}: قيمة null غير متوقعة.`);
    }
    return;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) {
      throw new ContentTransferError(`بنية غير صالحة في ${path}: مصفوفة متوقعة.`);
    }
    if (value.length !== template.length) {
      throw new ContentTransferError(`بنية غير صالحة في ${path}: طول مصفوفة غير متوقع.`);
    }
    for (let index = 0; index < value.length; index += 1) {
      assertExactShape(value[index], template[index], `${path}[${index}]`);
    }
    return;
  }
  if (template && typeof template === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ContentTransferError(`بنية غير صالحة في ${path}: كائن متوقع.`);
    }
    const expectedKeys = Object.keys(template as Record<string, unknown>).sort();
    const actualKeys = Object.keys(value as Record<string, unknown>).sort();
    if (
      expectedKeys.length !== actualKeys.length ||
      expectedKeys.some((key, index) => key !== actualKeys[index])
    ) {
      throw new ContentTransferError(`بنية غير صالحة في ${path}: مفاتيح غير متوقعة.`);
    }
    for (const key of expectedKeys) {
      assertExactShape(
        (value as Record<string, unknown>)[key],
        (template as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
    }
    return;
  }
  if (typeof value !== typeof template) {
    throw new ContentTransferError(`بنية غير صالحة في ${path}: نوع قيمة غير متوقع.`);
  }
}

function assertTimestamp(value: string, path: string, now: Date): void {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new ContentTransferError(`تاريخ غير صالح في ${path}.`);
  }
  if (timestamp < Date.parse('2020-01-01T00:00:00.000Z')) {
    throw new ContentTransferError(`تاريخ قديم غير متوقع في ${path}.`);
  }
  if (timestamp > now.getTime() + 24 * 60 * 60 * 1000) {
    throw new ContentTransferError(`تاريخ مستقبلي غير متوقع في ${path}.`);
  }
}

function parsePageKeys(pages: readonly string[]): CmsPageKey[] {
  const unique = [...new Set(pages)];
  if (unique.length === 0) throw new ContentTransferError('اختر صفحة واحدة على الأقل.');
  for (const page of unique) {
    if (!CMS_PAGE_KEYS.includes(page as CmsPageKey)) {
      throw new ContentTransferError(`صفحة غير مسجلة: ${page}`);
    }
  }
  return unique as CmsPageKey[];
}

export function validateContentTransfer(
  raw: unknown,
  options: { now?: Date; expectedDigest?: string } = {},
): ContentTransferFile {
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.map(String).join('.') || 'file';
    throw new ContentTransferError(`ملف نقل المحتوى غير صالح عند ${path}.`);
  }
  const file = parsed.data;
  const now = options.now ?? new Date();
  const pages = parsePageKeys(file.pages);
  if (new Set(file.pages).size !== file.pages.length) {
    throw new ContentTransferError('قائمة الصفحات تحتوي على تكرار.');
  }
  if (file.sections.length !== file.section_count) {
    throw new ContentTransferError('عدد أقسام الملف لا يطابق البيان.');
  }
  if (file.faq.length !== file.faq_count) {
    throw new ContentTransferError('عدد أسئلة الملف لا يطابق البيان.');
  }
  if (file.faq.length > 0 && !pages.includes('home')) {
    throw new ContentTransferError('لا يمكن تصدير أسئلة شائعة بدون صفحة الرئيسية.');
  }

  const sectionIds = new Set<string>();
  const identities = new Set<string>();
  const payloadByPage = new Map<CmsPageKey, Record<string, SectionPayload>>();
  for (const row of file.sections) {
    if (!pages.includes(row.page_key)) {
      throw new ContentTransferError(`القسم ${row.id} لصفحة غير مطلوبة.`);
    }
    const expectedId = `${row.page_key}:${row.section_key}:${row.locale}`;
    if (row.id !== expectedId) {
      throw new ContentTransferError(`معرّف قسم غير متوقع: ${row.id}`);
    }
    const identity = `${row.page_key}:${row.section_key}:${row.locale}`;
    if (identities.has(identity)) {
      throw new ContentTransferError(`قسم مكرر: ${identity}`);
    }
    identities.add(identity);
    if (sectionIds.has(row.id)) throw new ContentTransferError(`معرّف قسم مكرر: ${row.id}`);
    sectionIds.add(row.id);
    assertTimestamp(row.published_at, `${row.id}.published_at`, now);
    if (typeof row.published_revision !== 'number' || row.published_revision < 1) {
      throw new ContentTransferError(`إصدار نشر غير صالح: ${row.id}`);
    }
    const payloadBytes = Buffer.byteLength(JSON.stringify(row.published_payload), 'utf8');
    if (payloadBytes > CMS_MAX_EDITABLE_JSON_BYTES) {
      throw new ContentTransferError(`حمولة قسم أكبر من الحد: ${row.id}`);
    }

    if (row.section_key === CMS_SEO_SECTION_KEY) {
      if (!parseStoredSeo(row.published_payload).ok) {
        throw new ContentTransferError(`حمولة SEO غير صالحة: ${row.id}`);
      }
      continue;
    }

    try {
      getSectionDefinition(row.page_key, row.section_key);
    } catch {
      throw new ContentTransferError(`قسم غير مسجل: ${row.id}`);
    }
    const template = defaultSectionPayloads(row.page_key)[row.section_key];
    if (!template) {
      throw new ContentTransferError(`قسم غير معروف: ${row.id}`);
    }
    assertExactShape(row.published_payload, template, row.id);
    const pagePayloads = payloadByPage.get(row.page_key) ?? {};
    pagePayloads[row.section_key] = row.published_payload as SectionPayload;
    payloadByPage.set(row.page_key, pagePayloads);
  }

  const faqIds = new Set<string>();
  const faqOrders = new Set<number>();
  for (const row of file.faq) {
    if (faqIds.has(row.id)) throw new ContentTransferError(`سؤال مكرر: ${row.id}`);
    faqIds.add(row.id);
    if (faqOrders.has(row.published_sort_order)) {
      throw new ContentTransferError('ترتيب أسئلة شائعة مكرر.');
    }
    faqOrders.add(row.published_sort_order);
    assertTimestamp(row.published_at, `${row.id}.published_at`, now);
    try {
      cmsFaqItemInputSchema.parse({
        id: row.id,
        question: row.published_question,
        answer: row.published_answer,
        visible: row.published_visible,
      });
    } catch {
      throw new ContentTransferError(`سؤال شائع غير صالح: ${row.id}`);
    }
  }
  if (file.faq.length > 0) {
    assertFaqRenderable(
      file.faq.map((row) => ({
        id: row.id,
        question: row.published_question,
        answer: row.published_answer,
        visible: row.published_visible,
      })),
    );
  }

  for (const pageKey of pages) {
    try {
      composePageContent(
        pageKey,
        payloadByPage.get(pageKey) ?? {},
        pageKey === 'home'
          ? file.faq.map((row) => ({
              question: row.published_question,
              answer: row.published_answer,
            }))
          : [],
      );
    } catch (error) {
      throw new ContentTransferError(
        `محتوى الصفحة ${pageKey} غير صالح: ${error instanceof Error ? error.message : 'خطأ'}`,
      );
    }
  }

  const digest = canonicalContentDigest(file.sections, file.faq, file.pages);
  if (digest !== file.digest) {
    throw new ContentTransferError('بصمة المحتوى لا تطابق البيان.');
  }
  if (options.expectedDigest && options.expectedDigest !== digest) {
    throw new ContentTransferError('بصمة المحتوى لا تطابق البصمة المتوقعة.');
  }
  return file;
}

export function loadContentTransferFile(
  filePath: string,
  options: { now?: Date; expectedDigest?: string } = {},
): ContentTransferFile {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    throw new ContentTransferError('تعذّرت قراءة ملف نقل المحتوى أو أنه JSON غير صالح.');
  }
  return validateContentTransfer(raw, options);
}

function databaseIdentity(host: string, port: number, database: string): string {
  return `${host}:${port}/${database}`;
}

function resolveTransferTarget(
  raw: string | undefined,
  label: string,
): { url: string; identity: string; database: string; tls: false | { rejectUnauthorized: true } } {
  if (!raw?.trim()) throw new ContentTransferError(`${label} غير مهيأ.`);
  const policy = resolveDatabaseConnectionPolicy(raw, { label });
  if (policy.host.toLowerCase().includes('pooler')) {
    throw new ContentTransferError(`${label} يجب أن يستخدم اتصالاً مباشراً غير مجمّع.`);
  }
  return {
    url: policy.connectionString,
    identity: databaseIdentity(policy.host, policy.port, policy.database),
    database: policy.database,
    tls: policy.tls,
  };
}

async function withClient<T>(
  url: string,
  database: string,
  tls: false | { rejectUnauthorized: true },
  work: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url, ssl: tls });
  await client.connect();
  try {
    const { rows } = await client.query('select current_database() as database');
    if (rows[0]?.database !== database) {
      throw new ContentTransferError('هوية قاعدة البيانات الفعلية لا تطابق الاتصال.');
    }
    return await work(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function exportPublishedContent(args: {
  sourceUrl: string | undefined;
  expectedSourceIdentity: string;
  pages: readonly string[];
  includeFaq: boolean;
  filePath: string;
  now?: Date;
}): Promise<{ summary: ContentTransferSummary; file: ContentTransferFile }> {
  const pages = parsePageKeys(args.pages);
  if (args.includeFaq && !pages.includes('home')) {
    throw new ContentTransferError('تصدير الأسئلة الشائعة يتطلب صفحة الرئيسية.');
  }
  const target = resolveTransferTarget(args.sourceUrl, 'CONTENT_TRANSFER_SOURCE_URL');
  if (target.identity !== args.expectedSourceIdentity) {
    throw new ContentTransferError('هوية مصدر المحتوى لا تطابق الهوية المتوقعة.');
  }
  const now = args.now ?? new Date();

  const exported = await withClient(target.url, target.database, target.tls, async (client) => {
    // One coherent published snapshot for sections + FAQ/SEO. The source
    // should still be frozen during export so the recorded digest matches the
    // approved manifest.
    await client.query('begin transaction isolation level repeatable read read only');
    try {
      const sections = await client.query(
        `select id, page_key, section_key, locale, published_payload,
                published_revision, published_at
           from content_sections
          where page_key = any($1::text[])
            and published_payload is not null
          order by id`,
        [pages],
      );
      const faq = args.includeFaq
        ? await client.query(
            `select id, locale, published_question, published_answer,
                    published_sort_order, published_visible, published_at
               from faq_items
              where locale = 'ar' and published_question is not null
              order by published_sort_order, id`,
          )
        : { rows: [] as Record<string, unknown>[] };
      await client.query('commit');
      return {
        sections: sections.rows.map((row) => ({
          ...row,
          published_at: new Date(row.published_at).toISOString(),
        })),
        faq: faq.rows.map((row) => ({
          ...row,
          published_at: new Date(row.published_at).toISOString(),
        })),
      };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    }
  });

  const digest = canonicalContentDigest(
    exported.sections as ContentTransferSection[],
    exported.faq as ContentTransferFaq[],
    pages,
  );
  const file: ContentTransferFile = {
    format: CONTENT_TRANSFER_FORMAT,
    version: CONTENT_TRANSFER_VERSION,
    generated_at: now.toISOString(),
    source_identity: target.identity,
    pages,
    section_count: exported.sections.length,
    faq_count: exported.faq.length,
    digest,
    sections: exported.sections as ContentTransferSection[],
    faq: exported.faq as ContentTransferFaq[],
  };
  const validated = validateContentTransfer(file, { now });
  const temporary = join(dirname(args.filePath), `.${Date.now()}-${process.pid}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, args.filePath);
  return {
    file: validated,
    summary: {
      sourceIdentity: target.identity,
      pages,
      sectionCount: validated.section_count,
      faqCount: validated.faq_count,
      digest: validated.digest,
    },
  };
}

async function assertTargetReady(client: Client): Promise<void> {
  const migrations = await client.query(
    'select count(*)::int as count from drizzle.__drizzle_migrations',
  );
  if (migrations.rows[0].count < 6) {
    throw new ContentTransferError('قاعدة الهدف لم تُطبّق عليها الهجرات المطلوبة (0000–0005).');
  }
  const required = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
        and table_name in ('content_sections','faq_items','plans','join_requests','join_intake_rate_limits','site_settings')`,
  );
  if (required.rows.length !== 6) {
    throw new ContentTransferError('مخطط قاعدة الهدف غير مكتمل.');
  }
  const nonempty = await client.query(
    `select
       (select count(*) from content_sections) as content_sections,
       (select count(*) from faq_items) as faq_items,
       (select count(*) from plans) as plans,
       (select count(*) from join_requests) as join_requests,
       (select count(*) from join_intake_rate_limits) as join_intake_rate_limits,
       (select count(*) from site_settings) as site_settings`,
  );
  const row = nonempty.rows[0] as Record<string, string | number>;
  const unexpected = Object.entries(row).filter(([, value]) => Number(value) > 0);
  if (unexpected.length > 0) {
    throw new ContentTransferError(
      `قاعدة الهدف ليست فارغة للمحتوى/البيانات غير المتوقعة: ${unexpected.map(([key]) => key).join(', ')}`,
    );
  }
}

async function readTargetDigest(client: Client): Promise<{
  sections: ContentTransferSection[];
  faq: ContentTransferFaq[];
}> {
  const sections = await client.query(
    `select id, page_key, section_key, locale, published_payload,
            published_revision, published_at
       from content_sections
      order by id`,
  );
  const faq = await client.query(
    `select id, locale, published_question, published_answer,
            published_sort_order, published_visible, published_at
       from faq_items
      order by published_sort_order, id`,
  );
  return {
    sections: sections.rows.map((row) => ({
      ...row,
      published_at: new Date(row.published_at).toISOString(),
    })) as ContentTransferSection[],
    faq: faq.rows.map((row) => ({
      ...row,
      published_at: new Date(row.published_at).toISOString(),
    })) as ContentTransferFaq[],
  };
}

export async function importPublishedContent(args: {
  targetUrl: string | undefined;
  expectedTargetIdentity: string;
  filePath: string;
  expectedDigest: string;
  dryRun: boolean;
  now?: Date;
}): Promise<ContentTransferSummary> {
  const file = loadContentTransferFile(args.filePath, {
    now: args.now,
    expectedDigest: args.expectedDigest,
  });
  const target = resolveTransferTarget(args.targetUrl, 'CONTENT_TRANSFER_TARGET_URL');
  if (target.identity !== args.expectedTargetIdentity) {
    throw new ContentTransferError('هوية قاعدة الهدف لا تطابق الهوية المتوقعة.');
  }

  return withClient(target.url, target.database, target.tls, async (client) => {
    await client.query('begin');
    try {
      await client.query('select pg_advisory_xact_lock(hashtext($1)::bigint)', [
        CONTENT_TRANSFER_ADVISORY_LOCK,
      ]);
      await assertTargetReady(client);

      for (const row of file.sections) {
        await client.query(
          `insert into content_sections
             (id, page_key, section_key, locale, draft_payload, draft_revision,
              published_payload, published_revision, published_at, updated_at)
           values ($1, $2, $3, $4, null, $5, $6::jsonb, $5, $7, now())`,
          [
            row.id,
            row.page_key,
            row.section_key,
            row.locale,
            row.published_revision,
            JSON.stringify(row.published_payload),
            row.published_at,
          ],
        );
      }
      for (const row of file.faq) {
        await client.query(
          `insert into faq_items
             (id, locale, draft_question, draft_answer, draft_sort_order,
              draft_visible, draft_deleted, published_question, published_answer,
              published_sort_order, published_visible, published_at, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, false, $3, $4, $5, $6, $7, now(), now())`,
          [
            row.id,
            row.locale,
            row.published_question,
            row.published_answer,
            row.published_sort_order,
            row.published_visible,
            row.published_at,
          ],
        );
      }

      const readback = await readTargetDigest(client);
      const digest = canonicalContentDigest(readback.sections, readback.faq, file.pages);
      if (digest !== file.digest) {
        throw new ContentTransferError('فشل التحقق بعد الاستيراد: البصمة لا تطابق.');
      }
      const drafts = await client.query(
        `select
           (select count(*) from content_sections where draft_payload is not null) as section_drafts,
           (select count(*) from faq_items
             where draft_deleted
                or draft_question is distinct from published_question
                or draft_answer is distinct from published_answer
                or draft_sort_order is distinct from published_sort_order
                or draft_visible is distinct from published_visible) as faq_drafts`,
      );
      if (Number(drafts.rows[0].section_drafts) > 0 || Number(drafts.rows[0].faq_drafts) > 0) {
        throw new ContentTransferError('فشل التحقق بعد الاستيراد: توجد مسودات غير متوقعة.');
      }

      if (args.dryRun) await client.query('rollback');
      else await client.query('commit');

      return {
        sourceIdentity: file.source_identity,
        targetIdentity: target.identity,
        pages: file.pages,
        sectionCount: file.section_count,
        faqCount: file.faq_count,
        digest: file.digest,
        dryRun: args.dryRun,
      };
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    }
  });
}
