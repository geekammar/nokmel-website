import { ConfigError } from '../config-error';

/**
 * Single connection policy for every PostgreSQL target used by this project
 * (runtime, operator provisioning, migrations, integration/e2e tests).
 *
 * The policy is applied before a pool/client is constructed. It:
 * - accepts only absolute postgres:// / postgresql:// URLs with a host and database
 * - rejects URL parameters that could override the validated destination or TLS
 *   settings (`host`, `port`, `user`, `password`, `dbname`, `ssl*`, `options`,
 *   `uselibpqcompat`, ...)
 * - requires certificate/hostname verification for hosted connections and
 *   permits plaintext only for explicit loopback test connections
 * - returns a sanitized connection string (query parameters removed) so the
 *   pinned `node-postgres` connection-string parser cannot silently change the
 *   TLS decision after validation.
 *
 * Error messages never include the raw URL or credentials.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const ALLOWED_URL_PARAMS = new Set(['sslmode', 'channel_binding', 'application_name']);
const ALLOWED_SSL_MODES = new Set(['disable', 'require', 'verify-full']);
const ALLOWED_CHANNEL_BINDING = new Set(['require', 'prefer', 'disable']);

export type DatabaseTlsPolicy = false | { rejectUnauthorized: true };

export type DatabaseConnectionPolicy = {
  /** Validated connection string with all query parameters removed. */
  connectionString: string;
  host: string;
  port: number;
  database: string;
  sslmode: string | null;
  loopback: boolean;
  tls: DatabaseTlsPolicy;
};

function unbracket(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '');
}

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(unbracket(hostname.trim().toLowerCase()));
}

export function resolveDatabaseConnectionPolicy(
  raw: string | undefined,
  options: { label?: string } = {},
): DatabaseConnectionPolicy {
  const label = options.label ?? 'Database connection';
  if (!raw?.trim()) {
    throw new ConfigError(`${label} is not configured.`);
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ConfigError(`${label} is not a valid absolute database URL.`);
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new ConfigError(`${label} must use the postgresql:// scheme.`);
  }
  if (url.hash) {
    throw new ConfigError(`${label} must not contain a URL fragment.`);
  }

  const host = unbracket(url.hostname);
  if (!host) {
    throw new ConfigError(`${label} must include a database host.`);
  }
  if (host.includes('*') || /[\s/]/.test(host)) {
    throw new ConfigError(`${label} contains an invalid database host.`);
  }

  let database: string;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    throw new ConfigError(`${label} contains an invalid database name.`);
  }
  if (!database || database.includes('/') || database.includes('\0')) {
    throw new ConfigError(`${label} must include a single database name.`);
  }

  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_URL_PARAMS.has(key)) {
      throw new ConfigError(
        `${label} contains unsupported connection parameter "${key}"; destination and TLS settings must come from the validated URL.`,
      );
    }
    if (url.searchParams.getAll(key).length > 1) {
      throw new ConfigError(`${label} contains a duplicated connection parameter "${key}".`);
    }
  }

  const sslmode = url.searchParams.get('sslmode');
  if (sslmode !== null && !ALLOWED_SSL_MODES.has(sslmode)) {
    throw new ConfigError(
      `${label} uses an unsupported sslmode "${sslmode}"; use sslmode=require, sslmode=verify-full, or sslmode=disable on loopback only.`,
    );
  }

  const channelBinding = url.searchParams.get('channel_binding');
  if (channelBinding !== null && !ALLOWED_CHANNEL_BINDING.has(channelBinding)) {
    throw new ConfigError(`${label} uses an unsupported channel_binding value.`);
  }

  const loopback = isLoopbackHost(host);
  let tls: DatabaseTlsPolicy;
  if (sslmode === 'disable') {
    if (!loopback) {
      throw new ConfigError(
        `${label} may use sslmode=disable only for an explicit loopback test database.`,
      );
    }
    tls = false;
  } else {
    tls = { rejectUnauthorized: true };
  }

  const sanitized = new URL(url.toString());
  sanitized.search = '';
  sanitized.hash = '';

  return {
    connectionString: sanitized.toString(),
    host,
    port: url.port ? Number.parseInt(url.port, 10) : 5432,
    database,
    sslmode,
    loopback,
    tls,
  };
}

/**
 * Direct-connection operator path (migrations, owner provisioning and password
 * recovery). The pooled runtime URL is never accepted as a fallback.
 */
export function resolveOperatorDatabaseTarget(
  raw: string | undefined,
  options: { label?: string } = {},
): DatabaseConnectionPolicy {
  const label = options.label ?? 'DATABASE_URL_DIRECT';
  if (!raw?.trim()) {
    throw new ConfigError(
      `${label} is required for operator database operations; DATABASE_URL is a runtime connection and is never used for migrations or owner provisioning.`,
    );
  }
  const policy = resolveDatabaseConnectionPolicy(raw, { label });
  if (policy.host.toLowerCase().includes('pooler')) {
    throw new ConfigError(
      `${label} must be a direct database endpoint; pooled endpoints are not allowed for migrations or operator provisioning.`,
    );
  }
  return policy;
}

/** Safe, credential-free description for operator output. */
export function describeDatabaseTarget(policy: DatabaseConnectionPolicy): string {
  return `${policy.host}:${policy.port} database=${policy.database}`;
}
