import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { applyMigrations, emptyDatabase, getDisposablePostgres } from './helpers';
import { POST } from '@/app/api/join/route';
import { getDb } from '@/lib/db';

const pg = await getDisposablePostgres();
const ORIGIN = 'http://127.0.0.1:3100';
const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  JOIN_INTAKE_ENABLED: process.env.JOIN_INTAKE_ENABLED,
  JOIN_RATE_LIMIT_MAX: process.env.JOIN_RATE_LIMIT_MAX,
  NOKMEL_DISPOSABLE_TEST_ENV: process.env.NOKMEL_DISPOSABLE_TEST_ENV,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
};

function request(
  body: Record<string, unknown>,
  options: { origin?: string; ip?: string; contentType?: string } = {},
): Request {
  const headers = new Headers({
    'content-type': options.contentType ?? 'application/json',
    origin: options.origin ?? ORIGIN,
    'x-forwarded-for': options.ip ?? '203.0.113.77',
  });
  return new Request(`${ORIGIN}/api/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'تاجر واجهة الاختبار',
    phone: '01098765432',
    countryCode: '+20',
    businessActivity: 'متجر اختبار',
    source: 'pricing',
    submissionToken: `route-token-${randomUUID()}`,
    ...overrides,
  };
}

async function requestCount(): Promise<number> {
  const result = await pg.pool.query('select count(*)::int as count from join_requests');
  return result.rows[0].count;
}

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
  process.env.DATABASE_URL = pg.url;
  process.env.BETTER_AUTH_URL = ORIGIN;
  process.env.TRUSTED_ORIGINS = ORIGIN;
  process.env.BETTER_AUTH_SECRET =
    'join-route-integration-secret-0123456789abcdef';
});

beforeEach(async () => {
  await pg.pool.query('delete from join_requests');
  await pg.pool.query('delete from join_intake_rate_limits');
});

afterAll(async () => {
  try {
    await getDb().pool.end();
  } catch {
    // Pool may not have been created by a disabled-intake-only run.
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await pg.stop();
});

describe('public join-intake route against PostgreSQL', () => {
  test('disabled intake rejects the request and creates no record', async () => {
    delete process.env.JOIN_INTAKE_ENABLED;
    const response = await POST(request(validBody()));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('intake_disabled');
    expect(await requestCount()).toBe(0);
  });

  test('enabled intake persists a request with status new and minimal response', async () => {
    process.env.JOIN_INTAKE_ENABLED = '1';
    process.env.NOKMEL_DISPOSABLE_TEST_ENV = '1';
    process.env.JOIN_RATE_LIMIT_MAX = '100';
    const body = validBody();
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toEqual({ ok: true, status: 'received', duplicate: false });
    const text = JSON.stringify(payload);
    expect(text).not.toContain('id');
    expect(text).not.toContain('notes');
    expect(text).not.toContain('status":"new');

    const rows = await pg.pool.query(
      'select status, notes, phone, plan_name_snapshot, submission_token from join_requests',
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].status).toBe('new');
    expect(rows.rows[0].notes).toBeNull();
    expect(rows.rows[0].phone).toBe('+201098765432');
    expect(rows.rows[0].plan_name_snapshot).toBeNull();
    expect(rows.rows[0].submission_token).toBe(body.submissionToken);
  });

  test('duplicate tokens remain one record, including a changed payload', async () => {
    process.env.JOIN_INTAKE_ENABLED = '1';
    process.env.JOIN_RATE_LIMIT_MAX = '100';
    const body = validBody({ name: 'الاسم الأول' });
    const first = await POST(request(body, { ip: '203.0.113.78' }));
    const second = await POST(
      request({ ...body, name: 'اسم ثانٍ لنفس الرمز' }, { ip: '203.0.113.78' }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).duplicate).toBe(true);
    expect(await requestCount()).toBe(1);
    const row = await pg.pool.query('select name from join_requests');
    expect(row.rows[0].name).toBe('الاسم الأول');
  });

  test('enforces origin, content type and rate limiting with real persisted counters', async () => {
    process.env.JOIN_INTAKE_ENABLED = '1';
    process.env.NOKMEL_DISPOSABLE_TEST_ENV = '1';
    process.env.JOIN_RATE_LIMIT_MAX = '2';
    const evil = await POST(
      request(validBody(), { origin: 'https://attacker.example', ip: '203.0.113.79' }),
    );
    expect(evil.status).toBe(403);
    const wrongType = await POST(
      request(validBody(), { contentType: 'text/plain', ip: '203.0.113.79' }),
    );
    expect(wrongType.status).toBe(415);
    expect(await requestCount()).toBe(0);

    const first = await POST(request(validBody(), { ip: '203.0.113.80' }));
    const second = await POST(request(validBody(), { ip: '203.0.113.80' }));
    const third = await POST(request(validBody(), { ip: '203.0.113.80' }));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await third.json()).retryAfterSeconds).toBeGreaterThan(0);
    expect(await requestCount()).toBe(2);

    const otherIdentity = await POST(request(validBody(), { ip: '203.0.113.81' }));
    expect(otherIdentity.status).toBe(200);

    const stored = await pg.pool.query(
      'select key from join_intake_rate_limits order by key',
    );
    for (const row of stored.rows) {
      expect(row.key.startsWith('join-intake:v1:')).toBe(true);
      expect(row.key).not.toContain('203.0.113');
    }
    process.env.JOIN_RATE_LIMIT_MAX = '100';
  });
});
