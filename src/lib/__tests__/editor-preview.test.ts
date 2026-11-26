import { describe, expect, test } from 'vitest';
import { buildPromotionEditorPreview } from '@/lib/plans/editor-preview';
import type { PromotionConfig } from '@/lib/plans/promotion';

const asOf = new Date('2026-11-26T12:00:00.000Z');

function promotion(overrides: Partial<PromotionConfig> = {}): PromotionConfig {
  return {
    enabled: true,
    label: 'عرض',
    discountType: 'percentage',
    target: 'monthly',
    percentageBps: 2000,
    fixedMonthlyMinor: null,
    fixedYearlyMinor: null,
    startsAt: '2026-11-20T00:00:00.000Z',
    endsAt: '2026-12-01T00:00:00.000Z',
    ...overrides,
  };
}

function preview(config: PromotionConfig) {
  return buildPromotionEditorPreview({
    promotion: config,
    slug: 'starter',
    publishedRevision: 3,
    currency: 'EGP',
    monthlyPriceMinor: 19900,
    yearlyPriceMinor: 199000,
    asOf,
  });
}

describe('NKW-W41-001 editor promotion preview', () => {
  test('a disabled promotion shows ordinary current prices, never a hypothetical discount', () => {
    const result = preview(promotion({ enabled: false }));
    expect(result.kind).toBe('current_disabled');
    expect(result.hypothetical).toBe(false);
    expect(result.offer.state).toBe('disabled');
    expect(result.offer.monthly.effectiveMinor).toBe(19900);
    expect(result.offer.monthly.savedMinor).toBeNull();
    expect(result.offer.monthly.discounted).toBe(false);
  });

  test('a disabled future promotion is not simulated as active', () => {
    const result = preview(
      promotion({
        enabled: false,
        startsAt: '2026-12-05T00:00:00.000Z',
        endsAt: '2026-12-20T00:00:00.000Z',
      }),
    );
    expect(result.kind).toBe('current_disabled');
    expect(result.hypothetical).toBe(false);
    expect(result.offer.monthly.effectiveMinor).toBe(19900);
  });

  test('an enabled scheduled promotion is an explicitly hypothetical simulation', () => {
    const result = preview(
      promotion({
        startsAt: '2026-12-05T00:00:00.000Z',
        endsAt: '2026-12-20T00:00:00.000Z',
      }),
    );
    expect(result.kind).toBe('scheduled_simulation');
    expect(result.hypothetical).toBe(true);
    expect(result.offer.state).toBe('active');
    expect(result.offer.monthly.effectiveMinor).toBe(15920);
    expect(result.offer.monthly.savedMinor).toBe(3980);
  });

  test('an active promotion shows its real current discounted offer', () => {
    const result = preview(promotion());
    expect(result.kind).toBe('current_active');
    expect(result.hypothetical).toBe(false);
    expect(result.offer.state).toBe('active');
    expect(result.offer.monthly.effectiveMinor).toBe(15920);
  });

  test('an expired promotion is not presented as currently active', () => {
    const result = preview(
      promotion({
        startsAt: '2026-10-01T00:00:00.000Z',
        endsAt: '2026-11-01T00:00:00.000Z',
      }),
    );
    expect(result.kind).toBe('current_expired');
    expect(result.hypothetical).toBe(false);
    expect(result.offer.state).toBe('expired');
    expect(result.offer.monthly.effectiveMinor).toBe(19900);
    expect(result.offer.monthly.discounted).toBe(false);
  });
});
