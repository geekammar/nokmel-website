import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  applyMigrations,
  authRequest,
  createTestAuth,
  emptyDatabase,
  getDisposablePostgres,
  sessionCookieFrom,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
} from './helpers';
import { provisionOwner } from '@/lib/admin-provisioning';
import * as schema from '@/lib/db/schema';

/**
 * Verifies the reviewed least-privilege plan against a restricted synthetic
 * runtime role on the disposable PostgreSQL instance:
 * - can log in and resolve its identity
 * - can run sign-in, session access, logout, and database-backed rate limiting
 * - cannot create/alter/drop tables (no DDL), cannot own the database/schema
 *
 * Never executed against a hosted database.
 */

const pg = await getDisposablePostgres();
const roleName = `nokmel_runtime_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const rolePassword = randomUUID();
const databaseName = new URL(pg.url).pathname.replace(/^\//, '');

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
  await provisionOwner({
    db: pg.db,
    email: TEST_OWNER_EMAIL,
    name: 'Nokmel Owner',
    password: TEST_OWNER_PASSWORD,
  });

  await pg.pool.query(`create role ${quoteIdentifier(roleName)} login password '${rolePassword}'`);
  await pg.pool.query(
    `revoke all on database ${quoteIdentifier(databaseName)} from public`,
  );
  await pg.pool.query(
    `grant connect on database ${quoteIdentifier(databaseName)} to ${quoteIdentifier(roleName)}`,
  );
  await pg.pool.query('revoke all on schema public from public');
  await pg.pool.query(
    `grant usage on schema public to ${quoteIdentifier(roleName)}`,
  );
  await pg.pool.query('revoke all on all tables in schema public from public');
  await pg.pool.query(
    `grant select, insert, update, delete on table "user", "session", "account", "verification", "rate_limit", "content_sections", "faq_items", "plans", "join_requests", "join_intake_rate_limits" to ${quoteIdentifier(roleName)}`,
  );
});

afterAll(async () => {
  await pg.pool.query(`drop owned by ${quoteIdentifier(roleName)}`).catch(() => undefined);
  await pg.pool.query(`drop role if exists ${quoteIdentifier(roleName)}`).catch(() => undefined);
  await pg.stop();
});

describe('restricted runtime database role', () => {
  test('can log in as the restricted role and is not the database/schema owner', async () => {
    const runtimeUrl = new URL(pg.url);
    runtimeUrl.username = roleName;
    runtimeUrl.password = rolePassword;
    const pool = new Pool({ connectionString: runtimeUrl.toString(), ssl: false, max: 1 });
    try {
      const { rows } = await pool.query(
        'select current_user as current_user, session_user as session_user',
      );
      expect(rows[0].current_user).toBe(roleName);
      expect(rows[0].session_user).toBe(roleName);

      const { rows: ownership } = await pg.pool.query(
        `select
           (select datdba = (select oid from pg_roles where rolname = $1) from pg_database where datname = $2) as owns_database,
           (select nspowner = (select oid from pg_roles where rolname = $1) from pg_namespace where nspname = 'public') as owns_schema,
           has_schema_privilege($1, 'public', 'USAGE') as schema_usage,
           has_schema_privilege($1, 'public', 'CREATE') as schema_create,
           has_database_privilege($1, $2, 'CREATE') as database_create`,
        [roleName, databaseName],
      );
      expect(ownership[0].owns_database).toBe(false);
      expect(ownership[0].owns_schema).toBe(false);
      expect(ownership[0].schema_usage).toBe(true);
      expect(ownership[0].schema_create).toBe(false);
      expect(ownership[0].database_create).toBe(false);
    } finally {
      await pool.end();
    }
  });

  test('supports sign-in, session access, logout, and rate limiting without DDL rights', async () => {
    const runtimeUrl = new URL(pg.url);
    runtimeUrl.username = roleName;
    runtimeUrl.password = rolePassword;
    const runtimePool = new Pool({ connectionString: runtimeUrl.toString(), ssl: false, max: 2 });
    try {
      const runtimeDb = drizzle(runtimePool, { schema });
      const runtimeAuth = createTestAuth(runtimeDb, {
        rateLimit: { enabled: true, signInMax: 50 },
      });

      const signIn = await authRequest(runtimeAuth, '/sign-in/email', {
        method: 'POST',
        body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
        ip: '198.51.100.50',
      });
      expect(signIn.status).toBe(200);
      const cookie = sessionCookieFrom(signIn);

      const sessionResponse = await authRequest(runtimeAuth, '/get-session', {
        method: 'GET',
        cookie,
      });
      expect(sessionResponse.status).toBe(200);
      const sessionBody = (await sessionResponse.json()) as { user?: { email?: string } };
      expect(sessionBody.user?.email).toBe(TEST_OWNER_EMAIL);

      const { rows: rateRows } = await runtimePool.query(
        "select count(*)::int as count from rate_limit where key like '198.51.100.50|%'",
      );
      expect(rateRows[0].count).toBeGreaterThan(0);

      const logout = await authRequest(runtimeAuth, '/sign-out', {
        method: 'POST',
        cookie,
        origin: 'http://127.0.0.1:3100',
      });
      expect(logout.status).toBe(200);
      await logout.text();

      const afterLogout = await authRequest(runtimeAuth, '/get-session', {
        method: 'GET',
        cookie,
      });
      expect(await afterLogout.json()).toBeNull();

      // Intended CMS data operations are allowed with the explicit grants.
      await runtimePool.query(
        `insert into content_sections (id, page_key, section_key, locale, draft_payload, draft_revision)
         values ('home:hero:ar', 'home', 'hero', 'ar', '{"title":"x"}'::jsonb, 1)`,
      );
      const cmsRead = await runtimePool.query(
        "select draft_revision from content_sections where id = 'home:hero:ar'",
      );
      expect(cmsRead.rows[0].draft_revision).toBe(1);
      await runtimePool.query(
        "update content_sections set draft_revision = 2 where id = 'home:hero:ar'",
      );
      await runtimePool.query("delete from content_sections where id = 'home:hero:ar'");
      await runtimePool.query(
        `insert into faq_items (id, locale, draft_question, draft_answer, draft_sort_order, draft_visible)
         values ('faq-runtime-probe', 'ar', 'q', 'a', 0, true)`,
      );
      await runtimePool.query("delete from faq_items where id = 'faq-runtime-probe'");

      // Intended W4 plan/join/rate-limit DML is allowed with explicit grants.
      await runtimePool.query(
        `insert into plans (id, slug, draft_name, draft_description, draft_currency, draft_cta_label, draft_revision)
         values ('plan-runtime-probe', 'runtime-probe', 'باقة', 'وصف', 'EGP', 'اطلب الانضمام', 1)`,
      );
      await runtimePool.query(
        "update plans set draft_revision = 2, draft_promotion = '{\"enabled\":false}'::jsonb where id = 'plan-runtime-probe'",
      );
      const planRead = await runtimePool.query(
        "select draft_revision from plans where id = 'plan-runtime-probe'",
      );
      expect(planRead.rows[0].draft_revision).toBe(2);
      await runtimePool.query(
        `insert into join_requests (id, name, phone, plan_id, plan_name_snapshot, plan_currency_snapshot, offer_snapshot, submission_token)
         values ('request-runtime-probe', 'Synthetic Trader', '+201000000000', 'plan-runtime-probe', 'باقة', 'EGP', '{"version":1}'::jsonb, 'runtime-probe-token')`,
      );
      const requestRead = await runtimePool.query(
        "select status, notes, revision, offer_snapshot from join_requests where id = 'request-runtime-probe'",
      );
      expect(requestRead.rows[0]).toEqual({
        status: 'new',
        notes: null,
        revision: 0,
        offer_snapshot: { version: 1 },
      });
      await runtimePool.query(
        "update join_requests set notes = 'probe', revision = 1 where id = 'request-runtime-probe'",
      );
      await runtimePool.query(
        `insert into join_intake_rate_limits (key, window_start, count)
         values ('join-intake:v1:runtime-probe', now(), 1)
         on conflict (key) do update set count = join_intake_rate_limits.count + 1`,
      );
      await runtimePool.query(
        "delete from join_intake_rate_limits where key = 'join-intake:v1:runtime-probe'",
      );
      await runtimePool.query("delete from join_requests where id = 'request-runtime-probe'");
      await runtimePool.query("delete from plans where id = 'plan-runtime-probe'");

      await expect(
        runtimePool.query('create table "runtime_ddl_probe" (id integer)'),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        runtimePool.query('truncate table content_sections'),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        runtimePool.query('truncate table plans'),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        runtimePool.query('truncate table join_requests'),
      ).rejects.toThrow(/permission denied/i);
      await expect(
        runtimePool.query('alter table "user" add column "runtime_probe" integer'),
      ).rejects.toThrow(/must be owner|permission denied/i);
      await expect(runtimePool.query('drop table "user"')).rejects.toThrow(
        /must be owner|permission denied/i,
      );
    } finally {
      await runtimePool.end();
    }
  });
});
