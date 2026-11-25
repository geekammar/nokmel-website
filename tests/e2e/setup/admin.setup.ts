import path from 'node:path';
import { test } from '@playwright/test';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { provisionOwner } from '../../../src/lib/admin-provisioning';
import * as schema from '../../../src/lib/db/schema';

/**
 * Prepares the disposable e2e database for the admin auth suite.
 * Skipped when the e2e environment is not configured (public-site specs still
 * run without it). Only synthetic identities are used here; real owner
 * credentials must never appear in e2e runs.
 */
const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);

test('admin e2e database setup', async () => {
  test.skip(!enabled, 'Admin e2e environment is not configured (needs DATABASE_URL + E2E_OWNER_PASSWORD)');
  const email = (process.env.OWNER_EMAIL ?? '').trim().toLowerCase();
  if (!email) throw new Error('OWNER_EMAIL must be set for admin e2e');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../../drizzle') });
    const result = await provisionOwner({
      db,
      email,
      name: 'E2E Owner',
      password: process.env.E2E_OWNER_PASSWORD as string,
    });
    if (result.outcome === 'created') console.log('e2e owner provisioned');
  } finally {
    await pool.end();
  }
});
