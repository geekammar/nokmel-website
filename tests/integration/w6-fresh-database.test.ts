import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { provisionOwner } from '@/lib/admin-provisioning';
import {
  applyMigrations,
  getDisposablePostgres,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
} from './helpers';
import { loadPublicSettings } from '@/lib/settings/service';

/**
 * W6-B05: prove a completely empty disposable PostgreSQL 18 database reaches
 * the complete expected schema from migration zero, accepts owner
 * provisioning, and starts with unseeded CMS/settings state. This test never
 * connects to hosted Neon.
 */

const pg = await getDisposablePostgres();

const EXPECTED_PUBLIC_TABLES = [
  'account',
  'content_sections',
  'faq_items',
  'join_intake_rate_limits',
  'join_requests',
  'plans',
  'rate_limit',
  'session',
  'site_settings',
  'user',
  'verification',
];

beforeAll(async () => {
  // True migration-zero start.
  await pg.pool.query('drop schema if exists public cascade');
  await pg.pool.query('drop schema if exists drizzle cascade');
  await pg.pool.query('create schema public');
  await applyMigrations(pg);
});

afterAll(async () => {
  await pg.stop();
});

describe('fresh database from migration zero', () => {
  test('creates the complete approved schema and migration history', async () => {
    const tables = await pg.pool.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        order by table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(EXPECTED_PUBLIC_TABLES);

    const migrations = await pg.pool.query(
      'select count(*)::int as count from drizzle.__drizzle_migrations',
    );
    expect(migrations.rows[0].count).toBe(6);

    const sequences = await pg.pool.query(
      "select count(*)::int as count from information_schema.sequences where sequence_schema = 'public'",
    );
    expect(sequences.rows[0].count).toBe(0);
  });

  test('starts without seeded CMS, plans, requests or settings rows', async () => {
    for (const table of [
      'content_sections',
      'faq_items',
      'plans',
      'join_requests',
      'join_intake_rate_limits',
      'site_settings',
    ]) {
      const result = await pg.pool.query(`select count(*)::int as count from ${table}`);
      expect(result.rows[0].count, `${table} must start empty`).toBe(0);
    }

    const publicSettings = await loadPublicSettings({ db: pg.db });
    expect(publicSettings.status).toBe('ok');
    expect(publicSettings.settings).toEqual({
      contactEmail: null,
      contactPhone: null,
      contactTelegramUrl: null,
      contactWhatsappUrl: null,
      socialInstagramUrl: null,
      socialFacebookUrl: null,
      socialXUrl: null,
    });
  });

  test('supports owner provisioning and refuses a second owner', async () => {
    const first = await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Nokmel Owner',
      password: TEST_OWNER_PASSWORD,
    });
    expect(first.outcome).toBe('created');

    const second = await provisionOwner({
      db: pg.db,
      email: ` ${TEST_OWNER_EMAIL.toUpperCase()} `,
      name: 'Nokmel Owner',
      password: TEST_OWNER_PASSWORD,
    });
    expect(second.outcome).toBe('already-provisioned');
    expect(second.userId).toBe(first.userId);

    const owners = await pg.pool.query('select count(*)::int as count from "user"');
    expect(owners.rows[0].count).toBe(1);
    const credentials = await pg.pool.query(
      "select count(*)::int as count from account where provider_id = 'credential'",
    );
    expect(credentials.rows[0].count).toBe(1);
  });

  test('enforces the credential uniqueness defense-in-depth index', async () => {
    const index = await pg.pool.query(
      `select indexname from pg_indexes
        where schemaname = 'public' and tablename = 'account'
          and indexname = 'account_user_credential_unique'`,
    );
    expect(index.rows).toHaveLength(1);
  });
});
