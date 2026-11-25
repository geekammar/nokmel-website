#!/usr/bin/env tsx
/**
 * Local disposable PostgreSQL 18 for development/e2e usage only (dev tooling).
 * Stores its data under the OS temp directory; never hosted data.
 *
 *   pnpm dev:postgres
 *   DATABASE_URL="postgresql://nokmel_test:nokmel_test@127.0.0.1:55432/nokmel_test?sslmode=disable"
 */

import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';

const port = Number(process.env.DEV_POSTGRES_PORT ?? 55432);
const dataDir = path.join(tmpdir(), `nokmel-dev-pg-${randomUUID()}`);

async function main(): Promise<void> {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'nokmel_test',
    password: 'nokmel_test',
    port,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('nokmel_test');
  console.log(`PostgreSQL 18 ready: postgresql://nokmel_test:nokmel_test@127.0.0.1:${port}/nokmel_test?sslmode=disable`);
  const shutdown = async () => {
    await pg.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
