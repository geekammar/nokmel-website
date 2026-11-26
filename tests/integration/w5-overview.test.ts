import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import {
  applyMigrations,
  emptyDatabase,
  getDisposablePostgres,
} from './helpers';
import { loadOverviewMetrics } from '@/lib/overview/service';

/**
 * W5 business overview aggregates on disposable PostgreSQL.
 * Verifies Cairo period boundaries, all-time backlog independence, historical
 * plan identity and historical promotion context. Never hosted Neon.
 */

const pg = await getDisposablePostgres();
const now = new Date('2026-11-26T12:00:00.000Z');

const snapshot = (args: {
  planId: string;
  planName: string;
  promotionState: 'none' | 'active';
  promotionLabel?: string;
}) => ({
  version: 1,
  capturedAt: '2026-11-20T00:00:00.000Z',
  planId: args.planId,
  planSlug: args.planId,
  planName: args.planName,
  currency: 'EGP',
  publishedRevision: 2,
  promotionState: args.promotionState,
  effectiveOfferVersion: 'w41-0123456789abcdef',
  baseMonthlyPriceMinor: 19900,
  baseYearlyPriceMinor: 199000,
  effectiveMonthlyPriceMinor: args.promotionState === 'active' ? 15920 : 19900,
  effectiveYearlyPriceMinor: args.promotionState === 'active' ? 159200 : 199000,
  promotion:
    args.promotionState === 'active'
      ? {
          label: args.promotionLabel ?? 'عرض',
          discountType: 'percentage',
          target: 'both',
          percentageBps: 2000,
          fixedMonthlyMinor: null,
          fixedYearlyMinor: null,
          startsAt: '2026-11-20T00:00:00.000Z',
          endsAt: '2026-12-01T00:00:00.000Z',
          monthlySavedMinor: 3980,
          yearlySavedMinor: 39800,
          monthlySavedPercentBps: 2000,
          yearlySavedPercentBps: 2000,
        }
      : null,
});

beforeAll(async () => {
  await applyMigrations(pg);
});

beforeEach(async () => {
  await emptyDatabase(pg);
  await pg.pool.query(
    `insert into plans (id, slug, draft_name, draft_description, draft_currency, draft_cta_label, draft_revision)
     values
       ('plan-1', 'plan-1', 'الباقة الحالية', 'وصف', 'EGP', 'اطلب الانضمام', 1),
       ('plan-2', 'plan-2', 'باقة ثانية', 'وصف', 'EGP', 'اطلب الانضمام', 1)`,
  );
});

afterAll(async () => {
  await pg.stop();
});

async function insertRequest(args: {
  id: string;
  createdAt: string;
  status: 'new' | 'contacted' | 'closed';
  source: 'direct' | 'pricing' | 'join';
  planId?: string | null;
  planNameSnapshot?: string | null;
  offerSnapshot?: unknown;
  utmSource?: string | null;
}) {
  await pg.pool.query(
    `insert into join_requests (
       id, name, phone, plan_id, plan_name_snapshot, plan_currency_snapshot,
       offer_snapshot, source, utm_source, status, submission_token, revision,
       created_at, updated_at
     ) values ($1, $2, '+201000000000', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, 0, $11::timestamptz, $11::timestamptz)`,
    [
      args.id,
      `Synthetic ${args.id}`,
      args.planId ?? null,
      args.planNameSnapshot ?? null,
      args.planId ? 'EGP' : null,
      args.offerSnapshot === undefined ? null : JSON.stringify(args.offerSnapshot),
      args.source,
      args.utmSource ?? null,
      args.status,
      `token-${args.id}`,
      args.createdAt,
    ],
  );
}

async function seedCohort() {
  await insertRequest({
    id: 'inside-boundary-new',
    createdAt: '2026-11-19T23:00:00.000Z',
    status: 'new',
    source: 'pricing',
    planId: 'plan-1',
    planNameSnapshot: 'الباقة القديمة',
    offerSnapshot: snapshot({
      planId: 'plan-1',
      planName: 'الباقة القديمة',
      promotionState: 'none',
    }),
  });
  await insertRequest({
    id: 'before-range-new',
    createdAt: '2026-11-19T21:59:00.000Z',
    status: 'new',
    source: 'direct',
  });
  await insertRequest({
    id: 'contacted-no-active',
    createdAt: '2026-11-22T10:00:00.000Z',
    status: 'contacted',
    source: 'join',
    planId: 'plan-2',
    planNameSnapshot: 'باقة ثانية',
    offerSnapshot: snapshot({
      planId: 'plan-2',
      planName: 'باقة ثانية',
      promotionState: 'none',
    }),
  });
  await insertRequest({
    id: 'closed-no-plan',
    createdAt: '2026-11-24T10:00:00.000Z',
    status: 'closed',
    source: 'direct',
  });
  await insertRequest({
    id: 'legacy-plan',
    createdAt: '2026-11-25T10:00:00.000Z',
    status: 'new',
    source: 'direct',
    planId: 'plan-1',
    planNameSnapshot: 'اسم قديم محفوظ',
  });
  await insertRequest({
    id: 'active-promotion',
    createdAt: '2026-11-26T10:00:00.000Z',
    status: 'new',
    source: 'pricing',
    planId: 'plan-1',
    planNameSnapshot: 'الباقة الحالية',
    offerSnapshot: snapshot({
      planId: 'plan-1',
      planName: 'الباقة الحالية',
      promotionState: 'active',
      promotionLabel: 'عرض الانضمام',
    }),
    utmSource: 'google',
  });
}

describe('W5 overview aggregates', () => {
  test('7-day Cairo cohort, current backlog, historical plan and promotion context', async () => {
    await seedCohort();
    const result = await loadOverviewMetrics(7, { db: pg.db, now });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const metrics = result.metrics;

    expect(metrics.startDate).toBe('2026-11-20');
    expect(metrics.endDate).toBe('2026-11-26');
    expect(metrics.receivedInPeriod).toBe(5);
    expect(metrics.periodStatus).toEqual({ new: 3, contacted: 1, closed: 1 });
    expect(metrics.periodWithUtm).toBe(1);
    expect(metrics.periodNoPlan).toBe(1);

    // The older new request outside the selected period still needs attention.
    expect(metrics.currentNewBacklog).toBe(4);

    expect(metrics.daily).toEqual([
      { date: '2026-11-20', count: 1 },
      { date: '2026-11-21', count: 0 },
      { date: '2026-11-22', count: 1 },
      { date: '2026-11-23', count: 0 },
      { date: '2026-11-24', count: 1 },
      { date: '2026-11-25', count: 1 },
      { date: '2026-11-26', count: 1 },
    ]);

    expect(metrics.sources).toEqual([
      { source: 'direct', count: 2 },
      { source: 'pricing', count: 2 },
      { source: 'join', count: 1 },
    ]);

    expect(metrics.plans).toEqual(
      expect.arrayContaining([
        { planId: 'plan-1', planName: 'الباقة القديمة', count: 1 },
        { planId: 'plan-1', planName: 'اسم قديم محفوظ', count: 1 },
        { planId: 'plan-1', planName: 'الباقة الحالية', count: 1 },
        { planId: 'plan-2', planName: 'باقة ثانية', count: 1 },
        { planId: null, planName: null, count: 1 },
      ]),
    );
    expect(metrics.plans).toHaveLength(5);

    expect(metrics.promotions).toEqual({
      active: 1,
      noActive: 2,
      legacyUnknown: 1,
      unknown: 0,
      noPlan: 1,
    });

    expect(metrics.latest.map((request) => request.id)).toEqual([
      'active-promotion',
      'legacy-plan',
      'closed-no-plan',
      'contacted-no-active',
      'inside-boundary-new',
    ]);
    expect(metrics.latest[0]).toMatchObject({
      status: 'new',
      source: 'pricing',
      planName: 'الباقة الحالية',
    });
  });

  test('a wider period includes older rows while the current backlog stays all-time', async () => {
    await seedCohort();
    const result = await loadOverviewMetrics(30, { db: pg.db, now });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.metrics.receivedInPeriod).toBe(6);
    expect(result.metrics.periodStatus.new).toBe(4);
    expect(result.metrics.periodNoPlan).toBe(2);
    expect(result.metrics.currentNewBacklog).toBe(4);
    expect(result.metrics.dates).toHaveLength(30);
    expect(result.metrics.daily.reduce((sum, day) => sum + day.count, 0)).toBe(6);
  });

  test('period boundaries are inclusive at Cairo start and exclusive at next Cairo midnight', async () => {
    await insertRequest({
      id: 'exact-start',
      createdAt: '2026-11-19T22:00:00.000Z',
      status: 'new',
      source: 'direct',
    });
    await insertRequest({
      id: 'one-ms-before-start',
      createdAt: '2026-11-19T21:59:59.999Z',
      status: 'new',
      source: 'direct',
    });
    await insertRequest({
      id: 'last-instant',
      createdAt: '2026-11-26T21:59:59.999Z',
      status: 'new',
      source: 'direct',
    });
    await insertRequest({
      id: 'exact-end-exclusive',
      createdAt: '2026-11-26T22:00:00.000Z',
      status: 'new',
      source: 'direct',
    });

    const result = await loadOverviewMetrics(7, { db: pg.db, now });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.metrics.receivedInPeriod).toBe(2);
    expect(result.metrics.currentNewBacklog).toBe(4);
    expect(result.metrics.daily[0]).toEqual({ date: '2026-11-20', count: 1 });
    expect(result.metrics.daily[6]).toEqual({ date: '2026-11-26', count: 1 });
  });
});
