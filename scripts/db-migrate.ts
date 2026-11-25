#!/usr/bin/env tsx
/**
 * Operator migration entrypoint (replaces a bare `drizzle-kit migrate`).
 *
 * Validates DATABASE_URL_DIRECT before Drizzle Kit opens a connection:
 * required, direct (never the pooled runtime URL), postgresql scheme, no
 * destination/TLS-overriding parameters, and verified TLS for hosted targets.
 * Then delegates to Drizzle Kit, which reads the same validated target through
 * drizzle.config.ts with an explicit TLS option.
 *
 * Migrations are operator-only. They are never applied during application
 * build or startup, and DATABASE_URL_DIRECT must never be configured in the
 * deployed Vercel runtime.
 */

import { spawnSync } from 'node:child_process';
import { resolveOperatorDatabaseTarget } from '../src/lib/db/connection-policy';

function main(): number {
  try {
    resolveOperatorDatabaseTarget(process.env.DATABASE_URL_DIRECT);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid DATABASE_URL_DIRECT.');
    return 1;
  }

  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(command, ['exec', 'drizzle-kit', 'migrate'], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    console.error('Failed to start drizzle-kit:', result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

process.exit(main());
