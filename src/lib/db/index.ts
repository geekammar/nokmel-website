import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ConfigError } from '@/lib/config-error';
import { resolveDatabaseConnectionPolicy } from './connection-policy';
import * as schema from './schema';
import type { Db } from './types';

/**
 * Server-only database module (W3.1).
 *
 * Lazily creates a single pooled `node-postgres` connection for the Next.js
 * serverless runtime, wrapped in the Drizzle PostgreSQL adapter. The shared
 * connection policy validates the target and TLS settings before a pool is
 * created: hosted connections always verify certificate and hostname, and
 * plaintext (`sslmode=disable`) is accepted only for an explicit loopback test
 * database. The sanitized URL has no query parameters, so the pg
 * connection-string parser cannot override the validated TLS decision.
 *
 * `DATABASE_URL` must never reach browser code; do not import this module from
 * client components and never use the `NEXT_PUBLIC_` prefix for it.
 */

let cached: { pool: Pool; db: Db } | null = null;

export function getDb(): { pool: Pool; db: Db } {
  if (cached) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    throw new ConfigError('DATABASE_URL is not configured. Admin features fail closed without it.');
  }
  const policy = resolveDatabaseConnectionPolicy(connectionString, { label: 'DATABASE_URL' });
  const pool = new Pool({
    connectionString: policy.connectionString,
    ssl: policy.tls,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  cached = { pool, db: drizzle(pool, { schema }) };
  return cached;
}
