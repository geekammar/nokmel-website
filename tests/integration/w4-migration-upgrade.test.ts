import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { hashPassword } from 'better-auth/crypto';
import { getDisposablePostgres } from './helpers';
import {
  account,
  contentSections,
  faqItems,
  rateLimit,
  session,
  user,
  verification,
} from '@/lib/db/schema';

const pg = await getDisposablePostgres();
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

/**
 * W3.3 -> W4 migration safety on a disposable PostgreSQL instance:
 * - fresh migration creates exactly the additive W4 tables/indexes;
 * - upgrading an existing W3.3 schema preserves auth, CMS, SEO and FAQ rows.
 * Never executed against a hosted database.
 */

beforeAll(async () => {
  await pg.pool.query('drop schema if exists public cascade');
  await pg.pool.query('drop schema if exists drizzle cascade');
  await pg.pool.query('create schema public');
});

afterAll(async () => {
  await pg.stop();
});

async function migrationsThroughW33(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nokmel-w33-migrations-'));
  const journal = JSON.parse(
    await fs.readFile(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
  ) as { entries: { idx: number }[] };
  await fs.mkdir(path.join(dir, 'meta'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'meta/_journal.json'),
    JSON.stringify(
      { ...journal, entries: journal.entries.filter((entry) => entry.idx <= 2) },
      null,
      2,
    ),
  );
  for (const file of [
    '0000_w31-auth-foundation.sql',
    '0001_parallel_skin.sql',
    '0002_w32-content-cms.sql',
    'meta/0000_snapshot.json',
    'meta/0001_snapshot.json',
    'meta/0002_snapshot.json',
  ]) {
    await fs.copyFile(path.join(migrationsFolder, file), path.join(dir, file));
  }
  return dir;
}

async function resetSchemas(): Promise<void> {
  await pg.pool.query('drop schema if exists public cascade');
  await pg.pool.query('drop schema if exists drizzle cascade');
  await pg.pool.query('create schema public');
}

describe('W4 additive migrations', () => {
  test('fresh migration creates the W4 tables and indexes', async () => {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(pg.db, { migrationsFolder });
    const tables = await pg.pool.query(
      "select tablename from pg_tables where schemaname = 'public' order by tablename",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual(
      expect.arrayContaining([
        'plans',
        'join_requests',
        'join_intake_rate_limits',
        'content_sections',
        'faq_items',
        'user',
        'account',
        'session',
      ]),
    );
    const indexes = await pg.pool.query(
      "select indexname from pg_indexes where schemaname = 'public' and tablename in ('plans', 'join_requests', 'join_intake_rate_limits')",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'plans_slug_unique',
        'plans_public_order_idx',
        'join_requests_submission_token_unique',
        'join_requests_created_at_idx',
        'join_requests_status_created_at_idx',
        'join_intake_rate_limits_window_idx',
      ]),
    );
  });

  test('upgrades a W3.3 schema without changing auth/CMS/SEO/FAQ data', async () => {
    await resetSchemas();
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const subset = await migrationsThroughW33();
    try {
      await migrate(pg.db, { migrationsFolder: subset });
    } finally {
      await fs.rm(subset, { recursive: true, force: true });
    }

    const passwordHash = await hashPassword('synthetic-w33-owner-password-123');
    await pg.db.insert(user).values({
      id: 'w33-owner',
      name: 'W3.3 Owner',
      email: 'owner@w33-upgrade.test',
      emailVerified: true,
    });
    await pg.db.insert(account).values({
      id: 'w33-account',
      accountId: 'w33-owner',
      providerId: 'credential',
      userId: 'w33-owner',
      password: passwordHash,
    });
    await pg.db.insert(session).values({
      id: 'w33-session',
      token: 'w33-synthetic-session-token',
      userId: 'w33-owner',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await pg.db.insert(verification).values({
      id: 'w33-verification',
      identifier: 'owner@w33-upgrade.test',
      value: 'synthetic-value',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await pg.db.insert(rateLimit).values({
      id: 'w33-rate-limit',
      key: 'synthetic|w33',
      count: 2,
      lastRequest: Date.now(),
    });
    await pg.db.insert(contentSections).values([
      {
        id: 'home:hero:ar',
        pageKey: 'home',
        sectionKey: 'hero',
        locale: 'ar',
        draftPayload: { title: 'مسودة محفوظة' },
        publishedPayload: { title: 'محتوى منشور' },
        draftRevision: 4,
        publishedRevision: 3,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'home:seo:ar',
        pageKey: 'home',
        sectionKey: 'seo',
        locale: 'ar',
        draftPayload: { title: 'SEO مسودة', description: 'وصف SEO' },
        publishedPayload: { title: 'SEO منشور', description: 'وصف SEO منشور' },
        draftRevision: 4,
        publishedRevision: 3,
        publishedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    await pg.db.insert(faqItems).values({
      id: 'faq-w33',
      locale: 'ar',
      draftQuestion: 'سؤال مسودة',
      draftAnswer: 'إجابة مسودة',
      draftSortOrder: 0,
      draftVisible: true,
      publishedQuestion: 'سؤال منشور',
      publishedAnswer: 'إجابة منشورة',
      publishedSortOrder: 0,
      publishedVisible: true,
      publishedAt: new Date('2026-01-01T00:00:00Z'),
    });

    const before = {
      auth: await pg.pool.query(
        'select u.id, u.email, a.password, s.token, v.value, r.count from "user" u join account a on a.user_id = u.id join session s on s.user_id = u.id join verification v on v.identifier = u.email join rate_limit r on r.id = $1',
        ['w33-rate-limit'],
      ),
      sections: await pg.pool.query(
        'select id, draft_payload, published_payload, draft_revision, published_revision, published_at from content_sections order by id',
      ),
      faq: await pg.pool.query(
        'select id, draft_question, draft_answer, published_question, published_answer, published_visible from faq_items order by id',
      ),
    };

    await migrate(pg.db, { migrationsFolder });

    const after = {
      auth: await pg.pool.query(
        'select u.id, u.email, a.password, s.token, v.value, r.count from "user" u join account a on a.user_id = u.id join session s on s.user_id = u.id join verification v on v.identifier = u.email join rate_limit r on r.id = $1',
        ['w33-rate-limit'],
      ),
      sections: await pg.pool.query(
        'select id, draft_payload, published_payload, draft_revision, published_revision, published_at from content_sections order by id',
      ),
      faq: await pg.pool.query(
        'select id, draft_question, draft_answer, published_question, published_answer, published_visible from faq_items order by id',
      ),
    };

    expect(after).toEqual(before);
    const newTables = await pg.pool.query(
      "select count(*)::int as count from pg_tables where schemaname = 'public' and tablename in ('plans', 'join_requests', 'join_intake_rate_limits')",
    );
    expect(newTables.rows[0].count).toBe(3);
    const counts = await pg.pool.query(
      'select (select count(*)::int from plans) as plans, (select count(*)::int from join_requests) as requests',
    );
    expect(counts.rows[0]).toEqual({ plans: 0, requests: 0 });
  });
});
