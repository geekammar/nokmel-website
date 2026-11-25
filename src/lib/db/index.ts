import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ConfigError } from '@/lib/config-error';
import * as schema from './schema';
import type { Db } from './types';

/**
 * Server-only database module (W3.1).
 *
 * Lazily creates a single pooled `node-postgres` connection for the Next.js
 * serverless runtime, wrapped in the Drizzle PostgreSQL adapter. TLS with
 * certificate validation is always on for hosted Neon connections; disable
 * (`?sslmode=disable`) is accepted only for isolated local/CI test databases
 * reached over loopback.
 *
 * `DATABASE_URL` must never reach browser code; do not import this module from
 * client components and never use the `NEXT_PUBLIC_` prefix for it.
 */

let cached: { pool: Pool; db: Db } | null = null;

function assertPostgresUrl(connectionString: string): URL {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new ConfigError('DATABASE_URL is not a valid connection URL.');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new ConfigError('DATABASE_URL must use the postgresql:// scheme.');
  }
  return url;
}

function tlsFor(url: URL): true | { rejectUnauthorized: true } | undefined {
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode === 'disable') {
    const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
    if (!loopback) {
      throw new ConfigError('sslmode=disable is only allowed for loopback test connections.');
    }
    return undefined;
  }
  return { rejectUnauthorized: true };
}

export function getDb(): { pool: Pool; db: Db } {
  if (cached) return cached;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    throw new ConfigError('DATABASE_URL is not configured. Admin features fail closed without it.');
  }
  const url = assertPostgresUrl(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: tlsFor(url),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  cached = { pool, db: drizzle(pool, { schema }) };
  return cached;
}
