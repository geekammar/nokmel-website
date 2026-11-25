import { defineConfig } from 'drizzle-kit';
import { resolveOperatorDatabaseTarget } from './src/lib/db/connection-policy';

/**
 * Drizzle Kit is driven by DATABASE_URL_DIRECT only — a direct (non-pooled)
 * migration/provisioning connection. The pooled runtime DATABASE_URL is never
 * used as a fallback, and there is no automatic `push` against hosted
 * environments.
 *
 * When DATABASE_URL_DIRECT is present it is validated by the shared
 * connection policy (direct host, supported parameters, verified TLS for
 * hosted targets) and passed as structured credentials with an explicit TLS
 * option, so the pinned pg connection-string parser cannot override the TLS
 * decision. Without the variable the config remains loadable for offline
 * `db:check`/`db:generate`; `pnpm db:migrate` validates first in its wrapper.
 */

type PostgresCredentials =
  | { url: string }
  | {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
      ssl: false | { rejectUnauthorized: true };
    };

function migrationCredentials(): PostgresCredentials {
  const raw = process.env.DATABASE_URL_DIRECT;
  if (!raw?.trim()) return { url: '' };

  const target = resolveOperatorDatabaseTarget(raw);
  const url = new URL(target.connectionString);
  return {
    host: target.host,
    port: target.port,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: target.database,
    ssl: target.tls,
  };
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: migrationCredentials(),
});
