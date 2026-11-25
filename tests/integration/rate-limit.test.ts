import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  applyMigrations,
  authRequest,
  clearRateLimits,
  createTestAuth,
  emptyDatabase,
  getDisposablePostgres,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
} from './helpers';
import { ProvisioningRefusedError, provisionOwner } from '@/lib/admin-provisioning';
import { DISPOSABLE_TEST_ENV_FLAG } from '@/lib/rate-limit-config';

const pg = await getDisposablePostgres();
const originalEnv = {
  RATE_LIMIT_SIGNIN_MAX: process.env.RATE_LIMIT_SIGNIN_MAX,
  VERCEL_ENV: process.env.VERCEL_ENV,
  [DISPOSABLE_TEST_ENV_FLAG]: process.env[DISPOSABLE_TEST_ENV_FLAG],
};

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
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

beforeEach(async () => {
  await clearRateLimits(pg);
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

afterAll(async () => {
  await pg.stop();
});

async function wrongAttempts(auth: ReturnType<typeof createTestAuth>, count: number, ip?: string) {
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < count; attempt += 1) {
    lastResponse = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: 'wrong-password-value' },
      ip,
    });
    expect(lastResponse.status).toBe(401);
  }
  return lastResponse;
}

describe('database-backed sign-in rate limiting', () => {
  test('limits sign-in attempts to 5 per minute and persists the counters', async () => {
    const limitedAuth = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    await wrongAttempts(limitedAuth, 5, '203.0.113.10');

    const sixth = await authRequest(limitedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '203.0.113.10',
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
    const limitedAuth = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    await wrongAttempts(limitedAuth, 5, '203.0.113.11');

    const anotherInstance = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    const response = await authRequest(anotherInstance, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '203.0.113.11',
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
        ip: '203.0.113.12',
      });
    }
    const third = await authRequest(windowedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '203.0.113.12',
    });
    expect(third.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const afterWindow = await authRequest(windowedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '203.0.113.12',
    });
    expect(afterWindow.status).toBe(200);
    await afterWindow.json();
  });
});

describe('rate-limit override safety', () => {
  test('an explicitly marked disposable test environment may raise the ceiling', async () => {
    process.env.RATE_LIMIT_SIGNIN_MAX = '2';
    process.env[DISPOSABLE_TEST_ENV_FLAG] = '1';
    delete process.env.VERCEL_ENV;

    const overridden = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    await wrongAttempts(overridden, 2, '203.0.113.20');
    const third = await authRequest(overridden, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '203.0.113.20',
    });
    expect(third.status).toBe(429);
  });

  test('invalid override values are ignored and the default limit remains', async () => {
    process.env.RATE_LIMIT_SIGNIN_MAX = 'not-a-number';
    process.env[DISPOSABLE_TEST_ENV_FLAG] = '1';
    delete process.env.VERCEL_ENV;

    const configured = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    await wrongAttempts(configured, 5, '203.0.113.21');
    const sixth = await authRequest(configured, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '203.0.113.21',
    });
    expect(sixth.status).toBe(429);
  });

  test('hosted Vercel environments ignore even an explicitly flagged override', async () => {
    process.env.RATE_LIMIT_SIGNIN_MAX = '50';
    process.env[DISPOSABLE_TEST_ENV_FLAG] = '1';
    process.env.VERCEL_ENV = 'preview';

    const hosted = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    await wrongAttempts(hosted, 5, '203.0.113.22');
    const sixth = await authRequest(hosted, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '203.0.113.22',
    });
    expect(sixth.status).toBe(429);
  });
});

describe('request identity handling', () => {
  test('distinct trusted single-value client IPs get independent counters', async () => {
    const limitedAuth = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    await wrongAttempts(limitedAuth, 5, '198.51.100.10');

    const blocked = await authRequest(limitedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '198.51.100.10',
    });
    expect(blocked.status).toBe(429);

    const otherIp = await authRequest(limitedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '198.51.100.11',
    });
    expect(otherIp.status).toBe(200);
    await otherIp.json();

    const { rows } = await pg.pool.query("select key from rate_limit where key like '198.51.100.10|%'");
    expect(rows.length).toBeGreaterThan(0);
  });

  test('multi-value forwarded chains are not trusted (shared bucket, not leftmost spoof)', async () => {
    const limitedAuth = createTestAuth(pg.db, { rateLimit: { enabled: true } });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await authRequest(limitedAuth, '/sign-in/email', {
        method: 'POST',
        body: { email: TEST_OWNER_EMAIL, password: 'wrong-password-value' },
        ip: `1.2.3.${attempt}, 5.6.7.8`,
      });
      expect(response.status).toBe(401);
    }
    const sixth = await authRequest(limitedAuth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      ip: '9.9.9.9, 5.6.7.8',
    });
    expect(sixth.status).toBe(429);

    const { rows: spoofedKeys } = await pg.pool.query(
      "select key from rate_limit where key like '1.2.3.%' or key like '9.9.9.%'",
    );
    expect(spoofedKeys).toHaveLength(0);
    const { rows: sharedKeys } = await pg.pool.query(
      "select key from rate_limit where key like 'no-trusted-ip|%'",
    );
    expect(sharedKeys.length).toBeGreaterThan(0);
  });
});
