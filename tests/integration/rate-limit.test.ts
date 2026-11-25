import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  applyMigrations,
  authRequest,
  createTestAuth,
  emptyDatabase,
  getDisposablePostgres,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
} from './helpers';
import { ProvisioningRefusedError, provisionOwner } from '@/lib/admin-provisioning';

const pg = await getDisposablePostgres();

beforeAll(async () => {
  await applyMigrations(pg.db);
  await emptyDatabase(pg.pool);
  try {
    await provisionOwner({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      name: 'Nokmel Owner',
      password: TEST_OWNER_PASSWORD,
    });
  } catch (error) {
    if (!(error instanceof ProvisioningRefusedError)) throw error;
  }
});

afterAll(async () => {
  await pg.stop();
});

describe('database-backed sign-in rate limiting', () => {
  test('limits sign-in attempts to 5 per minute and persists the counters', async () => {
    const limitedAuth = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    let lastResponse: Response | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      lastResponse = await authRequest(limitedAuth, '/sign-in/email', {
        method: 'POST',
        body: { email: TEST_OWNER_EMAIL, password: 'wrong-password-value' },
      });
      expect(lastResponse.status).toBe(401);
    }

    const sixth = await authRequest(limitedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get('x-retry-after')).toBeTruthy();
    const body = (await sixth.json()) as { message?: string };
    expect(body.message ?? '').not.toContain(TEST_OWNER_EMAIL);

    const { rows } = await pg.pool.query('select key, count from rate_limit');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].count).toBeGreaterThan(0);
  });

  test('the limit persists across separate auth instances on the same database', async () => {
    const anotherInstance = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    const response = await authRequest(anotherInstance, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    expect(response.status).toBe(429);
  });

  test('does not lock the account indefinitely: counters expire with the window', async () => {
    const windowedAuth = createTestAuth(pg.db, {
      rateLimit: { enabled: true, windowSeconds: 1, signInMax: 2 },
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await authRequest(windowedAuth, '/sign-in/email', {
        method: 'POST',
        body: { email: TEST_OWNER_EMAIL, password: 'wrong-password-value' },
      });
    }
    const third = await authRequest(windowedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    expect(third.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const afterWindow = await authRequest(windowedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    expect(afterWindow.status).toBe(200);
    await afterWindow.json();
  });
});
