import { Pool } from 'pg';
import { ConfigError } from '../config-error';
import {
  isLoopbackHost,
  resolveDatabaseConnectionPolicy,
  type DatabaseConnectionPolicy,
} from './connection-policy';

/**
 * Central safety gate for externally configured destructive test databases.
 *
 * Integration tests, the browser e2e setup, and any script that may migrate,
 * truncate, drop, or insert fixtures must validate the target here before a
 * connection is opened. Hosted databases (including Neon), remote hosts,
 * production-like database names, non-loopback plaintext connections, and
 * URL parameters that could override the validated destination are rejected.
 *
 * Internally generated embedded PostgreSQL instances are still validated by
 * the same rules (the harness owns a temporary loopback instance with an
 * approved database name); the harness never falls back to a hosted
 * DATABASE_URL.
 */

const APPROVED_DATABASE_NAMES = new Set([
  'nokmel_test',
  'nokmel_ci_test',
  'nokmel_ci_e2e',
]);
const APPROVED_DATABASE_PREFIXES = ['nokmel_test_', 'nokmel_ci_'];
const HARNESS_DEFAULT_DATABASE = 'postgres';

export class DisposableDatabaseTargetError extends ConfigError {
  constructor(message: string) {
    super(message);
    this.name = 'DisposableDatabaseTargetError';
  }
}

export type DisposableTestDatabaseTarget = DatabaseConnectionPolicy & {
  /** Original externally provided URL (used to re-validate before destructive SQL). */
  rawUrl: string;
  /** True only for the harness-generated temporary embedded instance. */
  harnessOwned: boolean;
};

export function isApprovedDisposableDatabaseName(
  name: string,
  options: { allowHarnessDefault?: boolean } = {},
): boolean {
  const normalized = name.trim().toLowerCase();
  if (options.allowHarnessDefault && normalized === HARNESS_DEFAULT_DATABASE) return true;
  if (APPROVED_DATABASE_NAMES.has(normalized)) return true;
  return APPROVED_DATABASE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function assertDisposableTestDatabaseUrl(
  raw: string | undefined,
  options: { harnessOwned?: boolean } = {},
): DisposableTestDatabaseTarget {
  if (!raw?.trim()) {
    throw new DisposableDatabaseTargetError('Test database URL is not configured.');
  }

  let policy: DatabaseConnectionPolicy;
  try {
    policy = resolveDatabaseConnectionPolicy(raw, { label: 'Test database URL' });
  } catch (error) {
    throw new DisposableDatabaseTargetError(
      error instanceof Error ? error.message : 'Test database URL is invalid.',
    );
  }

  const host = policy.host.toLowerCase();
  if (host === 'neon.tech' || host.endsWith('.neon.tech') || host.endsWith('.neon.build')) {
    throw new DisposableDatabaseTargetError(
      'Refusing a hosted Neon endpoint as a disposable test database.',
    );
  }
  if (!policy.loopback || !isLoopbackHost(policy.host)) {
    throw new DisposableDatabaseTargetError(
      'Refusing a non-loopback test database host; disposable tests must use 127.0.0.1, ::1, or localhost.',
    );
  }
  if (policy.sslmode !== 'disable' || policy.tls !== false) {
    throw new DisposableDatabaseTargetError(
      'Disposable test database URLs must explicitly use sslmode=disable on loopback.',
    );
  }
  if (
    !isApprovedDisposableDatabaseName(policy.database, {
      allowHarnessDefault: options.harnessOwned === true,
    })
  ) {
    throw new DisposableDatabaseTargetError(
      `Refusing database name "${policy.database}" for destructive tests; use an approved disposable test database name.`,
    );
  }

  return { ...policy, rawUrl: raw.trim(), harnessOwned: options.harnessOwned === true };
}

/**
 * Validates first, then creates the pool. No network connection is attempted
 * when the target is unsafe.
 */
export function openDisposableTestPool(
  raw: string | undefined,
  options: { max?: number } = {},
): { target: DisposableTestDatabaseTarget; pool: Pool } {
  const target = assertDisposableTestDatabaseUrl(raw);
  const pool = new Pool({
    connectionString: target.connectionString,
    ssl: false,
    max: options.max ?? 5,
  });
  return { target, pool };
}

/**
 * Re-validates before destructive SQL (migrate/truncate/fixtures). Keeps a
 * provided URL from being swapped after the initial check.
 */
export function assertDestructiveTestTargetIsStillSafe(
  target: DisposableTestDatabaseTarget,
): void {
  const current = assertDisposableTestDatabaseUrl(target.rawUrl, {
    harnessOwned: target.harnessOwned,
  });
  if (current.connectionString !== target.connectionString) {
    throw new DisposableDatabaseTargetError(
      'Test database configuration changed after validation; refusing destructive SQL.',
    );
  }
}
