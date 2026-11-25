import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  getDisposablePostgres,
  applyMigrations,
  emptyDatabase,
  TEST_OWNER_EMAIL,
} from './helpers';
import {
  ProvisioningRefusedError,
  provisionOwner,
  resetOwnerPassword,
} from '@/lib/admin-provisioning';
import { account, session, user } from '@/lib/db/schema';

const pg = await getDisposablePostgres();

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
});

afterAll(async () => {
  await pg.stop();
});

async function insertUser(email: string, id = randomUUID()): Promise<string> {
  await pg.db.insert(user).values({
    id,
    name: 'Fixture User',
    email,
    emailVerified: true,
  });
  return id;
}

async function insertCredentialAccount(
  userId: string,
  options: { accountId?: string; password?: string | null; id?: string } = {},
): Promise<string> {
  const accountId = options.id ?? randomUUID();
  await pg.db.insert(account).values({
    id: accountId,
    accountId: options.accountId ?? userId,
    providerId: 'credential',
    userId,
    password:
      options.password === undefined
        ? 'a'.repeat(32) + ':' + 'b'.repeat(128)
        : options.password,
  });
  return accountId;
}

async function ownerPasswordHash(): Promise<string | null> {
  const { rows } = await pg.pool.query(
    "select password from account where provider_id = 'credential' limit 1",
  );
  return rows[0]?.password ?? null;
}

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
    const { rows: credentialUnique } = await pg.pool.query(
      "select indexname from pg_indexes where tablename = 'account' and indexname = 'account_user_credential_unique'",
    );
    expect(credentialUnique).toHaveLength(1);
  });

  test('is safely re-applicable on an already migrated database', async () => {
    await expect(applyMigrations(pg)).resolves.toBeUndefined();
  });
});

describe('owner provisioning identity integrity', () => {
  beforeEach(async () => {
    await emptyDatabase(pg);
  });

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

  test('repeated provisioning reports already-provisioned and never changes the password', async () => {
    await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Nokmel Owner',
      password: 'integration-owner-password-1',
    });
    const hashBefore = await ownerPasswordHash();

    const result = await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Nokmel Owner',
      password: 'another-password-value-12',
    });
    expect(result.outcome).toBe('already-provisioned');
    expect(await ownerPasswordHash()).toBe(hashBefore);

    const { rows } = await pg.pool.query("select count(*)::int as count from \"user\"");
    expect(rows[0].count).toBe(1);
  });

  test('refuses to create a second owner for a different identity', async () => {
    await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Nokmel Owner',
      password: 'integration-owner-password-1',
    });

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

  test('refuses an existing user without a credential account', async () => {
    await insertUser(TEST_OWNER_EMAIL);

    await expect(
      provisionOwner({
        db: pg.db,
        email: TEST_OWNER_EMAIL,
        name: 'Nokmel Owner',
        password: 'integration-owner-password-1',
      }),
    ).rejects.toThrow(/no credential account/i);

    const { rows: users } = await pg.pool.query('select count(*)::int as count from "user"');
    const { rows: accounts } = await pg.pool.query('select count(*)::int as count from account');
    expect(users[0].count).toBe(1);
    expect(accounts[0].count).toBe(0);
  });

  test('refuses a credential account without a usable password hash', async () => {
    const userId = await insertUser(TEST_OWNER_EMAIL);
    await insertCredentialAccount(userId, { password: null });

    await expect(
      provisionOwner({
        db: pg.db,
        email: TEST_OWNER_EMAIL,
        name: 'Nokmel Owner',
        password: 'integration-owner-password-1',
      }),
    ).rejects.toThrow(/no usable password hash/i);
  });

  test('refuses a malformed password hash instead of overwriting it', async () => {
    const userId = await insertUser(TEST_OWNER_EMAIL);
    await insertCredentialAccount(userId, { password: 'not-a-better-auth-hash' });

    await expect(
      provisionOwner({
        db: pg.db,
        email: TEST_OWNER_EMAIL,
        name: 'Nokmel Owner',
        password: 'integration-owner-password-1',
      }),
    ).rejects.toThrow(/no usable password hash/i);
    expect(await ownerPasswordHash()).toBe('not-a-better-auth-hash');
  });

  test('refuses an inconsistent account-to-user relationship', async () => {
    const userId = await insertUser(TEST_OWNER_EMAIL);
    await insertCredentialAccount(userId, { accountId: 'a-different-user-id' });

    await expect(
      provisionOwner({
        db: pg.db,
        email: TEST_OWNER_EMAIL,
        name: 'Nokmel Owner',
        password: 'integration-owner-password-1',
      }),
    ).rejects.toThrow(/inconsistent account-to-user relationship/i);
  });

  test('database constraint blocks a duplicate credential account for the same user', async () => {
    const userId = await insertUser(TEST_OWNER_EMAIL);
    await insertCredentialAccount(userId);

    let duplicateError: unknown;
    try {
      await insertCredentialAccount(userId);
    } catch (error) {
      duplicateError = error;
    }
    expect(duplicateError).toBeInstanceOf(Error);
    const cause = (duplicateError as { cause?: { code?: string; constraint?: string } }).cause;
    expect(cause?.code).toBe('23505');
    expect(cause?.constraint).toBe('account_user_credential_unique');

    const { rows } = await pg.pool.query(
      "select count(*)::int as count from account where user_id = $1 and provider_id = 'credential'",
      [userId],
    );
    expect(rows[0].count).toBe(1);
  });
});

describe('concurrent owner provisioning', () => {
  beforeEach(async () => {
    await emptyDatabase(pg);
  });

  test('same email: exactly one owner is created and the rest report already-provisioned', async () => {
    const results = await Promise.allSettled([
      provisionOwner({
        db: pg.db,
        email: TEST_OWNER_EMAIL,
        name: 'Owner A',
        password: 'concurrent-password-one-123',
      }),
      provisionOwner({
        db: pg.db,
        email: TEST_OWNER_EMAIL,
        name: 'Owner B',
        password: 'concurrent-password-two-123',
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(2);
    const outcomes = fulfilled
      .map((result) => (result.status === 'fulfilled' ? result.value.outcome : ''))
      .sort();
    expect(outcomes).toEqual(['already-provisioned', 'created']);

    const { rows: users } = await pg.pool.query('select count(*)::int as count from "user"');
    const { rows: accounts } = await pg.pool.query(
      "select count(*)::int as count from account where provider_id = 'credential'",
    );
    expect(users[0].count).toBe(1);
    expect(accounts[0].count).toBe(1);

    const hashBefore = await ownerPasswordHash();
    const repeated = await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Owner C',
      password: 'concurrent-password-three-123',
    });
    expect(repeated.outcome).toBe('already-provisioned');
    expect(await ownerPasswordHash()).toBe(hashBefore);
  });

  test('different emails: exactly one valid credential owner remains', async () => {
    const results = await Promise.allSettled([
      provisionOwner({
        db: pg.db,
        email: 'owner-a@w31-integration.test',
        name: 'Owner A',
        password: 'concurrent-password-one-123',
      }),
      provisionOwner({
        db: pg.db,
        email: 'owner-b@w31-integration.test',
        name: 'Owner B',
        password: 'concurrent-password-two-123',
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ProvisioningRefusedError,
    );

    const { rows: users } = await pg.pool.query('select count(*)::int as count from "user"');
    const { rows: accounts } = await pg.pool.query(
      "select count(*)::int as count from account where provider_id = 'credential'",
    );
    expect(users[0].count).toBe(1);
    expect(accounts[0].count).toBe(1);
  });
});

describe('password recovery', () => {
  beforeEach(async () => {
    await emptyDatabase(pg);
    await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Nokmel Owner',
      password: 'integration-owner-password-1',
    });
  });

  test('updates the hash and revokes all previously issued sessions atomically', async () => {
    const { rows: owners } = await pg.pool.query(
      'select id from "user" where email = $1',
      [TEST_OWNER_EMAIL],
    );
    const ownerId = owners[0].id;
    await pg.db.insert(session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: ownerId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const hashBefore = await ownerPasswordHash();

    const result = await resetOwnerPassword({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      password: 'rotation-password-value-1',
    });
    expect(result.outcome).toBe('password-reset');
    expect(result.invalidatedSessions).toBe(1);

    const hashAfter = await ownerPasswordHash();
    expect(hashAfter).not.toBe(hashBefore);
    expect(hashAfter).not.toContain('rotation-password-value-1');
    const { rows: sessions } = await pg.pool.query(
      'select count(*)::int as count from "session" where user_id = $1',
      [ownerId],
    );
    expect(sessions[0].count).toBe(0);
  });

  test('refuses recovery for an unknown identity', async () => {
    await expect(
      resetOwnerPassword({
        db: pg.db,
        email: 'nobody@w31-integration.test',
        password: 'rotation-password-value-1',
      }),
    ).rejects.toBeInstanceOf(ProvisioningRefusedError);
  });
});
