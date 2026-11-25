import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { ConfigError } from '@/lib/config-error';
import { resolveDatabaseConnectionPolicy } from '@/lib/db/connection-policy';

/**
 * Database-backed serialization for owner credential lifecycle operations
 * (W3.1 final closure, NKW-W31-REC-01).
 *
 * Password recovery and provisioning take an exclusive transaction-scoped
 * advisory lock before reading/updating owner state. The HTTP credential
 * sign-in path takes the same exclusive lock around the entire Better Auth
 * handler call. Therefore:
 *
 * - an in-flight sign-in that already verified the old password must finish
 *   creating its session before recovery can acquire the lock;
 * - recovery then replaces the hash and deletes all sessions (including that
 *   just-created session) in one transaction;
 * - a sign-in that starts after recovery commits verifies the new hash and
 *   fails for the old password.
 *
 * No process-local mutex is used; the lock is shared by all serverless
 * instances and operator processes. The sign-in lock uses a dedicated
 * single-connection pool so waiting sign-ins cannot starve the application's
 * runtime pool.
 */

export const OWNER_CREDENTIAL_LOCK_NAME = 'nokmel.website.owner_credentials';

/** Drizzle SQL used inside provisioning/recovery transactions. */
export const OWNER_CREDENTIAL_TRANSACTION_LOCK_SQL = sql`select pg_advisory_xact_lock(hashtext(${OWNER_CREDENTIAL_LOCK_NAME})::bigint)`;

type AuthHandler = {
  handler: (request: Request) => Promise<Response>;
};

let lockPool: Pool | null = null;

function getSignInLockPool(): Pool {
  if (lockPool) return lockPool;
  const raw = process.env.DATABASE_URL;
  if (!raw?.trim()) {
    throw new ConfigError(
      'DATABASE_URL is not configured; the owner credential lock cannot be acquired.',
    );
  }
  const policy = resolveDatabaseConnectionPolicy(raw, { label: 'DATABASE_URL' });
  lockPool = new Pool({
    connectionString: policy.connectionString,
    ssl: policy.tls,
    max: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return lockPool;
}

export function isCredentialSignInRequest(request: Request): boolean {
  if (request.method !== 'POST') return false;
  try {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
    return pathname.endsWith('/sign-in/email');
  } catch {
    return false;
  }
}

/**
 * Holds the exclusive owner-credential lock for the duration of `work`, using
 * a transaction-scoped advisory lock on a dedicated connection.
 *
 * The transaction is deliberate: the runtime `DATABASE_URL` is a Neon pooled
 * endpoint (PgBouncer transaction pooling), where session-level advisory locks
 * cannot be safely acquired and released across separate statements. Keeping
 * one transaction open pins the server connection until commit/rollback and
 * releases the lock automatically. A bounded lock wait prevents an
 * indefinitely blocked sign-in from hanging a request forever; a recovery
 * transaction that cannot acquire the lock fails before changing the hash.
 */
export async function withOwnerCredentialLock<T>(
  work: () => Promise<T>,
  poolOverride?: Pool,
): Promise<T> {
  const pool = poolOverride ?? getSignInLockPool();
  const client = await pool.connect();
  let transactionOpen = false;
  let commitAttempted = false;
  let destroyConnection = false;
  try {
    await client.query('begin');
    transactionOpen = true;
    await client.query("set local lock_timeout = '15000ms'");
    await client.query('select pg_advisory_xact_lock(hashtext($1)::bigint)', [
      OWNER_CREDENTIAL_LOCK_NAME,
    ]);
    await client.query('set local lock_timeout = 0');
    const result = await work();
    commitAttempted = true;
    await client.query('commit');
    transactionOpen = false;
    return result;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('rollback');
      } catch {
        destroyConnection = true;
      }
    }
    if (commitAttempted) destroyConnection = true;
    throw error;
  } finally {
    client.release(destroyConnection);
  }
}

/**
 * Single entry point for the auth HTTP route. Credential sign-in is serialized
 * with owner provisioning/recovery; all other auth requests keep their normal
 * path. Tests use the same function with a disposable pool override so the
 * production path is the tested path.
 */
export function handleOwnerAuthRequest(
  request: Request,
  auth: AuthHandler,
  poolOverride?: Pool,
): Promise<Response> {
  if (!isCredentialSignInRequest(request)) return auth.handler(request);
  return withOwnerCredentialLock(() => auth.handler(request), poolOverride);
}
