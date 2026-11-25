#!/usr/bin/env tsx
/**
 * Operator-only CLI: provision or recover the single website owner account.
 *
 * NEVER mounted as a public HTTP handler. This is a non-network local
 * bootstrap path run by the operator with explicit credentials handling:
 *
 *   Interactive (hidden input, repeated confirmation):
 *     pnpm owner:provision
 *
 *   Non-interactive (protected secret input via stdin pipe — never argv):
 *     printf '%s' "$OWNER_PASSWORD" | pnpm owner:provision --yes
 *
 *   Password recovery (updates hash + revokes all existing sessions):
 *     pnpm owner:reset-password           # same input methods
 *
 * Requirements:
 *   - Migrations applied first (`pnpm db:migrate` with DATABASE_URL_DIRECT).
 *   - OWNER_EMAIL and a database target must be set.
 *   - Public sign-up stays disabled; no plaintext password is inserted,
 *     printed, or committed.
 *   - Refuses to create a second owner; safe to re-run (idempotent).
 *
 * Exit codes: 0 success/already-provisioned, 2 refused, 1 configuration/runtime error.
 */

import { createInterface } from 'node:readline/promises';
import { EOL } from 'node:os';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  ProvisioningRefusedError,
  provisionOwner,
  resetOwnerPassword,
} from '../src/lib/admin-provisioning';
import * as schema from '../src/lib/db/schema';

type Args = {
  resetPassword: boolean;
  yes: boolean;
};

function parseArgs(argv: string[]): Args {
  return {
    resetPassword: argv.includes('--reset-password'),
    yes: argv.includes('--yes'),
  };
}

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw?.trim()) return null;
  return raw.trim();
}

async function readPasswordInteractive(label: string): Promise<string> {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  process.stdout.write(label);
  let value = '';
  for await (const chunk of stdin) {
    for (const char of chunk) {
      if (char === '\r' || char === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write(EOL);
        return value;
      }
      if (char === '\u0003') {
        stdin.setRawMode(false);
        throw new Error('Cancelled.');
      }
      if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
        continue;
      }
      value += char;
      process.stdout.write('*');
    }
  }
  stdin.setRawMode(false);
  return value;
}

async function readPasswordStdin(): Promise<string> {
  const rl = createInterface({ input: process.stdin });
  let data = '';
  for await (const line of rl) {
    data += `${line}\n`;
  }
  rl.close();
  const value = data.replace(/\r?\n$/, '') || data.trim();
  if (!value) throw new Error('No password received on stdin.');
  return value;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const isTTY = process.stdin.isTTY === true;

  const targetUrl = readEnv('DATABASE_URL_DIRECT') ?? readEnv('DATABASE_URL');
  if (!targetUrl) {
    console.error('Missing database target: set DATABASE_URL_DIRECT (migrations/provisioning only).');
    return 1;
  }
  const ownerEmail = readEnv('OWNER_EMAIL');
  if (!ownerEmail) {
    console.error('Missing OWNER_EMAIL.');
    return 1;
  }

  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    console.error('Database target is not a valid postgres URL.');
    return 1;
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    console.error('Database target must use the postgresql:// scheme.');
    return 1;
  }

  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode === 'disable' && !isLoopback) {
    console.error('Refusing sslmode=disable for a non-loopback database target.');
    return 1;
  }
  const ssl = sslmode === 'disable' ? undefined : { rejectUnauthorized: true as const };
  const target = `${url.host} database=${url.pathname.replace(/^\//, '')}`;

  process.stdout.write(`Target: ${target} (schema migrations must already be applied)\n`);
  if (isTTY) {
    if (!args.yes) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(`Proceed against ${target}? [y/N] `);
      rl.close();
      if (answer.trim().toLowerCase() !== 'y') {
        console.error('Aborted by operator.');
        return 1;
      }
    }
  } else if (!args.yes) {
    console.error('Confirmation required for non-interactive use: rerun with --yes.');
    return 1;
  }

  let password: string;
  if (isTTY) {
    password = await readPasswordInteractive('Owner password (input hidden): ');
  } else {
    password = await readPasswordStdin();
  }
  if (password.length < 12) {
    console.error('Password too short: minimum 12 characters.');
    return 1;
  }
  if (password.length > 128) {
    console.error('Password too long: maximum 128 characters.');
    return 1;
  }
  if (isTTY) {
    const repeat = await readPasswordInteractive('Repeat owner password: ');
    if (password !== repeat) {
      console.error('Passwords do not match.');
      return 1;
    }
  }

  const pool = new Pool({ connectionString: targetUrl, ssl, max: 1 });
  try {
    const db = drizzle(pool, { schema });
    if (args.resetPassword) {
      const result = await resetOwnerPassword({ db, email: ownerEmail, password });
      console.log(`Owner password updated. Sessions invalidated: ${result.invalidatedSessions}.`);
    } else {
      const result = await provisionOwner({ db, email: ownerEmail, name: 'Nokmel Owner', password });
      console.log(
        result.outcome === 'created'
          ? 'Owner account provisioned.'
          : 'Owner already provisioned for the configured identity; no changes made.',
      );
    }
    return 0;
  } catch (error) {
    if (error instanceof ProvisioningRefusedError) {
      console.error(`Refused: ${error.message}`);
      return 2;
    }
    if ((error as { code?: string })?.code === '42P01') {
      console.error('Authentication tables are missing. Run migrations first: pnpm db:migrate');
      return 1;
    }
    console.error('Provisioning failed:', error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Provisioning failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
