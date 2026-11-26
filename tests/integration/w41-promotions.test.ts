import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { applyMigrations, emptyDatabase, getDisposablePostgres } from './helpers';
import { JoinPlanChangedError } from '@/lib/join/errors';
import { createJoinRequest, getJoinRequest } from '@/lib/join/service';
import type { JoinSubmission } from '@/lib/join/validation';
import { parseJoinSubmission } from '@/lib/join/validation';
import type { PlanFormValues } from '@/lib/plans/model';
import type { PromotionFormValues } from '@/lib/plans/promotion';
import {
  createPlan,
  getOwnerPlan,
  getPublicPlanBySlug,
  getPublicPlans,
  hidePlan,
  publishPlan,
  savePlanDraft,
} from '@/lib/plans/service';

const pg = await getDisposablePostgres();

const AS_OF_BEFORE = new Date('2026-05-01T00:00:00.000Z');
const AS_OF_ACTIVE = new Date('2026-06-15T12:00:00.000Z');
const AS_OF_AFTER = new Date('2026-08-01T00:00:00.000Z');

function promotionForm(
  overrides: Partial<PromotionFormValues> = {},
): PromotionFormValues {
  return {
    enabled: true,
    label: 'عرض الصيف',
    discountType: 'percentage',
    target: 'monthly',
    percentage: '20',
    fixedMonthly: '',
    fixedYearly: '',
    startsDate: '2026-06-01',
    startsTime: '00:00',
    endsDate: '2026-07-01',
    endsTime: '00:00',
    ...overrides,
  };
}

function planValues(
  promotion: PromotionFormValues | null = promotionForm(),
  overrides: Partial<PlanFormValues> = {},
): PlanFormValues {
  return {
    name: 'باقة العرض',
    description: 'باقة تعريفية لاختبار العرض المؤقت.',
    features: ['متابعة الطلبات'],
    monthlyPrice: '199.00',
    yearlyPrice: '1990.00',
    currency: 'EGP',
    ctaLabel: 'اطلب الانضمام',
    featured: false,
    displayOrder: 1,
    promotion,
    ...overrides,
  };
}

async function createPublished(
  slug: string,
  values: PlanFormValues,
) {
  const created = await createPlan({ slug, values }, { db: pg.db });
  return publishPlan(
    { id: created.id, expectedRevision: created.revision },
    { db: pg.db },
  );
}

async function submissionFor(
  slug: string,
  asOf: Date,
  overrides: Record<string, unknown> = {},
): Promise<JoinSubmission> {
  const plan = await getPublicPlanBySlug(slug, { db: pg.db, asOf });
  if (!plan) throw new Error(`public plan ${slug} missing`);
  const parsed = parseJoinSubmission({
    name: 'تاجر عرض',
    phone: '+201001234567',
    source: 'pricing',
    planSlug: slug,
    offerVersion: plan.offer.version,
    submissionToken: `w41-token-${randomUUID()}`,
    ...overrides,
  });
  if (!parsed.ok) throw new Error(`invalid submission ${JSON.stringify(parsed.errors)}`);
  return parsed.submission;
}

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
});

beforeEach(async () => {
  await pg.pool.query('delete from join_requests');
  await pg.pool.query('delete from plans');
  await pg.pool.query('delete from join_intake_rate_limits');
});

afterAll(async () => {
  await pg.stop();
});

describe('draft and published promotion lifecycle', () => {
  test('unpublished draft promotions never reach public plan reads', async () => {
    const slug = `draft-promo-${randomUUID().slice(0, 8)}`;
    const created = await createPlan(
      { slug, values: planValues() },
      { db: pg.db },
    );
    expect(created.draft.promotion?.label).toBe('عرض الصيف');
    expect(created.published).toBeNull();
    const publicBefore = await getPublicPlans({ db: pg.db, asOf: AS_OF_ACTIVE });
    expect(publicBefore.plans.find((plan) => plan.slug === slug)).toBeUndefined();
    const owner = await getOwnerPlan(created.id, { db: pg.db });
    if (owner.status !== 'ok') throw new Error('owner load failed');
    expect(owner.plan.published).toBeNull();
    expect(owner.plan.draft.promotion?.percentageBps).toBe(2000);
  });

  test('a saved draft promotion on a live plan is not public until publication', async () => {
    const slug = `live-draft-${randomUUID().slice(0, 8)}`;
    const published = await createPublished(slug, planValues(null));

    const before = await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_ACTIVE });
    expect(before?.publishedPromotion).toBeNull();
    expect(before?.offer.monthly.discounted).toBe(false);

    await savePlanDraft(
      {
        id: published.id,
        expectedRevision: published.revision,
        values: planValues(promotionForm()),
      },
      { db: pg.db },
    );
    const afterDraft = await getPublicPlanBySlug(slug, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(afterDraft?.publishedPromotion).toBeNull();
    expect(afterDraft?.offer.monthly.discounted).toBe(false);
    expect(afterDraft?.offer.monthly.effectiveMinor).toBe(19_900);
  });

  test('explicit publication exposes a scheduled promotion only when time activates it', async () => {
    const slug = `scheduled-promo-${randomUUID().slice(0, 8)}`;
    await createPublished(slug, planValues());

    const before = await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_BEFORE });
    expect(before?.offer.state).toBe('scheduled');
    expect(before?.offer.monthly.discounted).toBe(false);
    expect(before?.offer.monthly.effectiveMinor).toBe(19_900);

    const active = await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_ACTIVE });
    expect(active?.offer.state).toBe('active');
    expect(active?.offer.monthly.baseMinor).toBe(19_900);
    expect(active?.offer.monthly.effectiveMinor).toBe(15_920);
    expect(active?.offer.monthly.savedMinor).toBe(3_980);
    expect(active?.offer.yearly.discounted).toBe(false);
    expect(active?.offer.label).toBe('عرض الصيف');

    const after = await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_AFTER });
    expect(after?.offer.state).toBe('expired');
    expect(after?.offer.monthly.effectiveMinor).toBe(19_900);
  });

  test('monthly-only, yearly-only and both targets remain independent', async () => {
    const monthlySlug = `monthly-${randomUUID().slice(0, 8)}`;
    const yearlySlug = `yearly-${randomUUID().slice(0, 8)}`;
    const bothSlug = `both-${randomUUID().slice(0, 8)}`;

    await createPublished(
      monthlySlug,
      planValues(promotionForm({ target: 'monthly' })),
    );
    await createPublished(
      yearlySlug,
      planValues(
        promotionForm({
          discountType: 'fixed',
          target: 'yearly',
          percentage: '',
          fixedYearly: '200.00',
        }),
      ),
    );
    await createPublished(
      bothSlug,
      planValues(
        promotionForm({
          discountType: 'fixed',
          target: 'both',
          percentage: '',
          fixedMonthly: '50.00',
          fixedYearly: '200.00',
        }),
      ),
    );

    const monthly = await getPublicPlanBySlug(monthlySlug, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(monthly?.offer.monthly.discounted).toBe(true);
    expect(monthly?.offer.yearly.discounted).toBe(false);
    expect(monthly?.offer.yearly.effectiveMinor).toBe(199_000);

    const yearly = await getPublicPlanBySlug(yearlySlug, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(yearly?.offer.monthly.discounted).toBe(false);
    expect(yearly?.offer.yearly.discounted).toBe(true);
    expect(yearly?.offer.yearly.effectiveMinor).toBe(179_000);

    const both = await getPublicPlanBySlug(bothSlug, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(both?.offer.monthly.effectiveMinor).toBe(14_900);
    expect(both?.offer.yearly.effectiveMinor).toBe(179_000);
  });

  test('stores the maximum supported integer amount with a zero effective price', async () => {
    const slug = `max-price-${randomUUID().slice(0, 8)}`;
    await createPublished(
      slug,
      planValues(
        promotionForm({ target: 'monthly', percentage: '100' }),
        { monthlyPrice: '21474836.47', yearlyPrice: '' },
      ),
    );
    const plan = await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_ACTIVE });
    expect(plan?.offer.monthly.baseMinor).toBe(2_147_483_647);
    expect(plan?.offer.monthly.effectiveMinor).toBe(0);
    const stored = await pg.pool.query(
      'select published_monthly_price_minor from plans where slug = $1',
      [slug],
    );
    expect(stored.rows[0].published_monthly_price_minor).toBe(2_147_483_647);
  });

  test('manual disable through draft/publication restores regular pricing', async () => {
    const slug = `disable-${randomUUID().slice(0, 8)}`;
    const published = await createPublished(slug, planValues());
    const active = await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_ACTIVE });
    expect(active?.offer.monthly.discounted).toBe(true);

    const edited = await savePlanDraft(
      {
        id: published.id,
        expectedRevision: published.revision,
        values: planValues(promotionForm({ enabled: false })),
      },
      { db: pg.db },
    );
    const publicBeforePublish = await getPublicPlanBySlug(slug, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(publicBeforePublish?.offer.monthly.discounted).toBe(true);

    await publishPlan(
      { id: edited.id, expectedRevision: edited.revision },
      { db: pg.db },
    );
    const disabled = await getPublicPlanBySlug(slug, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(disabled?.offer.state).toBe('disabled');
    expect(disabled?.offer.monthly.discounted).toBe(false);
    expect(disabled?.offer.monthly.effectiveMinor).toBe(19_900);
  });

  test('removing a promotion through publication restores regular pricing', async () => {
    const slug = `remove-${randomUUID().slice(0, 8)}`;
    const published = await createPublished(slug, planValues());
    const edited = await savePlanDraft(
      {
        id: published.id,
        expectedRevision: published.revision,
        values: planValues(null),
      },
      { db: pg.db },
    );
    await publishPlan(
      { id: edited.id, expectedRevision: edited.revision },
      { db: pg.db },
    );
    const publicPlan = await getPublicPlanBySlug(slug, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(publicPlan?.publishedPromotion).toBeNull();
    expect(publicPlan?.offer.state).toBe('none');
    expect(publicPlan?.offer.monthly.effectiveMinor).toBe(19_900);
  });

  test('changing base prices revalidates the promotion and rejects invalid combinations', async () => {
    const published = await createPublished(
      `revalidate-${randomUUID().slice(0, 8)}`,
      planValues(
        promotionForm({
          discountType: 'fixed',
          target: 'monthly',
          percentage: '',
          fixedMonthly: '150.00',
        }),
      ),
    );
    await expect(
      savePlanDraft(
        {
          id: published.id,
          expectedRevision: published.revision,
          values: planValues(
            promotionForm({
              discountType: 'fixed',
              target: 'monthly',
              percentage: '',
              fixedMonthly: '150.00',
            }),
            { monthlyPrice: '100.00' },
          ),
        },
        { db: pg.db },
      ),
    ).rejects.toMatchObject({
      fieldErrors: { 'promotion.fixedMonthly': expect.any(String) },
    });
  });

  test('hiding removes the plan; republishing an expired promotion does not extend it', async () => {
    const slug = `hidden-expired-${randomUUID().slice(0, 8)}`;
    const published = await createPublished(slug, planValues());
    const hidden = await hidePlan(
      { id: published.id, expectedRevision: published.revision },
      { db: pg.db },
    );
    expect(
      await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_ACTIVE }),
    ).toBeNull();

    const republished = await publishPlan(
      { id: hidden.id, expectedRevision: hidden.revision },
      { db: pg.db },
    );
    expect(republished.status).toBe('published');
    const after = await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_AFTER });
    expect(after?.offer.state).toBe('expired');
    expect(after?.offer.monthly.effectiveMinor).toBe(19_900);
  });

  test('stale plan publication revisions remain rejected', async () => {
    const created = await createPlan(
      { slug: `stale-${randomUUID().slice(0, 8)}`, values: planValues() },
      { db: pg.db },
    );
    await expect(
      publishPlan(
        { id: created.id, expectedRevision: created.revision + 1 },
        { db: pg.db },
      ),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});

describe('time-bound effective-offer validation', () => {
  test('stale version before activation is rejected with the current discounted offer', async () => {
    const slug = `stale-start-${randomUUID().slice(0, 8)}`;
    await createPublished(slug, planValues());
    const before = await submissionFor(slug, AS_OF_BEFORE);
    await expect(
      createJoinRequest(
        {
          ...before,
          submissionToken: `stale-start-${randomUUID()}`,
        },
        { db: pg.db, asOf: AS_OF_ACTIVE },
      ),
    ).rejects.toMatchObject({
      name: 'JoinPlanChangedError',
      currentPlan: {
        offer: {
          state: 'active',
          monthly: { effectiveMinor: 15_920, discounted: true },
        },
      },
    });
    const count = await pg.pool.query('select count(*)::int as count from join_requests');
    expect(count.rows[0].count).toBe(0);
  });

  test('stale discounted version after expiry is rejected with the regular offer', async () => {
    const slug = `stale-end-${randomUUID().slice(0, 8)}`;
    await createPublished(slug, planValues());
    const active = await submissionFor(slug, AS_OF_ACTIVE);
    await expect(
      createJoinRequest(
        { ...active, submissionToken: `stale-end-${randomUUID()}` },
        { db: pg.db, asOf: AS_OF_AFTER },
      ),
    ).rejects.toMatchObject({
      name: 'JoinPlanChangedError',
      currentPlan: {
        offer: {
          state: 'expired',
          monthly: { effectiveMinor: 19_900, discounted: false },
        },
      },
    });
  });

  test('confirming the current offer persists a full immutable snapshot', async () => {
    const slug = `snapshot-${randomUUID().slice(0, 8)}`;
    const published = await createPublished(
      slug,
      planValues(
        promotionForm({
          target: 'both',
          discountType: 'fixed',
          percentage: '',
          fixedMonthly: '50.00',
          fixedYearly: '200.00',
        }),
      ),
    );
    const current = await submissionFor(slug, AS_OF_ACTIVE);
    const created = await createJoinRequest(current, { db: pg.db, asOf: AS_OF_ACTIVE });
    if (!created.created) throw new Error('create failed');

    const detail = await getJoinRequest(created.id, { db: pg.db });
    if (detail.status !== 'ok') throw new Error('detail failed');
    const snapshot = detail.request.offerSnapshot;
    expect(snapshot).not.toBeNull();
    if (!snapshot) return;
    expect(snapshot.planName).toBe('باقة العرض');
    expect(snapshot.currency).toBe('EGP');
    expect(snapshot.baseMonthlyPriceMinor).toBe(19_900);
    expect(snapshot.effectiveMonthlyPriceMinor).toBe(14_900);
    expect(snapshot.baseYearlyPriceMinor).toBe(199_000);
    expect(snapshot.effectiveYearlyPriceMinor).toBe(179_000);
    expect(snapshot.promotion).toMatchObject({
      label: 'عرض الصيف',
      discountType: 'fixed',
      target: 'both',
      fixedMonthlyMinor: 5_000,
      fixedYearlyMinor: 20_000,
      monthlySavedMinor: 5_000,
      yearlySavedMinor: 20_000,
    });
    expect(snapshot.promotionState).toBe('active');
    expect(snapshot.effectiveOfferVersion).toBe(current.offerVersion);
    expect(detail.request.planPriceMinorSnapshot).toBe(14_900);
    expect(detail.request.planPricePeriodSnapshot).toBe('monthly');

    const edited = await savePlanDraft(
      {
        id: published.id,
        expectedRevision: published.revision,
        values: planValues(null, { monthlyPrice: '999.00' }),
      },
      { db: pg.db },
    );
    await publishPlan(
      { id: edited.id, expectedRevision: edited.revision },
      { db: pg.db },
    );
    const after = await getJoinRequest(created.id, { db: pg.db });
    if (after.status !== 'ok') throw new Error('detail failed');
    expect(after.request.offerSnapshot).toEqual(snapshot);
  });

  test('same-token replay after expiry returns success without a new row or rewritten history', async () => {
    const slug = `replay-expiry-${randomUUID().slice(0, 8)}`;
    await createPublished(slug, planValues());
    const token = `replay-expiry-${randomUUID()}`;
    const submission = await submissionFor(slug, AS_OF_ACTIVE, {
      submissionToken: token,
    });
    const first = await createJoinRequest(submission, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(first.created).toBe(true);
    const original = await pg.pool.query(
      'select offer_snapshot, plan_price_minor_snapshot from join_requests where submission_token = $1',
      [token],
    );

    const replay = await createJoinRequest(submission, {
      db: pg.db,
      asOf: AS_OF_AFTER,
    });
    expect(replay).toEqual({ created: false, duplicate: true });
    const after = await pg.pool.query(
      'select offer_snapshot, plan_price_minor_snapshot from join_requests where submission_token = $1',
      [token],
    );
    expect(after.rows[0]).toEqual(original.rows[0]);
    const count = await pg.pool.query('select count(*)::int as count from join_requests');
    expect(count.rows[0].count).toBe(1);
  });

  test('same-token replay after manual cancellation preserves the original snapshot', async () => {
    const slug = `replay-cancel-${randomUUID().slice(0, 8)}`;
    const published = await createPublished(slug, planValues());
    const token = `replay-cancel-${randomUUID()}`;
    const submission = await submissionFor(slug, AS_OF_ACTIVE, {
      submissionToken: token,
    });
    await createJoinRequest(submission, { db: pg.db, asOf: AS_OF_ACTIVE });
    const original = await pg.pool.query(
      'select offer_snapshot, plan_price_minor_snapshot from join_requests where submission_token = $1',
      [token],
    );

    const edited = await savePlanDraft(
      {
        id: published.id,
        expectedRevision: published.revision,
        values: planValues(promotionForm({ enabled: false })),
      },
      { db: pg.db },
    );
    await publishPlan(
      { id: edited.id, expectedRevision: edited.revision },
      { db: pg.db },
    );

    const replay = await createJoinRequest(submission, {
      db: pg.db,
      asOf: AS_OF_ACTIVE,
    });
    expect(replay).toEqual({ created: false, duplicate: true });
    const after = await pg.pool.query(
      'select offer_snapshot, plan_price_minor_snapshot from join_requests where submission_token = $1',
      [token],
    );
    expect(after.rows[0]).toEqual(original.rows[0]);
  });
});

describe('historical compatibility and concurrency', () => {
  test('legacy W4 single-price snapshots remain readable without invented fields', async () => {
    const planId = `legacy-plan-${randomUUID().slice(0, 8)}`;
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
         $1, $1, 'باقة قديمة', 'وصف', '[]'::jsonb,
         14900, 'EGP', 'اطلب الانضمام', false, 1,
         'باقة قديمة', 'وصف', '[]'::jsonb,
         14900, 'EGP', 'اطلب الانضمام', false, 1,
         'published', 2, 2, now()
       )`,
      [planId],
    );
    await pg.pool.query(
      `insert into join_requests (
         id, name, phone, plan_id, plan_name_snapshot, plan_price_minor_snapshot,
         plan_price_period_snapshot, plan_currency_snapshot, source, status,
         submission_token, revision
       ) values (
         $1, 'تاجر قديم', '+201000000001', $2, 'باقة قديمة', 14900,
         'monthly', 'EGP', 'pricing', 'new', $3, 0
       )`,
      [`legacy-request-${randomUUID()}`, planId, `legacy-token-${randomUUID()}`],
    );
    const row = await pg.pool.query(
      "select id from join_requests where phone = '+201000000001'",
    );
    const detail = await getJoinRequest(row.rows[0].id, { db: pg.db });
    if (detail.status !== 'ok') throw new Error('detail failed');
    expect(detail.request.offerSnapshot).toBeNull();
    expect(detail.request.offerSnapshotInvalid).toBe(false);
    expect(detail.request.planNameSnapshot).toBe('باقة قديمة');
    expect(detail.request.planPriceMinorSnapshot).toBe(14_900);
    expect(detail.request.planPricePeriodSnapshot).toBe('monthly');
    expect(detail.request.planCurrencySnapshot).toBe('EGP');
  });

  test('no-plan requests keep source attribution and no fabricated snapshot', async () => {
    const parsed = parseJoinSubmission({
      name: 'تاجر مباشر',
      phone: '+201001111111',
      source: 'pricing',
      submissionToken: `no-plan-${randomUUID()}`,
    });
    if (!parsed.ok) throw new Error('invalid submission');
    const created = await createJoinRequest(parsed.submission, { db: pg.db });
    if (!created.created) throw new Error('create failed');
    const detail = await getJoinRequest(created.id, { db: pg.db });
    if (detail.status !== 'ok') throw new Error('detail failed');
    expect(detail.request.planId).toBeNull();
    expect(detail.request.planNameSnapshot).toBeNull();
    expect(detail.request.offerSnapshot).toBeNull();
    expect(detail.request.source).toBe('pricing');
  });

  test('a concurrent publication waits for the join read and cannot mix snapshot values', async () => {
    const slug = `concurrent-${randomUUID().slice(0, 8)}`;
    const published = await createPublished(slug, planValues());
    const oldPlan = await getPublicPlanBySlug(slug, { db: pg.db, asOf: AS_OF_ACTIVE });
    if (!oldPlan) throw new Error('plan missing');
    const oldSubmission = await submissionFor(slug, AS_OF_ACTIVE, {
      submissionToken: `concurrent-${randomUUID()}`,
    });

    const blocker = await pg.pool.connect();
    let pending: Promise<unknown> | null = null;
    let pendingResult: Promise<unknown> | null = null;
    try {
      await blocker.query('begin');
      await blocker.query(
        "update plans set published_name = 'عرض متزامن', published_monthly_price_minor = 24900, published_revision = published_revision + 1 where id = $1",
        [published.id],
      );
      pending = createJoinRequest(oldSubmission, {
        db: pg.db,
        asOf: AS_OF_ACTIVE,
      });
      pendingResult = pending.then(
        (value) => value,
        (error: unknown) => error,
      );
      // The join transaction must wait for the publication row lock before it
      // can read a consistent published row.
      let waiting = false;
      for (let attempt = 0; attempt < 200 && !waiting; attempt += 1) {
        const result = await pg.pool.query(
          `select count(*)::int as count
             from pg_stat_activity
            where datname = current_database()
              and state = 'active'
              and wait_event_type = 'Lock'
              and query ilike '%plans%'`,
        );
        waiting = result.rows[0].count > 0;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await blocker.query('commit');
      if (!pendingResult) throw new Error('missing pending result');
      expect(await pendingResult).toBeInstanceOf(JoinPlanChangedError);
      pending = null;
    } finally {
      if (pending) await pending.catch(() => undefined);
      await blocker.query('rollback').catch(() => undefined);
      blocker.release();
    }
    const count = await pg.pool.query('select count(*)::int as count from join_requests');
    expect(count.rows[0].count).toBe(0);
  });
});
