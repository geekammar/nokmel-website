import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { applyMigrations, emptyDatabase, getDisposablePostgres } from './helpers';
import {
  PlanConflictError,
  PlanDuplicateSlugError,
  PlanValidationError,
} from '@/lib/plans/errors';
import {
  createPlan,
  getOwnerPlan,
  getOwnerPlans,
  getPublicPlanBySlug,
  getPublicPlans,
  hidePlan,
  publishPlan,
  savePlanDraft,
} from '@/lib/plans/service';
import type { PlanFormValues } from '@/lib/plans/model';

const pg = await getDisposablePostgres();

function planValues(overrides: Partial<PlanFormValues> = {}): PlanFormValues {
  return {
    name: 'باقة البداية',
    description: 'باقة تعريفية لمرحلة الانضمام المبكر.',
    features: ['متابعة الطلبات', 'كتالوج المنتجات'],
    monthlyPrice: '199.00',
    yearlyPrice: '1990.00',
    currency: 'EGP',
    ctaLabel: 'اطلب الانضمام',
    featured: false,
    displayOrder: 10,
    promotion: null,
    ...overrides,
  };
}

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
});

afterAll(async () => {
  await pg.stop();
});

describe('plan lifecycle and public visibility', () => {
  test('creates unpublished plans that are absent from public reads', async () => {
    const plan = await createPlan(
      { slug: 'starter-plan', values: planValues() },
      { db: pg.db },
    );
    expect(plan.status).toBe('draft');
    expect(plan.revision).toBe(1);
    expect(plan.published).toBeNull();

    const publicResult = await getPublicPlans({ db: pg.db });
    expect(publicResult.status).toBe('ok');
    expect(publicResult.plans.map((item) => item.slug)).not.toContain('starter-plan');
    expect(await getPublicPlanBySlug('starter-plan', { db: pg.db })).toBeNull();

    const ownerResult = await getOwnerPlans({ db: pg.db });
    expect(ownerResult.status).toBe('ok');
    if (ownerResult.status !== 'ok') return;
    expect(ownerResult.plans.map((item) => item.slug)).toContain('starter-plan');
    expect(ownerResult.plans[0].draft.monthlyPriceMinor).toBe(19_900);
  });

  test('rejects duplicate slugs and invalid plan combinations', async () => {
    await expect(
      createPlan({ slug: 'starter-plan', values: planValues() }, { db: pg.db }),
    ).rejects.toBeInstanceOf(PlanDuplicateSlugError);
    await expect(
      createPlan(
        {
          slug: 'bad-price',
          values: planValues({ monthlyPrice: '', yearlyPrice: '1990' }),
        },
        { db: pg.db },
      ),
    ).rejects.toBeInstanceOf(PlanValidationError);
  });

  test('explicit publication exposes the saved draft with exact prices and order', async () => {
    const owner = await getOwnerPlans({ db: pg.db });
    if (owner.status !== 'ok') throw new Error('owner load failed');
    const draft = owner.plans.find((plan) => plan.slug === 'starter-plan');
    if (!draft) throw new Error('starter plan missing');

    const published = await publishPlan(
      { id: draft.id, expectedRevision: draft.revision },
      { db: pg.db },
    );
    expect(published.status).toBe('published');
    expect(published.publishedRevision).toBe(2);
    expect(published.published?.monthlyPriceMinor).toBe(19_900);

    const publicResult = await getPublicPlans({ db: pg.db });
    expect(publicResult.plans).toHaveLength(1);
    const publicPlan = publicResult.plans[0];
    expect(publicPlan).toMatchObject({
      slug: 'starter-plan',
      name: 'باقة البداية',
      monthlyPriceMinor: 19_900,
      yearlyPriceMinor: 199_000,
      currency: 'EGP',
      displayOrder: 10,
      publishedRevision: 2,
    });
  });

  test('editing a live plan does not change the public offer until publication', async () => {
    const ownerList = await getOwnerPlans({ db: pg.db });
    if (ownerList.status !== 'ok') throw new Error('owner load failed');
    const listed = ownerList.plans.find((plan) => plan.slug === 'starter-plan');
    if (!listed) throw new Error('starter plan missing');
    const owner = await getOwnerPlan(listed.id, { db: pg.db });
    if (owner.status !== 'ok') throw new Error('owner load failed');

    const edited = await savePlanDraft(
      {
        id: owner.plan.id,
        expectedRevision: owner.plan.revision,
        values: planValues({
          name: 'باقة البداية المحدثة',
          monthlyPrice: '249.00',
          features: ['ميزة محدثة'],
        }),
      },
      { db: pg.db },
    );
    expect(edited.revision).toBe(3);

    const publicBeforePublish = await getPublicPlans({ db: pg.db });
    expect(publicBeforePublish.plans[0].name).toBe('باقة البداية');
    expect(publicBeforePublish.plans[0].monthlyPriceMinor).toBe(19_900);

    await expect(
      savePlanDraft(
        {
          id: owner.plan.id,
          expectedRevision: owner.plan.revision,
          values: planValues(),
        },
        { db: pg.db },
      ),
    ).rejects.toBeInstanceOf(PlanConflictError);

    const republished = await publishPlan(
      { id: edited.id, expectedRevision: edited.revision },
      { db: pg.db },
    );
    expect(republished.publishedRevision).toBe(4);
    const publicAfter = await getPublicPlans({ db: pg.db });
    expect(publicAfter.plans[0]).toMatchObject({
      name: 'باقة البداية المحدثة',
      monthlyPriceMinor: 24_900,
      features: ['ميزة محدثة'],
      publishedRevision: 4,
    });
  });

  test('hide removes a plan from public listing and new selection while retaining owner data', async () => {
    const plan = await createPlan(
      {
        slug: 'secondary-plan',
        values: planValues({
          name: 'باقة ثانوية',
          displayOrder: 20,
          monthlyPrice: '',
          yearlyPrice: '',
        }),
      },
      { db: pg.db },
    );
    const published = await publishPlan(
      { id: plan.id, expectedRevision: plan.revision },
      { db: pg.db },
    );
    expect((await getPublicPlans({ db: pg.db })).plans).toHaveLength(2);

    const hidden = await hidePlan(
      { id: published.id, expectedRevision: published.revision },
      { db: pg.db },
    );
    expect(hidden.status).toBe('hidden');
    const publicAfter = await getPublicPlans({ db: pg.db });
    expect(publicAfter.plans.map((item) => item.slug)).toEqual(['starter-plan']);
    expect(await getPublicPlanBySlug('secondary-plan', { db: pg.db })).toBeNull();

    const ownerAfter = await getOwnerPlan(plan.id, { db: pg.db });
    expect(ownerAfter.status).toBe('ok');
    if (ownerAfter.status !== 'ok') return;
    expect(ownerAfter.plan.status).toBe('hidden');
    expect(ownerAfter.plan.published?.name).toBe('باقة ثانوية');
    expect(ownerAfter.plan.draft.monthlyPriceMinor).toBeNull();
  });

  test('public plan order follows published display order', async () => {
    const later = await createPlan(
      {
        slug: 'order-later',
        values: planValues({ name: 'باقة لاحقة', displayOrder: 20 }),
      },
      { db: pg.db },
    );
    const earlier = await createPlan(
      {
        slug: 'order-earlier',
        values: planValues({ name: 'باقة أبكر', displayOrder: 5 }),
      },
      { db: pg.db },
    );
    await publishPlan({ id: later.id, expectedRevision: later.revision }, { db: pg.db });
    await publishPlan(
      { id: earlier.id, expectedRevision: earlier.revision },
      { db: pg.db },
    );
    const publicResult = await getPublicPlans({ db: pg.db });
    expect(publicResult.status).toBe('ok');
    const ordered = publicResult.plans
      .filter((plan) => plan.slug === 'order-later' || plan.slug === 'order-earlier')
      .map((plan) => plan.slug);
    expect(ordered).toEqual(['order-earlier', 'order-later']);
  });

  test('null and zero prices remain distinct through persistence', async () => {
    const nullPlan = await createPlan(
      {
        slug: 'price-later',
        values: planValues({ name: 'سعر لاحق', monthlyPrice: '', yearlyPrice: '' }),
      },
      { db: pg.db },
    );
    const zeroPlan = await createPlan(
      { slug: 'zero-price', values: planValues({ name: 'سعر صفري', monthlyPrice: '0' }) },
      { db: pg.db },
    );
    expect(nullPlan.draft.monthlyPriceMinor).toBeNull();
    expect(zeroPlan.draft.monthlyPriceMinor).toBe(0);
    const reloadedNull = await getOwnerPlan(nullPlan.id, { db: pg.db });
    const reloadedZero = await getOwnerPlan(zeroPlan.id, { db: pg.db });
    if (reloadedNull.status !== 'ok' || reloadedZero.status !== 'ok') {
      throw new Error('reload failed');
    }
    expect(reloadedNull.plan.draft.monthlyPriceMinor).toBeNull();
    expect(reloadedZero.plan.draft.monthlyPriceMinor).toBe(0);
  });

  test('public reads fail safe (empty list) when storage is unavailable', async () => {
    const failingDb = {
      select: () => {
        throw new Error('storage offline');
      },
    } as unknown as typeof pg.db;
    const result = await getPublicPlans({ db: failingDb });
    expect(result.plans).toEqual([]);
    expect(result.status).toBe('unavailable');
    const owner = await getOwnerPlans({ db: failingDb });
    expect(owner.status).toBe('unavailable');
  });
});
