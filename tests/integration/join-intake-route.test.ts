import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { applyMigrations, emptyDatabase, getDisposablePostgres } from './helpers';
import { POST } from '@/app/api/join/route';
import { getDb } from '@/lib/db';
import { getPublicPlanBySlug } from '@/lib/plans/service';

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
  options: { origin?: string | null; ip?: string; contentType?: string } = {},
): Request {
  const headers = new Headers({
    'content-type': options.contentType ?? 'application/json',
    'x-forwarded-for': options.ip ?? '203.0.113.77',
  });
  if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
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

  test('enabled intake fails closed without a valid secret or origin configuration', async () => {
    process.env.JOIN_INTAKE_ENABLED = '1';
    const secret = process.env.BETTER_AUTH_SECRET;
    const baseUrl = process.env.BETTER_AUTH_URL;
    try {
      delete process.env.BETTER_AUTH_SECRET;
      const missingSecret = await POST(request(validBody(), { origin: null }));
      expect(missingSecret.status).toBe(503);
      expect((await missingSecret.json()).code).toBe('intake_misconfigured');
      expect(await requestCount()).toBe(0);

      process.env.BETTER_AUTH_SECRET = secret;
      delete process.env.BETTER_AUTH_URL;
      const missingOrigins = await POST(request(validBody(), { origin: null }));
      expect(missingOrigins.status).toBe(503);
      expect((await missingOrigins.json()).code).toBe('intake_misconfigured');
      expect(await requestCount()).toBe(0);
    } finally {
      if (secret === undefined) delete process.env.BETTER_AUTH_SECRET;
      else process.env.BETTER_AUTH_SECRET = secret;
      if (baseUrl === undefined) delete process.env.BETTER_AUTH_URL;
      else process.env.BETTER_AUTH_URL = baseUrl;
    }
  });

  test('enabled intake persists a request with status new and minimal response', async () => {
    process.env.JOIN_INTAKE_ENABLED = '1';
    process.env.NOKMEL_DISPOSABLE_TEST_ENV = '1';
    process.env.JOIN_RATE_LIMIT_MAX = '100';
    const body = validBody();
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toEqual({ ok: true, status: 'received' });
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
    expect(await second.json()).toEqual({ ok: true, status: 'received' });
    expect(await requestCount()).toBe(1);
    const row = await pg.pool.query('select name from join_requests');
    expect(row.rows[0].name).toBe('الاسم الأول');
  });

  test('replays a committed token safely after plan republication and hide', async () => {
    process.env.JOIN_INTAKE_ENABLED = '1';
    process.env.NOKMEL_DISPOSABLE_TEST_ENV = '1';
    process.env.JOIN_RATE_LIMIT_MAX = '100';
    await pg.pool.query(
      `insert into plans (
         id, slug, draft_name, draft_description, draft_features,
         draft_monthly_price_minor, draft_currency, draft_cta_label,
         draft_featured, draft_display_order,
         published_name, published_description, published_features,
         published_monthly_price_minor, published_currency, published_cta_label,
         published_featured, published_display_order,
         status, draft_revision, published_revision, published_at
       ) values (
         'route-replay-plan', 'route-replay-plan', 'عرض أصلي', 'وصف', '[]'::jsonb,
         14900, 'EGP', 'اطلب الانضمام', false, 1,
         'عرض أصلي', 'وصف', '[]'::jsonb,
         14900, 'EGP', 'اطلب الانضمام', false, 1,
         'published', 2, 2, now()
       )`,
    );
    const publicPlan = await getPublicPlanBySlug('route-replay-plan');
    if (!publicPlan) throw new Error('seeded plan missing');
    const originalOfferVersion = publicPlan.offer.version;
    const token = `route-replay-${randomUUID()}`;
    const body = validBody({
      planSlug: 'route-replay-plan',
      offerVersion: originalOfferVersion,
      submissionToken: token,
    });
    const first = await POST(request(body, { ip: '203.0.113.90' }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, status: 'received' });
    expect(await requestCount()).toBe(1);

    await pg.pool.query(
      "update plans set published_name = 'عرض محدث', published_monthly_price_minor = 19900, published_revision = 3 where id = 'route-replay-plan'",
    );
    const replayAfterRepublish = await POST(request(body, { ip: '203.0.113.90' }));
    expect(replayAfterRepublish.status).toBe(200);
    expect(await replayAfterRepublish.json()).toEqual({ ok: true, status: 'received' });
    expect(await requestCount()).toBe(1);

    await pg.pool.query(
      "update plans set status = 'hidden' where id = 'route-replay-plan'",
    );
    const replayAfterHide = await POST(request(body, { ip: '203.0.113.90' }));
    expect(replayAfterHide.status).toBe(200);
    expect(await replayAfterHide.json()).toEqual({ ok: true, status: 'received' });
    expect(await requestCount()).toBe(1);

    const original = await pg.pool.query(
      'select plan_name_snapshot, plan_price_minor_snapshot, name from join_requests where submission_token = $1',
      [token],
    );
    expect(original.rows[0]).toEqual({
      plan_name_snapshot: 'عرض أصلي',
      plan_price_minor_snapshot: 14_900,
      name: 'تاجر واجهة الاختبار',
    });
    const publicText = JSON.stringify(
      await (await POST(request(body, { ip: '203.0.113.90' }))).json(),
    );
    for (const leaked of ['route-replay', 'Omar', '+2010', 'plan_name', 'status":"new']) {
      expect(publicText).not.toContain(leaked);
    }

    const staleNewToken = await POST(
      request(
        validBody({
          planSlug: 'route-replay-plan',
          offerVersion: originalOfferVersion,
          submissionToken: `route-stale-${randomUUID()}`,
        }),
        { ip: '203.0.113.91' },
      ),
    );
    expect(staleNewToken.status).toBe(409);
    expect(await requestCount()).toBe(1);
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
