import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import EmbeddedPostgres from 'embedded-postgres';
import { createAuth, type Auth } from '@/lib/auth';
import type { Db } from '@/lib/db/types';
import * as schema from '@/lib/db/schema';

const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../drizzle');

export type DisposablePostgres = {
  kind: 'embedded' | 'provided';
  url: string;
  pool: Pool;
  db: Db;
  stop: () => Promise<void>;
};

let singleton: Promise<DisposablePostgres> | null = null;

/**
 * Disposable PostgreSQL for integration tests.
 * - TEST_DATABASE_URL set (CI service container): uses it, never cleans up.
 * - Otherwise: launches an isolated embedded PostgreSQL 18 instance on a
 *   random loopback port with a temporary data directory.
 */
export function getDisposablePostgres(): Promise<DisposablePostgres> {
  singleton ??= start();
  return singleton;
}

async function start(): Promise<DisposablePostgres> {
  const provided = process.env.TEST_DATABASE_URL?.trim();
  if (provided) {
    const pool = new Pool({ connectionString: provided, max: 5 });
    const client = await pool.connect();
    const { rows } = await client.query('select version()');
    client.release();
    if (!/PostgreSQL 1[789]/.test(rows[0].version)) {
      throw new Error(`Integration tests require PostgreSQL 17+, got: ${rows[0].version}`);
    }
    const db = drizzle(pool, { schema });
    return { kind: 'provided', url: provided, pool, db, stop: async () => pool.end() };
  }

  const port = 20000 + Math.floor(Math.random() * 20000);
  const dataDir = path.join(tmpdir(), `nokmel-embedded-pg-${randomUUID()}`);
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'nokmel_test',
    password: 'nokmel_test',
    port,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  const url = `postgresql://nokmel_test:nokmel_test@127.0.0.1:${port}/postgres?sslmode=disable`;
  const pool = new Pool({ connectionString: url, max: 5 });
  const db = drizzle(pool, { schema });
  return {
    kind: 'embedded',
    url,
    pool,
    db,
    stop: async () => {
      await pool.end().catch(() => undefined);
      await pg.stop();
    },
  };
}

export function applyMigrations(db: Db): Promise<void> {
  return migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

export async function emptyDatabase(pool: Pool): Promise<void> {
  await pool.query(
    'truncate table "session", "account", "user", "verification", "rate_limit" cascade',
  );
}

export type TestAuthOptions = {
  rateLimit?: { enabled?: boolean; windowSeconds?: number; max?: number; signInMax?: number };
};

export function createTestAuth(
  db: Db,
  options: TestAuthOptions = {},
): Auth {
  return createAuth({
    db,
    rateLimit: {
      enabled: options.rateLimit?.enabled ?? false,
      windowSeconds: options.rateLimit?.windowSeconds,
      max: options.rateLimit?.max,
      signInMax: options.rateLimit?.signInMax,
    },
  });
}

export const TEST_OWNER_EMAIL = 'owner@w31-integration.test';
export const TEST_OWNER_PASSWORD = 'integration-owner-password-1';
export const TEST_BAD_ORIGIN = 'https://attacker.example';

export function authRequest(
  auth: Auth,
  path: string,
  init: { method: string; body?: unknown; cookie?: string; origin?: string },
): Promise<Response> {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: init.origin ?? 'http://127.0.0.1:3100',
  });
  if (init.cookie) headers.set('cookie', init.cookie);
  return auth.handler(
    new Request(`http://127.0.0.1:3100/api/auth${path}`, {
      method: init.method,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers,
    }),
  );
}

export function sessionCookieFrom(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((cookie) => cookie.startsWith('nokmel.session_token'));
  if (!session) throw new Error(`No session cookie in response cookies: ${cookies.join(' | ')}`);
  return session.split(';')[0];
}
