import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  applyMigrations,
  emptyDatabase,
  getDisposablePostgres,
} from './helpers';
import { defaultSectionPayloads } from '@/content/cms/registry';
import {
  ContentTransferError,
  canonicalContentDigest,
  exportPublishedContent,
  importPublishedContent,
  loadContentTransferFile,
  validateContentTransfer,
  type ContentTransferFile,
} from '../../scripts/content-transfer-lib';

const pg = await getDisposablePostgres();
const repoRoot = path.resolve(__dirname, '../..');
const now = new Date('2026-11-27T12:00:00.000Z');
const identity = `${pg.target.host}:${pg.target.port}/${pg.target.database}`;
let directory: string;
let filePath: string;
let exported: { digest: string; file: ContentTransferFile };

async function seedSource(): Promise<void> {
  const defaults = defaultSectionPayloads('home');
  const hero = { ...defaults.hero, title: 'عنوان تجريبي للتصدير' };
  const showcase = { ...defaults.showcase, visible: true };
  const seo = {
    title: 'عنوان SEO تجريبي',
    description: 'وصف SEO تجريبي للتحقق من نقل المحتوى المنشور.',
    socialImage: 'social-card-1200x630',
  };
  await pg.pool.query(
    `insert into content_sections
       (id, page_key, section_key, locale, draft_payload, published_payload,
        draft_revision, published_revision, published_at, updated_at)
     values
       ('home:hero:ar','home','hero','ar',null,$1::jsonb,3,3,'2026-11-20T10:00:00.000Z',now()),
       ('home:showcase:ar','home','showcase','ar',null,$2::jsonb,55,55,'2026-11-20T10:01:00.000Z',now()),
       ('home:seo:ar','home','seo','ar',null,$3::jsonb,2,2,'2026-11-20T10:02:00.000Z',now())`,
    [JSON.stringify(hero), JSON.stringify(showcase), JSON.stringify(seo)],
  );
  await pg.pool.query(
    `insert into faq_items
       (id, locale, draft_question, draft_answer, draft_sort_order, draft_visible,
        draft_deleted, published_question, published_answer, published_sort_order,
        published_visible, published_at, created_at, updated_at)
     values
       ('faq-w6-alpha','ar','سؤال ألفا','إجابة ألفا',0,true,false,'سؤال ألفا','إجابة ألفا',0,true,'2026-11-20T10:03:00.000Z',now(),now()),
       ('faq-w6-beta','ar','سؤال بيتا','إجابة بيتا',1,true,false,'سؤال بيتا','إجابة بيتا',1,true,'2026-11-20T10:04:00.000Z',now(),now())`,
  );
}

async function exportFile(): Promise<{ digest: string; file: ContentTransferFile }> {
  const result = await exportPublishedContent({
    sourceUrl: pg.url,
    expectedSourceIdentity: identity,
    pages: ['home'],
    includeFaq: true,
    filePath,
    now,
  });
  return { digest: result.summary.digest, file: result.file };
}

function writeMutatedFile(mutator: (file: ContentTransferFile) => void): string {
  const file = JSON.parse(readFileSync(filePath, 'utf8')) as ContentTransferFile;
  mutator(file);
  file.digest = canonicalContentDigest(file.sections, file.faq, file.pages);
  writeFileSync(filePath, JSON.stringify(file, null, 2));
  return file.digest;
}

function runCli(args: string[]): ReturnType<typeof spawnSync> {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  return spawnSync(command, ['exec', 'tsx', 'scripts/content-transfer.ts', ...args], {
    cwd: repoRoot,
    env: { ...process.env, CONTENT_TRANSFER_TARGET_URL: '', CONTENT_TRANSFER_SOURCE_URL: '' },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

beforeAll(async () => {
  await applyMigrations(pg);
});

beforeEach(async () => {
  await emptyDatabase(pg);
  await seedSource();
  directory = mkdtempSync(path.join(tmpdir(), 'nokmel-w6-content-'));
  filePath = path.join(directory, 'content.json');
  exported = await exportFile();
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

afterAll(async () => {
  await pg.stop();
});

describe('W6 controlled published-content transfer', () => {
  test('exports only published content and validates strict shape/digest', async () => {
    const before = await pg.pool.query(
      'select count(*)::int as count from content_sections where draft_payload is not null',
    );
    expect(before.rows[0].count).toBe(0);
    expect(exported.file.pages).toEqual(['home']);
    expect(exported.file.section_count).toBe(3);
    expect(exported.file.faq_count).toBe(2);
    expect(exported.file.sections.some((row) => row.section_key === 'seo')).toBe(true);
    expect(exported.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(loadContentTransferFile(filePath, { now, expectedDigest: exported.digest })).toEqual(
      exported.file,
    );
  });

  test('dry run validates target readiness but writes nothing; real import preserves published values', async () => {
    await emptyDatabase(pg);
    const dry = await importPublishedContent({
      targetUrl: pg.url,
      expectedTargetIdentity: identity,
      filePath,
      expectedDigest: exported.digest,
      dryRun: true,
      now,
    });
    expect(dry).toMatchObject({ sectionCount: 3, faqCount: 2, dryRun: true });
    const empty = await pg.pool.query('select count(*)::int as count from content_sections');
    expect(empty.rows[0].count).toBe(0);

    const imported = await importPublishedContent({
      targetUrl: pg.url,
      expectedTargetIdentity: identity,
      filePath,
      expectedDigest: exported.digest,
      dryRun: false,
      now,
    });
    expect(imported).toMatchObject({ sectionCount: 3, faqCount: 2, dryRun: false });

    const sections = await pg.pool.query(
      "select id, published_payload, draft_payload, draft_revision from content_sections order by id",
    );
    expect(sections.rows).toHaveLength(3);
    for (const row of sections.rows) {
      expect(row.draft_payload).toBeNull();
      expect(row.draft_revision).toBeGreaterThan(0);
    }
    const showcase = sections.rows.find((row) => row.id === 'home:showcase:ar');
    expect(showcase.published_payload.visible).toBe(true);
    const seo = sections.rows.find((row) => row.id === 'home:seo:ar');
    expect(seo.published_payload.socialImage).toBe('social-card-1200x630');

    const faq = await pg.pool.query(
      "select draft_question, draft_answer, draft_sort_order, draft_visible, published_question, published_answer, published_sort_order, published_visible, draft_deleted from faq_items order by published_sort_order",
    );
    expect(faq.rows).toHaveLength(2);
    for (const row of faq.rows) {
      expect(row.draft_question).toBe(row.published_question);
      expect(row.draft_answer).toBe(row.published_answer);
      expect(row.draft_sort_order).toBe(row.published_sort_order);
      expect(row.draft_visible).toBe(row.published_visible);
      expect(row.draft_deleted).toBe(false);
    }
    expect(await scalar('select count(*)::int as count from plans')).toBe(0);
    expect(await scalar('select count(*)::int as count from join_requests')).toBe(0);
    expect(await scalar('select count(*)::int as count from site_settings')).toBe(0);
  });

  test('refuses a target identity mismatch and a nonempty target', async () => {
    await emptyDatabase(pg);
    await expect(
      importPublishedContent({
        targetUrl: pg.url,
        expectedTargetIdentity: 'wrong-host:5432/wrong-db',
        filePath,
        expectedDigest: exported.digest,
        dryRun: false,
        now,
      }),
    ).rejects.toBeInstanceOf(ContentTransferError);
    expect(await scalar('select count(*)::int as count from content_sections')).toBe(0);

    await pg.pool.query(
      `insert into content_sections
         (id, page_key, section_key, locale, draft_revision, updated_at)
       values ('home:hero:ar','home','hero','ar',1,now())`,
    );
    await expect(
      importPublishedContent({
        targetUrl: pg.url,
        expectedTargetIdentity: identity,
        filePath,
        expectedDigest: exported.digest,
        dryRun: false,
        now,
      }),
    ).rejects.toThrow(/ليست فارغة/);
    expect(await scalar('select count(*)::int as count from faq_items')).toBe(0);
  });

  test('rejects malformed files, extra fields, wrong IDs, duplicate IDs and stale digests', async () => {
    expect(() =>
      validateContentTransfer({ ...exported.file, unexpected: true }, { now }),
    ).toThrow(ContentTransferError);
    expect(() =>
      validateContentTransfer(
        {
          ...exported.file,
          sections: [{ ...exported.file.sections[0], id: 'home:hero:wrong' }, ...exported.file.sections.slice(1)],
        },
        { now },
      ),
    ).toThrow(ContentTransferError);
    expect(() =>
      validateContentTransfer(
        {
          ...exported.file,
          sections: [exported.file.sections[0], exported.file.sections[0]],
          section_count: 2,
        },
        { now },
      ),
    ).toThrow(ContentTransferError);
    expect(() =>
      validateContentTransfer(exported.file, {
        now,
        expectedDigest: '0'.repeat(64),
      }),
    ).toThrow(ContentTransferError);

    writeMutatedFile((file) => {
      const hero = file.sections.find((row) => row.id === 'home:hero:ar');
      if (!hero) throw new Error('hero missing');
      (hero.published_payload as Record<string, unknown>).unexpected = 'x';
    });
    expect(() => loadContentTransferFile(filePath, { now })).toThrow(ContentTransferError);
  });

  test('rejects invalid SEO images, duplicate FAQ order and malformed JSON', async () => {
    writeMutatedFile((file) => {
      const seo = file.sections.find((row) => row.id === 'home:seo:ar');
      if (!seo) throw new Error('seo missing');
      (seo.published_payload as Record<string, unknown>).socialImage = 'not-approved';
    });
    expect(() => loadContentTransferFile(filePath, { now })).toThrow(ContentTransferError);

    writeMutatedFile((file) => {
      file.faq[1].published_sort_order = file.faq[0].published_sort_order;
    });
    expect(() => loadContentTransferFile(filePath, { now })).toThrow(ContentTransferError);

    writeFileSync(filePath, '{not-json');
    expect(() => loadContentTransferFile(filePath, { now })).toThrow(ContentTransferError);
  });

  test('CLI validates a real export and rejects a malformed file', async () => {
    const valid = runCli(['validate', '--file', filePath, '--expected-digest', exported.digest]);
    expect(valid.status, String(valid.stderr)).toBe(0);
    expect(valid.stdout).toContain('"ok": true');

    writeFileSync(filePath, '{not-json');
    const invalid = runCli(['validate', '--file', filePath]);
    expect(invalid.status).toBe(1);
  });
});

async function scalar(sql: string): Promise<number> {
  const result = await pg.pool.query(sql);
  return Number(result.rows[0].count);
}
