import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { hashPassword } from 'better-auth/crypto';
import { getDisposablePostgres } from './helpers';
import { account, rateLimit, session, user, verification } from '@/lib/db/schema';

const pg = await getDisposablePostgres();
const migrationsFolder = path.resolve(__dirname, '../../drizzle');

/**
 * Simulates an existing W3.1 database (only migrations 0000/0001 applied,
 * with synthetic auth rows), then applies the W3.2 additive migration and
 * verifies that every existing authentication record is preserved unchanged.
 * Uses the disposable PostgreSQL target only.
 */
beforeAll(async () => {
  await pg.pool.query('drop schema if exists public cascade');
  await pg.pool.query('drop schema if exists drizzle cascade');
  await pg.pool.query('create schema public');
});

afterAll(async () => {
  await pg.stop();
});

async function w31MigrationsFolder(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nokmel-w31-migrations-'));
  const journal = JSON.parse(
    await fs.readFile(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
  ) as { entries: { idx: number }[] };
  const filtered = {
    ...journal,
    entries: journal.entries.filter((entry) => entry.idx <= 1),
  };
  await fs.mkdir(path.join(dir, 'meta'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'meta/_journal.json'),
    JSON.stringify(filtered, null, 2),
  );
  for (const file of [
    '0000_w31-auth-foundation.sql',
    '0001_parallel_skin.sql',
    'meta/0000_snapshot.json',
    'meta/0001_snapshot.json',
  ]) {
    await fs.copyFile(path.join(migrationsFolder, file), path.join(dir, file));
  }
  return dir;
}

describe('W3.1 to W3.2 migration upgrade', () => {
  test('adds CMS tables without touching existing authentication data', async () => {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const subset = await w31MigrationsFolder();
    try {
      await migrate(pg.db, { migrationsFolder: subset });
    } finally {
      await fs.rm(subset, { recursive: true, force: true });
    }

    const passwordHash = await hashPassword('synthetic-w31-owner-password-123');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pg.db.insert(user).values({
      id: 'w31-owner-user',
      name: 'W3.1 Owner',
      email: 'owner@w31-upgrade.test',
      emailVerified: true,
    });
    await pg.db.insert(account).values({
      id: 'w31-owner-account',
      accountId: 'w31-owner-user',
      providerId: 'credential',
      userId: 'w31-owner-user',
      password: passwordHash,
    });
    await pg.db.insert(session).values({
      id: 'w31-owner-session',
      token: 'w31-synthetic-session-token',
      userId: 'w31-owner-user',
      expiresAt,
    });
    await pg.db.insert(verification).values({
      id: 'w31-verification',
      identifier: 'owner@w31-upgrade.test',
      value: 'synthetic-verification-value',
      expiresAt,
    });
    await pg.db.insert(rateLimit).values({
      id: 'w31-rate-limit',
      key: 'synthetic|rate-limit',
      count: 3,
      lastRequest: Date.now(),
    });

    const before = await pg.pool.query(
      'select id, email, created_at from "user" where id = $1',
      ['w31-owner-user'],
    );
    const pubBefore = await pg.pool.query(
      "select count(*)::int as count from pg_tables where schemaname = 'public' and tablename in ('content_sections', 'faq_items')",
    );
    expect(pubBefore.rows[0].count).toBe(0);

    await migrate(pg.db, { migrationsFolder });

    const after = await pg.pool.query(
      'select id, email, created_at from "user" where id = $1',
      ['w31-owner-user'],
    );
    expect(after.rows).toEqual(before.rows);

    const accountRow = await pg.pool.query(
      'select password, user_id, account_id, provider_id from account where id = $1',
      ['w31-owner-account'],
    );
    expect(accountRow.rows[0]).toEqual({
      password: passwordHash,
      user_id: 'w31-owner-user',
      account_id: 'w31-owner-user',
      provider_id: 'credential',
    });

    const sessionRow = await pg.pool.query(
      'select token, user_id from "session" where id = $1',
      ['w31-owner-session'],
    );
    expect(sessionRow.rows[0]).toEqual({
      token: 'w31-synthetic-session-token',
      user_id: 'w31-owner-user',
    });

    const verificationRow = await pg.pool.query(
      'select identifier, value from verification where id = $1',
      ['w31-verification'],
    );
    expect(verificationRow.rows[0]).toEqual({
      identifier: 'owner@w31-upgrade.test',
      value: 'synthetic-verification-value',
    });

    const rateLimitRow = await pg.pool.query(
      'select key, count from rate_limit where id = $1',
      ['w31-rate-limit'],
    );
    expect(rateLimitRow.rows[0]).toEqual({ key: 'synthetic|rate-limit', count: 3 });

    const cmsTables = await pg.pool.query(
      "select tablename from pg_tables where schemaname = 'public' and tablename in ('content_sections', 'faq_items') order by tablename",
    );
    expect(cmsTables.rows.map((row) => row.tablename)).toEqual([
      'content_sections',
      'faq_items',
    ]);

    const migrationRows = await pg.pool.query(
      'select count(*)::int as count from drizzle.__drizzle_migrations',
    );
    expect(migrationRows.rows[0].count).toBe(5);
  });
});
