import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { applyMigrations, emptyDatabase, getDisposablePostgres } from './helpers';
import {
  JoinPlanUnavailableError,
  JoinRequestConflictError,
} from '@/lib/join/errors';
import { consumeJoinRateLimit } from '@/lib/join/rate-limit';
import {
  createJoinRequest,
  getJoinRequest,
  listJoinRequests,
  saveJoinRequestNotes,
  updateJoinRequestStatus,
} from '@/lib/join/service';
import {
  parseJoinSubmission,
  type JoinSubmission,
} from '@/lib/join/validation';
import { createPlan, hidePlan, publishPlan, savePlanDraft } from '@/lib/plans/service';
import type { PlanFormValues } from '@/lib/plans/model';

const pg = await getDisposablePostgres();

function planValues(overrides: Partial<PlanFormValues> = {}): PlanFormValues {
  return {
    name: 'باقة الانضمام',
    description: 'باقة تعريفية للاختبار.',
    features: ['متابعة الطلبات'],
    monthlyPrice: '149.00',
    yearlyPrice: '1490.00',
    currency: 'EGP',
    ctaLabel: 'اطلب الانضمام',
    featured: false,
    displayOrder: 1,
    ...overrides,
  };
}

function submission(overrides: Record<string, unknown> = {}): JoinSubmission {
  const result = parseJoinSubmission({
    name: 'تاجر اختبار',
    phone: '+201001234567',
    email: '',
    businessActivity: 'متجر ملابس',
    source: 'direct',
    submissionToken: `token-${randomUUID()}`,
    ...overrides,
  });
  if (!result.ok) throw new Error(`invalid test submission: ${JSON.stringify(result.errors)}`);
  return result.submission;
}

async function publishedTestPlan(slug: string) {
  const created = await createPlan(
    { slug, values: planValues({ name: `باقة ${slug}` }) },
    { db: pg.db },
  );
  return publishPlan(
    { id: created.id, expectedRevision: created.revision },
    { db: pg.db },
  );
}

async function countRequests(): Promise<number> {
  const result = await pg.pool.query('select count(*)::int as count from join_requests');
  return result.rows[0].count;
}

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
});

beforeEach(async () => {
  await pg.pool.query('delete from join_requests');
  await pg.pool.query('delete from join_intake_rate_limits');
});

afterAll(async () => {
  await pg.stop();
});

describe('public join-request persistence', () => {
  test('direct join without a plan succeeds with status new and no internal metadata', async () => {
    const result = await createJoinRequest(submission(), { db: pg.db });
    expect(result.created).toBe(true);
    if (!result.created) return;
    const detail = await getJoinRequest(result.id, { db: pg.db });
    expect(detail.status).toBe('ok');
    if (detail.status !== 'ok') return;
    expect(detail.request.status).toBe('new');
    expect(detail.request.notes).toBeNull();
    expect(detail.request.planId).toBeNull();
    expect(detail.request.planNameSnapshot).toBeNull();
    expect(detail.request.phone).toBe('+201001234567');
    expect(detail.request.revision).toBe(0);
  });

  test('join with a published plan stores a server-generated offer snapshot', async () => {
    const plan = await publishedTestPlan(`snapshot-${randomUUID().slice(0, 8)}`);
    const result = await createJoinRequest(
      submission({ planSlug: plan.slug, planRevision: plan.publishedRevision }),
      { db: pg.db },
    );
    expect(result.created).toBe(true);
    if (!result.created) return;
    const detail = await getJoinRequest(result.id, { db: pg.db });
    if (detail.status !== 'ok') throw new Error('detail failed');
    expect(detail.request.planNameSnapshot).toBe(plan.published?.name);
    expect(detail.request.planPriceMinorSnapshot).toBe(14_900);
    expect(detail.request.planPricePeriodSnapshot).toBe('monthly');
    expect(detail.request.planCurrencySnapshot).toBe('EGP');
  });

  test('unknown and hidden plans are rejected safely without creating records', async () => {
    await expect(
      createJoinRequest(submission({ planSlug: 'unknown-plan', planRevision: 1 }), {
        db: pg.db,
      }),
    ).rejects.toBeInstanceOf(JoinPlanUnavailableError);
    expect(await countRequests()).toBe(0);

    const plan = await publishedTestPlan(`hidden-${randomUUID().slice(0, 8)}`);
    const hidden = await hidePlan(
      { id: plan.id, expectedRevision: plan.revision },
      { db: pg.db },
    );
    await expect(
      createJoinRequest(submission({ planSlug: hidden.slug, planRevision: plan.publishedRevision }), {
        db: pg.db,
      }),
    ).rejects.toBeInstanceOf(JoinPlanUnavailableError);
    expect(await countRequests()).toBe(0);
  });

  test('a plan change between selection and submission is rejected without silent reassignment', async () => {
    const plan = await publishedTestPlan(`changed-${randomUUID().slice(0, 8)}`);
    const selectedRevision = plan.publishedRevision;
    if (selectedRevision === null) throw new Error('missing revision');

    const edited = await savePlanDraft(
      {
        id: plan.id,
        expectedRevision: plan.revision,
        values: planValues({ name: 'عرض متغيّر', monthlyPrice: '299.00' }),
      },
      { db: pg.db },
    );
    const republished = await publishPlan(
      { id: edited.id, expectedRevision: edited.revision },
      { db: pg.db },
    );

    await expect(
      createJoinRequest(submission({ planSlug: plan.slug, planRevision: selectedRevision }), {
        db: pg.db,
      }),
    ).rejects.toMatchObject({
      name: 'JoinPlanChangedError',
      currentPlan: { publishedRevision: republished.publishedRevision },
    });
    expect(await countRequests()).toBe(0);
  });

  test('historical offer snapshots survive later plan edits and hiding', async () => {
    const plan = await publishedTestPlan(`history-${randomUUID().slice(0, 8)}`);
    const created = await createJoinRequest(
      submission({ planSlug: plan.slug, planRevision: plan.publishedRevision }),
      { db: pg.db },
    );
    if (!created.created) throw new Error('create failed');

    const edited = await savePlanDraft(
      {
        id: plan.id,
        expectedRevision: plan.revision,
        values: planValues({ name: 'اسم جديد تماماً', monthlyPrice: '999.00' }),
      },
      { db: pg.db },
    );
    const republished = await publishPlan(
      { id: edited.id, expectedRevision: edited.revision },
      { db: pg.db },
    );
    await hidePlan(
      { id: republished.id, expectedRevision: republished.revision },
      { db: pg.db },
    );

    const detail = await getJoinRequest(created.id, { db: pg.db });
    if (detail.status !== 'ok') throw new Error('detail failed');
    expect(detail.request.planNameSnapshot).toBe(plan.published?.name);
    expect(detail.request.planPriceMinorSnapshot).toBe(14_900);
    expect(detail.request.notes).toBeNull();
  });

  test('idempotency: repeated and concurrent duplicate tokens create one immutable record', async () => {
    const base = submission({ name: 'الاسم الأصلي' });
    const first = await createJoinRequest(base, { db: pg.db });
    const repeat = await createJoinRequest(
      { ...base, name: 'اسم مختلف لنفس الرمز' },
      { db: pg.db },
    );
    expect(first.created).toBe(true);
    expect(repeat.created).toBe(false);
    expect(await countRequests()).toBe(1);
    const rows = await pg.pool.query('select name from join_requests');
    expect(rows.rows[0].name).toBe('الاسم الأصلي');

    await pg.pool.query('delete from join_requests');
    const concurrent = submission({ name: 'طلب متزامن' });
    const results = await Promise.all([
      createJoinRequest(concurrent, { db: pg.db }),
      createJoinRequest(concurrent, { db: pg.db }),
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await countRequests()).toBe(1);
  });

  test('clients cannot inject administrative status or notes', async () => {
    const invalid = parseJoinSubmission({
      name: 'تاجر',
      phone: '+201001234567',
      source: 'direct',
      status: 'closed',
      notes: 'internal',
      submissionToken: `token-${randomUUID()}`,
    });
    expect(invalid.ok).toBe(false);

    const created = await createJoinRequest(submission(), { db: pg.db });
    if (!created.created) throw new Error('create failed');
    const rows = await pg.pool.query(
      'select status, notes, revision, source from join_requests where id = $1',
      [created.id],
    );
    expect(rows.rows[0]).toEqual({
      status: 'new',
      notes: null,
      revision: 0,
      source: 'direct',
    });
  });
});

describe('owner join-request management', () => {
  test('updates status, saves notes, rejects stale writes and allows reopening', async () => {
    const created = await createJoinRequest(submission(), { db: pg.db });
    if (!created.created) throw new Error('create failed');

    const contacted = await updateJoinRequestStatus(
      { id: created.id, expectedRevision: 0, status: 'contacted' },
      { db: pg.db },
    );
    expect(contacted.status).toBe('contacted');
    expect(contacted.revision).toBe(1);

    const noted = await saveJoinRequestNotes(
      { id: created.id, expectedRevision: 1, notes: '  تم التواصل هاتفياً  ' },
      { db: pg.db },
    );
    expect(noted.notes).toBe('تم التواصل هاتفياً');
    expect(noted.revision).toBe(2);

    await expect(
      saveJoinRequestNotes(
        { id: created.id, expectedRevision: 1, notes: 'كتابة قديمة' },
        { db: pg.db },
      ),
    ).rejects.toBeInstanceOf(JoinRequestConflictError);

    const closed = await updateJoinRequestStatus(
      { id: created.id, expectedRevision: 2, status: 'closed' },
      { db: pg.db },
    );
    expect(closed.status).toBe('closed');
    const reopened = await updateJoinRequestStatus(
      { id: created.id, expectedRevision: definedRevision(closed.revision), status: 'contacted' },
      { db: pg.db },
    );
    expect(reopened.status).toBe('contacted');
    await expect(
      updateJoinRequestStatus(
        { id: created.id, expectedRevision: reopened.revision, status: 'invalid' },
        { db: pg.db },
      ),
    ).rejects.toThrow();
  });

  test('list is bounded, newest-first, filtered and searchable with real counts', async () => {
    const ids: string[] = [];
    for (let index = 0; index < 25; index += 1) {
      const created = await createJoinRequest(
        submission({
          name: `تاجر ${index}`,
          phone: `+2010012${String(index).padStart(4, '0')}`,
        }),
        { db: pg.db },
      );
      if (!created.created) throw new Error('create failed');
      ids.push(created.id);
    }
    await pg.pool.query(
      "update join_requests set created_at = timestamptz '2026-01-01T00:00:00Z' + (id = $1)::int * interval '1 minute' where id = any($2::text[])",
      [ids[0], ids],
    );
    const firstPage = await listJoinRequests({ page: 1, pageSize: 5 }, { db: pg.db });
    if (firstPage.status !== 'ok') throw new Error('list failed');
    expect(firstPage.requests).toHaveLength(5);
    expect(firstPage.filteredTotal).toBe(25);
    expect(firstPage.counts.new).toBe(25);
    const bounded = await listJoinRequests({ page: 1, pageSize: 999 }, { db: pg.db });
    if (bounded.status !== 'ok') throw new Error('list failed');
    expect(bounded.requests).toHaveLength(25);

    const searched = await listJoinRequests({ query: 'تاجر 7', pageSize: 20 }, { db: pg.db });
    if (searched.status !== 'ok') throw new Error('search failed');
    expect(searched.requests).toHaveLength(1);
    expect(searched.requests[0].name).toBe('تاجر 7');

    await updateJoinRequestStatus(
      { id: ids[1], expectedRevision: 0, status: 'closed' },
      { db: pg.db },
    );
    const closedFilter = await listJoinRequests(
      { status: 'closed', pageSize: 20 },
      { db: pg.db },
    );
    if (closedFilter.status !== 'ok') throw new Error('filter failed');
    expect(closedFilter.requests).toHaveLength(1);
    expect(closedFilter.counts.closed).toBe(1);
  });
});

describe('durable join-intake rate limiting', () => {
  test('is atomic under concurrent attempts', async () => {
    const bucket = `join-intake:v1:test-${randomUUID()}`;
    const decisions = await Promise.all(
      Array.from({ length: 10 }, () =>
        consumeJoinRateLimit({
          db: pg.db,
          bucketKey: bucket,
          config: { max: 5, windowSeconds: 600 },
        }),
      ),
    );
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(5);
    const row = await pg.pool.query(
      'select count from join_intake_rate_limits where key = $1',
      [bucket],
    );
    expect(row.rows[0].count).toBe(10);
  });

  test('resets an expired window and returns controlled retry-after', async () => {
    const bucket = `join-intake:v1:expired-${randomUUID()}`;
    await pg.pool.query(
      "insert into join_intake_rate_limits (key, window_start, count) values ($1, now() - interval '11 minutes', 5)",
      [bucket],
    );
    const reset = await consumeJoinRateLimit({
      db: pg.db,
      bucketKey: bucket,
      config: { max: 5, windowSeconds: 600 },
    });
    expect(reset.allowed).toBe(true);
    const row = await pg.pool.query(
      'select count from join_intake_rate_limits where key = $1',
      [bucket],
    );
    expect(row.rows[0].count).toBe(1);

    const freshBucket = `join-intake:v1:limited-${randomUUID()}`;
    for (let index = 0; index < 5; index += 1) {
      const allowed = await consumeJoinRateLimit({
        db: pg.db,
        bucketKey: freshBucket,
        config: { max: 5, windowSeconds: 600 },
      });
      expect(allowed.allowed).toBe(true);
    }
    const limited = await consumeJoinRateLimit({
      db: pg.db,
      bucketKey: freshBucket,
      config: { max: 5, windowSeconds: 600 },
    });
    expect(limited.allowed).toBe(false);
    if (!limited.allowed) {
      expect(limited.retryAfterSeconds).toBeGreaterThan(0);
      expect(limited.retryAfterSeconds).toBeLessThanOrEqual(600);
    }
  });

  test('isolates valid identities and shares one controlled bucket for unresolved identities', async () => {
    const first = `join-intake:v1:identity-a-${randomUUID()}`;
    const second = `join-intake:v1:identity-b-${randomUUID()}`;
    for (let index = 0; index < 5; index += 1) {
      expect(
        (
          await consumeJoinRateLimit({
            db: pg.db,
            bucketKey: first,
            config: { max: 5, windowSeconds: 600 },
          })
        ).allowed,
      ).toBe(true);
    }
    expect(
      (
        await consumeJoinRateLimit({
          db: pg.db,
          bucketKey: first,
          config: { max: 5, windowSeconds: 600 },
        })
      ).allowed,
    ).toBe(false);
    expect(
      (
        await consumeJoinRateLimit({
          db: pg.db,
          bucketKey: second,
          config: { max: 5, windowSeconds: 600 },
        })
      ).allowed,
    ).toBe(true);
  });
});

function definedRevision(value: number | null): number {
  if (value === null) throw new Error('expected revision');
  return value;
}
