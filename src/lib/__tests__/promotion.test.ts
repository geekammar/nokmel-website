import { describe, expect, it } from 'vitest';
import {
  buildOfferSnapshot,
  parseOfferSnapshot,
} from '@/lib/join/snapshot';
import { formatPriceMinor, type PublicPlan } from '@/lib/plans/model';
import {
  MAX_PRICE_MINOR,
  PROMOTION_TIMEZONE_LABEL,
  cairoLocalDateTimeToInstant,
  formatCairoDateTime,
  formatSavedPercent,
  parsePercentageInput,
  percentageDiscountMinor,
  resolveOffer,
  validatePromotionAgainstPrices,
  type PromotionConfig,
} from '@/lib/plans/promotion';

function promotion(overrides: Partial<PromotionConfig> = {}): PromotionConfig {
  return {
    enabled: true,
    label: 'عرض الانضمام المبكر',
    discountType: 'percentage',
    target: 'monthly',
    percentageBps: 2000,
    fixedMonthlyMinor: null,
    fixedYearlyMinor: null,
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

function planInput(
  promotionValue: PromotionConfig | null,
  overrides: Partial<{
    monthlyPriceMinor: number | null;
    yearlyPriceMinor: number | null;
    publishedRevision: number;
    slug: string;
  }> = {},
) {
  return {
    slug: 'starter-plan',
    publishedRevision: 2,
    currency: 'EGP',
    monthlyPriceMinor: 10_000,
    yearlyPriceMinor: 100_000,
    promotion: promotionValue,
    ...overrides,
  };
}

const AS_OF_ACTIVE = new Date('2026-01-15T12:00:00.000Z');

describe('promotion percentage and fixed arithmetic', () => {
  it('applies an exact percentage to the monthly price only', () => {
    const offer = resolveOffer(planInput(promotion()), AS_OF_ACTIVE);
    expect(offer.state).toBe('active');
    expect(offer.monthly).toEqual({
      baseMinor: 10_000,
      effectiveMinor: 8_000,
      savedMinor: 2_000,
      savedPercentBps: 2000,
      discounted: true,
    });
    expect(offer.yearly).toEqual({
      baseMinor: 100_000,
      effectiveMinor: 100_000,
      savedMinor: null,
      savedPercentBps: null,
      discounted: false,
    });
    expect(formatPriceMinor(offer.monthly.effectiveMinor, 'EGP')).toBe('80.00 EGP');
    expect(formatPriceMinor(offer.monthly.savedMinor, 'EGP')).toBe('20.00 EGP');
    expect(formatSavedPercent(offer.monthly.savedPercentBps)).toBe('20%');
  });

  it('applies a fixed yearly amount only to the yearly price', () => {
    const offer = resolveOffer(
      planInput(
        promotion({
          discountType: 'fixed',
          target: 'yearly',
          percentageBps: null,
          fixedYearlyMinor: 25_000,
        }),
      ),
      AS_OF_ACTIVE,
    );
    expect(offer.monthly.discounted).toBe(false);
    expect(offer.monthly.effectiveMinor).toBe(10_000);
    expect(offer.yearly.effectiveMinor).toBe(75_000);
    expect(offer.yearly.savedMinor).toBe(25_000);
  });

  it('supports both periods with different fixed amounts', () => {
    const offer = resolveOffer(
      planInput(
        promotion({
          discountType: 'fixed',
          target: 'both',
          percentageBps: null,
          fixedMonthlyMinor: 2_500,
          fixedYearlyMinor: 20_000,
        }),
      ),
      AS_OF_ACTIVE,
    );
    expect(offer.monthly.effectiveMinor).toBe(7_500);
    expect(offer.yearly.effectiveMinor).toBe(80_000);
    expect(offer.monthly.savedPercentBps).toBe(2500);
    expect(offer.yearly.savedPercentBps).toBe(2000);
  });

  it('applies one percentage to both periods without annualizing anything', () => {
    const offer = resolveOffer(
      planInput(promotion({ target: 'both', percentageBps: 1250 })),
      AS_OF_ACTIVE,
    );
    expect(offer.monthly.effectiveMinor).toBe(8_750);
    expect(offer.yearly.effectiveMinor).toBe(87_500);
    expect(offer.monthly.savedPercentBps).toBe(1250);
    expect(offer.yearly.savedPercentBps).toBe(1250);
  });

  it('rounds half-up to the exact minor unit and never advertises an overstated percentage', () => {
    expect(percentageDiscountMinor(150, 333)).toBe(5);
    expect(percentageDiscountMinor(101, 333)).toBe(3);
    const offer = resolveOffer(
      planInput(promotion({ percentageBps: 333 }), {
        monthlyPriceMinor: 101,
        yearlyPriceMinor: 10_100,
      }),
      AS_OF_ACTIVE,
    );
    // 3.3633 minor units round to 3 (not 4), so the floor display is truthful.
    expect(offer.monthly.savedMinor).toBe(3);
    expect(offer.monthly.effectiveMinor).toBe(98);
    expect(offer.monthly.savedPercentBps).toBe(297);
    expect(formatSavedPercent(297)).toBe('2.97%');
  });

  it('supports three-decimal currencies without assuming two decimals', () => {
    const offer = resolveOffer(
      {
        ...planInput(promotion({ percentageBps: 1500 }), {
          monthlyPriceMinor: 1_250,
          yearlyPriceMinor: 12_000,
        }),
        currency: 'KWD',
      },
      AS_OF_ACTIVE,
    );
    expect(offer.monthly.savedMinor).toBe(188);
    expect(offer.monthly.effectiveMinor).toBe(1_062);
    expect(formatPriceMinor(offer.monthly.effectiveMinor, 'KWD')).toBe('1.062 KWD');
    expect(formatPriceMinor(offer.monthly.savedMinor, 'KWD')).toBe('0.188 KWD');
  });

  it('handles the maximum PostgreSQL integer without overflow', () => {
    expect(MAX_PRICE_MINOR).toBe(2_147_483_647);
    expect(percentageDiscountMinor(MAX_PRICE_MINOR, 10_000)).toBe(MAX_PRICE_MINOR);
    const offer = resolveOffer(
      planInput(promotion({ percentageBps: 10_000 }), {
        monthlyPriceMinor: MAX_PRICE_MINOR,
        yearlyPriceMinor: MAX_PRICE_MINOR,
      }),
      AS_OF_ACTIVE,
    );
    expect(offer.monthly.effectiveMinor).toBe(0);
    expect(offer.monthly.savedMinor).toBe(MAX_PRICE_MINOR);
    expect(offer.monthly.savedPercentBps).toBe(10_000);
  });

  it('never treats an unannounced price as zero and rejects discounts on zero/null bases', () => {
    const nullBases = validatePromotionAgainstPrices(promotion(), {
      monthlyPriceMinor: null,
      yearlyPriceMinor: 100_000,
    });
    expect(nullBases.target).toBeTruthy();

    const zeroBases = validatePromotionAgainstPrices(promotion(), {
      monthlyPriceMinor: 0,
      yearlyPriceMinor: 100_000,
    });
    expect(zeroBases.target).toBeTruthy();

    const zeroOffer = resolveOffer(
      planInput(promotion(), {
        monthlyPriceMinor: 0,
        yearlyPriceMinor: 100_000,
      }),
      AS_OF_ACTIVE,
    );
    expect(zeroOffer.monthly.effectiveMinor).toBe(0);
    expect(zeroOffer.monthly.discounted).toBe(false);
  });

  it('rejects invalid percentages and discounts above the base price', () => {
    expect(parsePercentageInput('0').ok).toBe(false);
    expect(parsePercentageInput('-5').ok).toBe(false);
    expect(parsePercentageInput('100.01').ok).toBe(false);
    expect(parsePercentageInput('١٢٫٥')).toEqual({ ok: true, bps: 1250 });

    const aboveBase = validatePromotionAgainstPrices(
      promotion({
        discountType: 'fixed',
        percentageBps: null,
        fixedMonthlyMinor: 10_001,
      }),
      { monthlyPriceMinor: 10_000, yearlyPriceMinor: 100_000 },
    );
    expect(aboveBase.fixedMonthly).toBeTruthy();

    const meaningless = validatePromotionAgainstPrices(
      promotion({ percentageBps: 1 }),
      { monthlyPriceMinor: 1, yearlyPriceMinor: 100 },
    );
    expect(meaningless.percentage).toBeTruthy();
  });

  it('allows a configured 100% or full fixed discount to produce a zero effective price', () => {
    const hundred = validatePromotionAgainstPrices(promotion({ percentageBps: 10_000 }), {
      monthlyPriceMinor: 9_999,
      yearlyPriceMinor: 99_990,
    });
    expect(hundred).toEqual({});
    const fixed = validatePromotionAgainstPrices(
      promotion({
        discountType: 'fixed',
        percentageBps: null,
        fixedMonthlyMinor: 9_999,
      }),
      { monthlyPriceMinor: 9_999, yearlyPriceMinor: 99_990 },
    );
    expect(fixed).toEqual({});
    const offer = resolveOffer(
      planInput(promotion({ percentageBps: 10_000 }), {
        monthlyPriceMinor: 9_999,
        yearlyPriceMinor: 99_990,
      }),
      AS_OF_ACTIVE,
    );
    expect(offer.monthly.effectiveMinor).toBe(0);
  });

  it('rejects inconsistent type/target combinations', () => {
    expect(
      validatePromotionAgainstPrices(
        promotion({
          discountType: 'percentage',
          percentageBps: 1000,
          fixedMonthlyMinor: 100,
        }),
        { monthlyPriceMinor: 10_000, yearlyPriceMinor: 100_000 },
      ).form,
    ).toBeTruthy();
    expect(
      validatePromotionAgainstPrices(
        promotion({
          discountType: 'fixed',
          percentageBps: null,
          target: 'both',
          fixedMonthlyMinor: 100,
          fixedYearlyMinor: null,
        }),
        { monthlyPriceMinor: 10_000, yearlyPriceMinor: 100_000 },
      ).fixedYearly,
    ).toBeTruthy();
  });
});

describe('scheduled promotion state boundaries', () => {
  it('is scheduled before start, active at inclusive start, active before end, expired at exclusive end', () => {
    const plan = planInput(promotion());
    expect(resolveOffer(plan, new Date('2025-12-31T23:59:59.999Z')).state).toBe(
      'scheduled',
    );
    expect(resolveOffer(plan, new Date('2026-01-01T00:00:00.000Z')).state).toBe(
      'active',
    );
    expect(resolveOffer(plan, new Date('2026-01-31T23:59:59.999Z')).state).toBe(
      'active',
    );
    expect(resolveOffer(plan, new Date('2026-02-01T00:00:00.000Z')).state).toBe(
      'expired',
    );
    expect(
      resolveOffer(plan, new Date('2026-02-01T00:00:00.000Z')).monthly
        .effectiveMinor,
    ).toBe(10_000);
  });

  it('a disabled promotion never changes the current price', () => {
    const offer = resolveOffer(
      planInput(promotion({ enabled: false })),
      AS_OF_ACTIVE,
    );
    expect(offer.state).toBe('disabled');
    expect(offer.monthly.discounted).toBe(false);
    expect(offer.monthly.effectiveMinor).toBe(10_000);
    expect(offer.label).toBe('عرض الانضمام المبكر');
  });

  it('a promotion published after its end remains expired', () => {
    const offer = resolveOffer(
      planInput(promotion()),
      new Date('2026-03-01T00:00:00.000Z'),
    );
    expect(offer.state).toBe('expired');
    expect(offer.monthly.effectiveMinor).toBe(10_000);
  });

  it('rejects startsAt >= endsAt', () => {
    const errors = validatePromotionAgainstPrices(
      promotion({
        startsAt: '2026-02-01T00:00:00.000Z',
        endsAt: '2026-02-01T00:00:00.000Z',
      }),
      { monthlyPriceMinor: 10_000, yearlyPriceMinor: 100_000 },
    );
    expect(errors.endsDate).toBeTruthy();
  });
});

describe('effective offer version', () => {
  it('is stable within an unchanged interval and changes at activation/expiration', () => {
    const plan = planInput(promotion());
    const scheduled = resolveOffer(plan, new Date('2025-12-01T00:00:00.000Z'));
    const scheduledLater = resolveOffer(plan, new Date('2025-12-20T00:00:00.000Z'));
    const active = resolveOffer(plan, new Date('2026-01-02T00:00:00.000Z'));
    const activeLater = resolveOffer(plan, new Date('2026-01-20T00:00:00.000Z'));
    const expired = resolveOffer(plan, new Date('2026-03-01T00:00:00.000Z'));

    expect(scheduled.version).toBe(scheduledLater.version);
    expect(active.version).toBe(activeLater.version);
    expect(new Set([scheduled.version, active.version, expired.version]).size).toBe(3);
    expect(active.asOf).not.toBe(activeLater.asOf);
  });

  it('changes with the relevant publication revision or active configuration', () => {
    const base = resolveOffer(planInput(promotion()), AS_OF_ACTIVE);
    const republished = resolveOffer(
      planInput(promotion(), { publishedRevision: 3 }),
      AS_OF_ACTIVE,
    );
    const relabeled = resolveOffer(
      planInput(promotion({ label: 'عرض مختلف' })),
      AS_OF_ACTIVE,
    );
    const changedPrice = resolveOffer(
      planInput(promotion(), { monthlyPriceMinor: 12_000 }),
      AS_OF_ACTIVE,
    );
    expect(base.version).not.toBe(republished.version);
    expect(base.version).not.toBe(relabeled.version);
    expect(base.version).not.toBe(changedPrice.version);
  });

  it('does not change merely because a scheduled publication keeps the same offer', () => {
    const plan = planInput(promotion());
    expect(resolveOffer(plan, new Date('2025-12-01T00:00:00.000Z')).version).toBe(
      resolveOffer(plan, new Date('2025-12-31T23:00:00.000Z')).version,
    );
  });
});

describe('Africa/Cairo scheduling conversion', () => {
  it('labels the timezone and converts local wall-clock time to UTC', () => {
    expect(PROMOTION_TIMEZONE_LABEL).toBe('بتوقيت القاهرة');
    const converted = cairoLocalDateTimeToInstant('2026-01-15', '09:30');
    expect(converted).toEqual({ ok: true, iso: '2026-01-15T07:30:00.000Z' });
    expect(formatCairoDateTime('2026-01-15T07:30:00.000Z')).toBe('2026-01-15 09:30');
  });

  it('rejects nonexistent and ambiguous local times across DST transitions', () => {
    expect(cairoLocalDateTimeToInstant('2025-04-25', '00:30')).toEqual({
      ok: false,
      reason: 'nonexistent',
    });
    expect(cairoLocalDateTimeToInstant('2025-10-30', '23:30')).toEqual({
      ok: false,
      reason: 'ambiguous',
    });
    expect(cairoLocalDateTimeToInstant('2026-02-31', '10:00')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('accepts Arabic-Indic local digits consistently', () => {
    expect(cairoLocalDateTimeToInstant('٢٠٢٦-٠١-١٥', '٠٩:٣٠')).toEqual({
      ok: true,
      iso: '2026-01-15T07:30:00.000Z',
    });
  });
});

describe('historical offer snapshot', () => {
  function publicPlanWithOffer(asOf: Date): PublicPlan {
    const offer = resolveOffer(planInput(promotion()), asOf);
    return {
      slug: 'starter-plan',
      name: 'باقة البداية',
      description: 'وصف',
      features: [],
      monthlyPriceMinor: 10_000,
      yearlyPriceMinor: 100_000,
      currency: 'EGP',
      ctaLabel: 'اطلب الانضمام',
      featured: false,
      displayOrder: 1,
      publishedRevision: 2,
      publishedPromotion: promotion(),
      offer,
    };
  }

  it('builds and validates a versioned active-offer snapshot', () => {
    const plan = publicPlanWithOffer(AS_OF_ACTIVE);
    const snapshot = buildOfferSnapshot({
      plan,
      planId: 'plan-id',
      offer: plan.offer,
      capturedAt: AS_OF_ACTIVE,
    });
    expect(snapshot.version).toBe(1);
    expect(snapshot.baseMonthlyPriceMinor).toBe(10_000);
    expect(snapshot.effectiveMonthlyPriceMinor).toBe(8_000);
    expect(snapshot.promotion?.label).toBe('عرض الانضمام المبكر');
    expect(snapshot.promotion?.monthlySavedMinor).toBe(2_000);
    expect(parseOfferSnapshot(snapshot)).toEqual({ status: 'valid', snapshot });
  });

  it('returns no snapshot for legacy rows and rejects malformed snapshots', () => {
    expect(parseOfferSnapshot(null)).toEqual({ status: 'none' });
    expect(parseOfferSnapshot(undefined)).toEqual({ status: 'none' });
    expect(parseOfferSnapshot({ version: 99 })).toEqual({ status: 'invalid' });
    expect(
      parseOfferSnapshot({ ...buildOfferSnapshot({
        plan: publicPlanWithOffer(AS_OF_ACTIVE),
        planId: 'plan-id',
        offer: publicPlanWithOffer(AS_OF_ACTIVE).offer,
        capturedAt: AS_OF_ACTIVE,
      }), currency: 'USD' }),
    ).toEqual({ status: 'invalid' });
  });

  it('captures no promotion object outside the active interval', () => {
    const plan = publicPlanWithOffer(new Date('2026-03-01T00:00:00.000Z'));
    const snapshot = buildOfferSnapshot({
      plan,
      planId: 'plan-id',
      offer: plan.offer,
      capturedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(snapshot.promotionState).toBe('expired');
    expect(snapshot.promotion).toBeNull();
    expect(snapshot.effectiveMonthlyPriceMinor).toBe(10_000);
  });
});
