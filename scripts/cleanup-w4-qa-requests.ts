#!/usr/bin/env tsx
/**
 * Operator-only W4 QA join-request cleanup.
 *
 * Deletes only explicitly listed request IDs whose synthetic name marker
 * matches. Requires DATABASE_URL_DIRECT, a marker, exact IDs and --confirm.
 * Runs one transaction, locks/validates all rows before deletion, and aborts
 * without deleting if any ID is missing or any marker does not match.
 *
 * Never deletes all requests, never truncates, and never touches plans,
 * auth/CMS/SEO tables or other customer records. No admin route is exposed.
 *
 * Usage (operator machine, authorized by the owner):
 *   DATABASE_URL_DIRECT=... pnpm qa:cleanup-w4 \
 *     --marker "QA-W4-" --request-id <id> [--request-id <id>...]
 *   # repeat with --confirm only after reviewing the dry-run count/IDs
 */

import { Pool } from 'pg';
import { resolveOperatorDatabaseTarget } from '../src/lib/db/connection-policy';

type Parsed = {
  ids: string[];
  marker: string;
  confirm: boolean;
};

class CleanupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CleanupError';
  }
}

const USAGE = `Usage:
  DATABASE_URL_DIRECT=<direct operator URL> pnpm qa:cleanup-w4 \\
    --marker "QA-W4-" --request-id <id> [--request-id <id> ...] [--confirm]

Without --confirm the command validates and displays the affected count inside
a transaction, then rolls back. Never use TRUNCATE or delete-by-predicate.`;

function parseArgs(argv: string[]): Parsed {
  const ids: string[] = [];
  let marker = '';
  let confirm = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    }
    if (arg === '--confirm') {
      confirm = true;
      continue;
    }
    if (arg === '--request-id' || arg === '--marker') {
      const value = argv[index + 1];
      if (!value) throw new CleanupError(`${arg} requires a value.`);
      index += 1;
      if (arg === '--marker') marker = value.trim();
      else ids.push(value.trim());
      continue;
    }
    throw new CleanupError(`Unknown argument: ${arg}`);
  }

  if (!marker) throw new CleanupError('--marker is required.');
  if (marker.length > 60) throw new CleanupError('--marker is too long.');
  if (ids.length === 0) throw new CleanupError('At least one --request-id is required.');
  if (ids.length > 100) throw new CleanupError('At most 100 request IDs per run.');
  for (const id of ids) {
    if (!id || id.length > 80 || !/^[A-Za-z0-9-]+$/.test(id)) {
      throw new CleanupError('Every --request-id must be a valid recorded request ID.');
    }
  }
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw new CleanupError('Duplicate request IDs are not allowed.');
  }
  return { ids: unique, marker, confirm };
}

function targetDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL_DIRECT?.trim();
  if (!raw) throw new CleanupError('DATABASE_URL_DIRECT is required.');
  return raw;
}

async function main(): Promise<number> {
  let parsed: Parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
    const target = resolveOperatorDatabaseTarget(targetDatabaseUrl());
    const pool = new Pool({
      connectionString: target.connectionString,
      ssl: target.tls,
      max: 1,
    });
    const client = await pool.connect();
    try {
      await client.query('begin');
      const rows = await client.query<{ id: string; name: string }>(
        'select id, name from join_requests where id = any($1::text[]) order by id for update',
        [parsed.ids],
      );
      if (rows.rowCount !== parsed.ids.length) {
        throw new CleanupError(
          'Aborting: one or more requested IDs do not exist. No rows were deleted.',
        );
      }
      for (const row of rows.rows) {
        if (!row.name.startsWith(parsed.marker)) {
          throw new CleanupError(
            'Aborting: a request does not match the expected synthetic test marker. No rows were deleted.',
          );
        }
      }

      console.log(
        JSON.stringify({
          matched: rows.rowCount,
          ids: rows.rows.map((row) => row.id),
          mode: parsed.confirm ? 'delete' : 'dry-run',
        }),
      );

      if (!parsed.confirm) {
        await client.query('rollback');
        console.log('Dry run only. No rows were deleted.');
        return 0;
      }

      const deleted = await client.query(
        'delete from join_requests where id = any($1::text[])',
        [parsed.ids],
      );
      if (deleted.rowCount !== parsed.ids.length) {
        throw new CleanupError(
          'Aborting: deletion count did not match the validated count. Transaction rolled back.',
        );
      }
      await client.query('commit');
      console.log(`Deleted ${deleted.rowCount ?? 0} synthetic W4 QA request(s).`);
      return 0;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
      await pool.end().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof CleanupError) {
      console.error(error.message);
    } else {
      console.error('Cleanup aborted. No rows were deleted.');
    }
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch(() => process.exit(1));
