import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDisposablePostgres } from './helpers';

const pg = await getDisposablePostgres();
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

/**
 * W4 -> W4.1 additive migration safety on a disposable PostgreSQL instance:
 * - fresh migration creates the promotion/offer-snapshot columns and checks;
 * - upgrading a populated W4 database preserves auth, CMS, SEO, FAQ, plans,
 *   legacy join requests and rate-limit records;
 * - existing rows migrate to "no promotion" without changing prices/revisions.
 * Never executed against a hosted database.
 */

beforeAll(async () => {
  await resetSchemas();
});

afterAll(async () => {
  await pg.stop();
});

async function resetSchemas(): Promise<void> {
  await pg.pool.query('drop schema if exists public cascade');
  await pg.pool.query('drop schema if exists drizzle cascade');
  await pg.pool.query('create schema public');
}

async function migrationsThroughW4(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nokmel-w4-migrations-'));
  const journal = JSON.parse(
    await fs.readFile(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
  ) as { entries: { idx: number }[] };
  await fs.mkdir(path.join(dir, 'meta'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'meta/_journal.json'),
    JSON.stringify(
      { ...journal, entries: journal.entries.filter((entry) => entry.idx <= 3) },
      null,
      2,
    ),
  );
  for (const file of [
    '0000_w31-auth-foundation.sql',
    '0001_parallel_skin.sql',
    '0002_w32-content-cms.sql',
    '0003_w4-plans-join-requests.sql',
    'meta/0000_snapshot.json',
    'meta/0001_snapshot.json',
    'meta/0002_snapshot.json',
    'meta/0003_snapshot.json',
  ]) {
    await fs.copyFile(path.join(migrationsFolder, file), path.join(dir, file));
  }
  return dir;
}

describe('W4.1 additive migration', () => {
  test('fresh migration creates promotion and offer-snapshot columns', async () => {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(pg.db, { migrationsFolder });
    const columns = await pg.pool.query(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public'
          and (
            (table_name = 'plans' and column_name in ('draft_promotion', 'published_promotion')) or
            (table_name = 'join_requests' and column_name = 'offer_snapshot')
          )
        order by table_name, column_name`,
    );
    expect(columns.rows).toEqual([
      { table_name: 'join_requests', column_name: 'offer_snapshot' },
      { table_name: 'plans', column_name: 'draft_promotion' },
      { table_name: 'plans', column_name: 'published_promotion' },
    ]);
    const checks = await pg.pool.query(
      `select conname from pg_constraint
        where conname in (
          'plans_draft_promotion_object',
          'plans_published_promotion_object',
          'join_requests_offer_snapshot_object'
        )
        order by conname`,
    );
    expect(checks.rows.map((row) => row.conname)).toEqual([
      'join_requests_offer_snapshot_object',
      'plans_draft_promotion_object',
      'plans_published_promotion_object',
    ]);
  });

  test('upgrades a populated W4 database without changing existing data', async () => {
    await resetSchemas();
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const subset = await migrationsThroughW4();
    try {
      await migrate(pg.db, { migrationsFolder: subset });
    } finally {
      await fs.rm(subset, { recursive: true, force: true });
    }

    await pg.pool.query(
      `insert into "user" (id, name, email, email_verified) values
         ('w4-owner', 'W4 Owner', 'owner@w4-upgrade.test', true)`,
    );
    await pg.pool.query(
      `insert into account (id, account_id, provider_id, user_id, password)
       values ('w4-account', 'w4-owner', 'credential', 'w4-owner', 'synthetic-hash')`,
    );
    await pg.pool.query(
      `insert into session (id, token, user_id, expires_at)
       values ('w4-session', 'w4-synthetic-session-token', 'w4-owner', now() + interval '7 days')`,
    );
    await pg.pool.query(
      `insert into verification (id, identifier, value, expires_at)
       values ('w4-verification', 'owner@w4-upgrade.test', 'synthetic-value', now() + interval '1 day')`,
    );
    await pg.pool.query(
      `insert into rate_limit (id, key, count, last_request)
       values ('w4-rate-limit', 'synthetic|w4', 2, 1)`,
    );
    await pg.pool.query(
      `insert into content_sections (
         id, page_key, section_key, locale, draft_payload, published_payload,
         draft_revision, published_revision, published_at
       ) values (
         'home:hero:ar', 'home', 'hero', 'ar', '{"title":"مسودة"}'::jsonb,
         '{"title":"منشور"}'::jsonb, 4, 3, now()
       ), (
         'home:seo:ar', 'home', 'seo', 'ar',
         '{"title":"SEO مسودة","description":"وصف"}'::jsonb,
         '{"title":"SEO منشور","description":"وصف منشور"}'::jsonb,
         4, 3, now()
       )`,
    );
    await pg.pool.query(
      `insert into faq_items (
         id, locale, draft_question, draft_answer, draft_sort_order, draft_visible,
         published_question, published_answer, published_sort_order, published_visible, published_at
       ) values (
         'faq-w4', 'ar', 'سؤال', 'إجابة', 0, true, 'سؤال منشور', 'إجابة منشورة', 0, true, now()
       )`,
    );
    await pg.pool.query(
      `insert into plans (
         id, slug, draft_name, draft_description, draft_features,
         draft_monthly_price_minor, draft_yearly_price_minor, draft_currency,
         draft_cta_label, draft_featured, draft_display_order,
         published_name, published_description, published_features,
         published_monthly_price_minor, published_yearly_price_minor, published_currency,
         published_cta_label, published_featured, published_display_order,
         status, draft_revision, published_revision, published_at
       ) values (
         'w4-plan', 'w4-plan', 'باقة W4', 'وصف W4', '["ميزة"]'::jsonb,
         14900, 149000, 'EGP', 'اطلب الانضمام', false, 1,
         'باقة W4', 'وصف W4', '["ميزة"]'::jsonb,
         14900, 149000, 'EGP', 'اطلب الانضمام', false, 1,
         'published', 2, 2, now()
       )`,
    );
    await pg.pool.query(
      `insert into join_requests (
         id, name, phone, plan_id, plan_name_snapshot, plan_price_minor_snapshot,
         plan_price_period_snapshot, plan_currency_snapshot, source, status,
         submission_token, revision
       ) values (
         'w4-request', 'تاجر W4', '+201000000002', 'w4-plan', 'باقة W4', 14900,
         'monthly', 'EGP', 'pricing', 'new', 'w4-synthetic-token', 0
       )`,
    );
    await pg.pool.query(
      `insert into join_intake_rate_limits (key, window_start, count)
       values ('join-intake:v1:synthetic', now(), 3)`,
    );

    const before = await snapshotData();
    await migrate(pg.db, { migrationsFolder });
    const after = await snapshotData();
    expect(after).toEqual(before);

    const newColumns = await pg.pool.query(
      `select draft_promotion, published_promotion from plans where id = 'w4-plan'`,
    );
    expect(newColumns.rows[0]).toEqual({
      draft_promotion: null,
      published_promotion: null,
    });
    const request = await pg.pool.query(
      `select offer_snapshot, plan_price_minor_snapshot from join_requests where id = 'w4-request'`,
    );
    expect(request.rows[0]).toEqual({
      offer_snapshot: null,
      plan_price_minor_snapshot: 14_900,
    });
    const counts = await pg.pool.query(
      `select
         (select count(*)::int from plans) as plans,
         (select count(*)::int from join_requests) as requests,
         (select count(*)::int from content_sections) as sections,
         (select count(*)::int from faq_items) as faqs`,
    );
    expect(counts.rows[0]).toEqual({
      plans: 1,
      requests: 1,
      sections: 2,
      faqs: 1,
    });
  });
});

async function snapshotData() {
  return {
    auth: await pg.pool.query(
      `select u.id, u.email, a.password, s.token, v.value, r.count
         from "user" u
         join account a on a.user_id = u.id
         join session s on s.user_id = u.id
         join verification v on v.identifier = u.email
         join rate_limit r on r.id = 'w4-rate-limit'`,
    ),
    sections: await pg.pool.query(
      `select id, draft_payload, published_payload, draft_revision, published_revision
         from content_sections order by id`,
    ),
    faq: await pg.pool.query(
      `select id, draft_question, draft_answer, published_question, published_answer
         from faq_items order by id`,
    ),
    plans: await pg.pool.query(
      `select id, slug, draft_name, draft_monthly_price_minor, draft_yearly_price_minor,
              published_name, published_monthly_price_minor, published_yearly_price_minor,
              status, draft_revision, published_revision
         from plans order by id`,
    ),
    requests: await pg.pool.query(
      `select id, name, phone, plan_id, plan_name_snapshot, plan_price_minor_snapshot,
              plan_price_period_snapshot, plan_currency_snapshot, source, status,
              submission_token, revision
         from join_requests order by id`,
    ),
    rateLimits: await pg.pool.query(
      `select key, count from join_intake_rate_limits order by key`,
    ),
  };
}
