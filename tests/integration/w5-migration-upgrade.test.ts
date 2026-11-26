import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDisposablePostgres } from './helpers';

/**
 * W4.1 -> W5 additive migration safety on disposable PostgreSQL:
 * - fresh migration creates site_settings and nullable notification columns;
 * - upgrading a populated W4.1 database preserves auth/CMS/SEO/FAQ/plans,
 *   requests, historical offer snapshots, notes/status and rate-limit rows;
 * - existing rows get null notification state and settings start empty/disabled.
 * Never executed against hosted Neon.
 */

const pg = await getDisposablePostgres();
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

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

async function migrationsThroughW41(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nokmel-w41-migrations-'));
  const journal = JSON.parse(
    await fs.readFile(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
  ) as { entries: { idx: number }[] };
  await fs.mkdir(path.join(dir, 'meta'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'meta/_journal.json'),
    JSON.stringify(
      { ...journal, entries: journal.entries.filter((entry) => entry.idx <= 4) },
      null,
      2,
    ),
  );
  for (const file of [
    '0000_w31-auth-foundation.sql',
    '0001_parallel_skin.sql',
    '0002_w32-content-cms.sql',
    '0003_w4-plans-join-requests.sql',
    '0004_w41-scheduled-promotional-pricing.sql',
    'meta/0000_snapshot.json',
    'meta/0001_snapshot.json',
    'meta/0002_snapshot.json',
    'meta/0003_snapshot.json',
    'meta/0004_snapshot.json',
  ]) {
    await fs.copyFile(path.join(migrationsFolder, file), path.join(dir, file));
  }
  return dir;
}

describe('W5 additive migration', () => {
  test('fresh migration creates typed settings and nullable notification state', async () => {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    await migrate(pg.db, { migrationsFolder });
    const columns = await pg.pool.query(
      `select table_name, column_name, is_nullable
         from information_schema.columns
        where table_schema = 'public'
          and (
            table_name = 'site_settings' or
            (table_name = 'join_requests' and column_name like 'notification_%')
          )
        order by table_name, column_name`,
    );
    expect(columns.rows).toEqual(
      expect.arrayContaining([
        { table_name: 'site_settings', column_name: 'analytics_enabled', is_nullable: 'NO' },
        { table_name: 'site_settings', column_name: 'notifications_enabled', is_nullable: 'NO' },
        { table_name: 'site_settings', column_name: 'telegram_chat_id', is_nullable: 'YES' },
        {
          table_name: 'join_requests',
          column_name: 'notification_state',
          is_nullable: 'YES',
        },
        {
          table_name: 'join_requests',
          column_name: 'notification_attempted_at',
          is_nullable: 'YES',
        },
        {
          table_name: 'join_requests',
          column_name: 'notification_delivered_at',
          is_nullable: 'YES',
        },
        {
          table_name: 'join_requests',
          column_name: 'notification_error_code',
          is_nullable: 'YES',
        },
      ]),
    );
    const checks = await pg.pool.query(
      `select conname from pg_constraint
        where conname in (
          'site_settings_single_row',
          'join_requests_notification_state_valid'
        )
        order by conname`,
    );
    expect(checks.rows.map((row) => row.conname)).toEqual([
      'join_requests_notification_state_valid',
      'site_settings_single_row',
    ]);
  });

  test('upgrades a populated W4.1 database without changing existing data', async () => {
    await resetSchemas();
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const subset = await migrationsThroughW41();
    try {
      await migrate(pg.db, { migrationsFolder: subset });
    } finally {
      await fs.rm(subset, { recursive: true, force: true });
    }

    await pg.pool.query(
      `insert into "user" (id, name, email, email_verified) values
         ('w41-owner', 'W4.1 Owner', 'owner@w41-upgrade.test', true)`,
    );
    await pg.pool.query(
      `insert into account (id, account_id, provider_id, user_id, password)
       values ('w41-account', 'w41-owner', 'credential', 'w41-owner', 'synthetic-hash')`,
    );
    await pg.pool.query(
      `insert into session (id, token, user_id, expires_at)
       values ('w41-session', 'w41-synthetic-session-token', 'w41-owner', now() + interval '7 days')`,
    );
    await pg.pool.query(
      `insert into content_sections (id, page_key, section_key, locale, draft_payload, published_payload, draft_revision, published_revision, published_at)
       values ('home:hero:ar', 'home', 'hero', 'ar', '{"title":"مسودة"}'::jsonb, '{"title":"منشور"}'::jsonb, 4, 3, now())`,
    );
    await pg.pool.query(
      `insert into faq_items (id, locale, draft_question, draft_answer, draft_sort_order, draft_visible, published_question, published_answer, published_sort_order, published_visible, published_at)
       values ('faq-w41', 'ar', 'سؤال', 'إجابة', 0, true, 'سؤال منشور', 'إجابة منشورة', 0, true, now())`,
    );
    await pg.pool.query(
      `insert into plans (
         id, slug, draft_name, draft_description, draft_features,
         draft_monthly_price_minor, draft_yearly_price_minor, draft_currency,
         draft_cta_label, draft_featured, draft_display_order, draft_promotion,
         published_name, published_description, published_features,
         published_monthly_price_minor, published_yearly_price_minor, published_currency,
         published_cta_label, published_featured, published_display_order, published_promotion,
         status, draft_revision, published_revision, published_at
       ) values (
         'w41-plan', 'w41-plan', 'باقة W4.1', 'وصف', '["ميزة"]'::jsonb,
         19900, 199000, 'EGP', 'اطلب الانضمام', false, 1,
         '{"enabled":true,"label":"عرض","discountType":"percentage","target":"monthly","percentageBps":2000,"fixedMonthlyMinor":null,"fixedYearlyMinor":null,"startsAt":"2026-11-20T00:00:00.000Z","endsAt":"2026-12-01T00:00:00.000Z"}'::jsonb,
         'باقة W4.1', 'وصف', '["ميزة"]'::jsonb,
         19900, 199000, 'EGP', 'اطلب الانضمام', false, 1,
         '{"enabled":true,"label":"عرض","discountType":"percentage","target":"monthly","percentageBps":2000,"fixedMonthlyMinor":null,"fixedYearlyMinor":null,"startsAt":"2026-11-20T00:00:00.000Z","endsAt":"2026-12-01T00:00:00.000Z"}'::jsonb,
         'published', 2, 2, now()
       )`,
    );
    await pg.pool.query(
      `insert into join_requests (
         id, name, phone, email, business_activity, plan_id, plan_name_snapshot,
         plan_price_minor_snapshot, plan_price_period_snapshot, plan_currency_snapshot,
         offer_snapshot, source, utm_source, status, notes, submission_token, revision,
         created_at, updated_at
       ) values (
         'w41-request', 'تاجر W4.1', '+201000000003', 'w41@example.com', 'نشاط',
         'w41-plan', 'باقة W4.1', 15920, 'monthly', 'EGP',
         '{"version":1,"capturedAt":"2026-11-26T10:00:00.000Z","planId":"w41-plan","planSlug":"w41-plan","planName":"باقة W4.1","currency":"EGP","publishedRevision":2,"promotionState":"active","effectiveOfferVersion":"w41-0123456789abcdef","baseMonthlyPriceMinor":19900,"baseYearlyPriceMinor":199000,"effectiveMonthlyPriceMinor":15920,"effectiveYearlyPriceMinor":159200,"promotion":{"label":"عرض","discountType":"percentage","target":"monthly","percentageBps":2000,"fixedMonthlyMinor":null,"fixedYearlyMinor":null,"startsAt":"2026-11-20T00:00:00.000Z","endsAt":"2026-12-01T00:00:00.000Z","monthlySavedMinor":3980,"yearlySavedMinor":null,"monthlySavedPercentBps":2000,"yearlySavedPercentBps":null}}'::jsonb,
         'pricing', 'google', 'contacted', 'ملاحظة محفوظة', 'w41-synthetic-token', 3,
         now(), now()
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

    const request = await pg.pool.query(
      `select notification_state, notification_attempted_at, notification_delivered_at,
              notification_error_code, offer_snapshot, status, notes, revision
         from join_requests where id = 'w41-request'`,
    );
    expect(request.rows[0]).toMatchObject({
      notification_state: null,
      notification_attempted_at: null,
      notification_delivered_at: null,
      notification_error_code: null,
      status: 'contacted',
      notes: 'ملاحظة محفوظة',
      revision: 3,
    });
    expect(request.rows[0].offer_snapshot.promotion.label).toBe('عرض');

    const settings = await pg.pool.query('select * from site_settings');
    expect(settings.rows).toHaveLength(0);
    const plan = await pg.pool.query(
      `select draft_promotion, published_promotion, published_monthly_price_minor, status, published_revision
         from plans where id = 'w41-plan'`,
    );
    expect(plan.rows[0]).toMatchObject({
      published_monthly_price_minor: 19900,
      status: 'published',
      published_revision: 2,
    });
    expect(plan.rows[0].published_promotion.label).toBe('عرض');
    expect(plan.rows[0].draft_promotion.label).toBe('عرض');
  });
});

async function snapshotData() {
  const auth = await pg.pool.query(
    `select u.id, u.email, a.password, s.token
       from "user" u join account a on a.user_id = u.id join session s on s.user_id = u.id
      order by u.id`,
  );
  const sections = await pg.pool.query(
    'select id, draft_revision, published_revision, draft_payload, published_payload from content_sections order by id',
  );
  const faqs = await pg.pool.query(
    'select id, published_question, published_answer, published_visible from faq_items order by id',
  );
  const plans = await pg.pool.query(
    `select id, status, draft_revision, published_revision, published_monthly_price_minor,
            published_yearly_price_minor, published_currency, draft_promotion, published_promotion
       from plans order by id`,
  );
  const requests = await pg.pool.query(
    `select id, status, notes, revision, plan_name_snapshot, plan_price_minor_snapshot,
            plan_price_period_snapshot, plan_currency_snapshot, offer_snapshot, source,
            utm_source, created_at
       from join_requests order by id`,
  );
  const limits = await pg.pool.query(
    'select key, count from join_intake_rate_limits order by key',
  );
  return {
    auth: auth.rows,
    sections: sections.rows,
    faqs: faqs.rows,
    plans: plans.rows,
    requests: requests.rows,
    limits: limits.rows,
  };
}
