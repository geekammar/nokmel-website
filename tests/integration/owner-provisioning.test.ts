import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getDisposablePostgres, applyMigrations, TEST_OWNER_EMAIL } from './helpers';
import {
  ProvisioningRefusedError,
  provisionOwner,
  resetOwnerPassword,
} from '@/lib/admin-provisioning';

const pg = await getDisposablePostgres();

beforeAll(async () => {
  await applyMigrations(pg.db);
});

afterAll(async () => {
  await pg.stop();
});

describe('migrations from empty schema', () => {
  test('creates all Better Auth tables', async () => {
    const { rows } = await pg.pool.query(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const tables = rows.map((row) => row.table_name).sort();
    expect(tables).toEqual(['account', 'rate_limit', 'session', 'user', 'verification']);
  });

  test('enforces identity and relationship constraints', async () => {
    const { rows: fks } = await pg.pool.query(
      "select conname from pg_constraint where contype = 'f' and conrelid = 'session'::regclass",
    );
    expect(fks).toHaveLength(1);
    const { rows: unique } = await pg.pool.query(
      "select conname from pg_constraint where contype = 'u' and conrelid = 'user'::regclass",
    );
    expect(unique.map((row) => row.conname)).toContain('user_email_unique');
  });

  test('is safely re-applicable on an already migrated database', async () => {
    await expect(applyMigrations(pg.db)).resolves.toBeUndefined();
  });
});

describe('owner provisioning', () => {
  test('creates the owner with a hashed credential account', async () => {
    const result = await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Nokmel Owner',
      password: 'integration-owner-password-1',
    });
    expect(result.outcome).toBe('created');

    const { rows: users } = await pg.pool.query(
      "select id, email, email_verified from \"user\" where email = $1",
      [TEST_OWNER_EMAIL],
    );
    expect(users).toHaveLength(1);
    expect(users[0].email_verified).toBe(true);

    const { rows: accounts } = await pg.pool.query(
      "select provider_id, account_id, password from account where user_id = $1",
      [users[0].id],
    );
    expect(accounts).toHaveLength(1);
    expect(accounts[0].provider_id).toBe('credential');
    expect(accounts[0].account_id).toBe(users[0].id);
    expect(accounts[0].password).not.toContain('integration-owner-password-1');
    expect(accounts[0].password).not.toBe('');
  });

  test('is idempotent for the same owner identity', async () => {
    const result = await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Nokmel Owner',
      password: 'another-password-value-12',
    });
    expect(result.outcome).toBe('already-provisioned');

    const { rows } = await pg.pool.query("select count(*)::int as count from \"user\"");
    expect(rows[0].count).toBe(1);
  });

  test('refuses to create a second owner', async () => {
    await expect(
      provisionOwner({
        db: pg.db,
        email: 'intruder@w31-integration.test',
        name: 'Intruder',
        password: 'another-password-value-12',
      }),
    ).rejects.toBeInstanceOf(ProvisioningRefusedError);

    const { rows } = await pg.pool.query("select count(*)::int as count from \"user\"");
    expect(rows[0].count).toBe(1);
  });

  test('password recovery updates the hash and revokes sessions', async () => {
    const result = await resetOwnerPassword({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      password: 'rotation-password-value-1',
    });
    expect(result.outcome).toBe('password-reset');
    expect(result.invalidatedSessions).toBe(0);

    const { rows: accounts } = await pg.pool.query(
      "select password from account where provider_id = 'credential' limit 1",
    );
    expect(accounts[0].password).not.toContain('rotation-password-value-1');
  });
});
