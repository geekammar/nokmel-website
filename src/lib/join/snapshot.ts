import { z } from 'zod';
import {
  MAX_PRICE_MINOR,
  PROMOTION_DISCOUNT_TYPES,
  PROMOTION_STATES,
  PROMOTION_TARGETS,
  type OfferResolution,
  type PromotionState,
} from '@/lib/plans/promotion';
import {
  supportedCurrencyCodes,
  type PublicPlan,
  type SupportedCurrencyCode,
} from '@/lib/plans/model';

/**
 * Immutable historical offer snapshot for newly accepted planned requests
 * (W4.1). The legacy single-price columns remain populated for backward
 * compatibility, but this versioned snapshot is authoritative for new rows.
 * Legacy W4 rows without this object keep their existing single-price meaning.
 */

export const OFFER_SNAPSHOT_VERSION = 1 as const;

const minor = z.number().int().min(0).max(MAX_PRICE_MINOR);

const instant = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    'Invalid instant',
  )
  .refine((value) => Number.isFinite(Date.parse(value)), 'Invalid instant');

const activePromotionSchema = z
  .object({
    label: z.string().min(1).max(80),
    discountType: z.enum(PROMOTION_DISCOUNT_TYPES),
    target: z.enum(PROMOTION_TARGETS),
    percentageBps: z.number().int().min(1).max(10_000).nullable(),
    fixedMonthlyMinor: minor.nullable(),
    fixedYearlyMinor: minor.nullable(),
    startsAt: instant,
    endsAt: instant,
    monthlySavedMinor: minor.nullable(),
    yearlySavedMinor: minor.nullable(),
    monthlySavedPercentBps: z.number().int().min(0).max(10_000).nullable(),
    yearlySavedPercentBps: z.number().int().min(0).max(10_000).nullable(),
  })
  .strict();

export const offerSnapshotSchema = z
  .object({
    version: z.literal(OFFER_SNAPSHOT_VERSION),
    capturedAt: instant,
    planId: z.string().min(1).max(80),
    planSlug: z.string().min(1).max(80),
    planName: z.string().min(1).max(120),
    currency: z.enum(supportedCurrencyCodes),
    publishedRevision: z.number().int().min(0).max(1_000_000),
    promotionState: z.enum(PROMOTION_STATES),
    effectiveOfferVersion: z
      .string()
      .min(8)
      .max(80)
      .regex(/^[A-Za-z0-9._:-]+$/, 'Invalid offer version'),
    baseMonthlyPriceMinor: minor.nullable(),
    baseYearlyPriceMinor: minor.nullable(),
    effectiveMonthlyPriceMinor: minor.nullable(),
    effectiveYearlyPriceMinor: minor.nullable(),
    promotion: activePromotionSchema.nullable(),
  })
  .strict();

export type OfferSnapshot = z.infer<typeof offerSnapshotSchema>;

export type OfferSnapshotParseResult =
  | { status: 'none' }
  | { status: 'valid'; snapshot: OfferSnapshot }
  | { status: 'invalid' };

export function buildOfferSnapshot(args: {
  plan: PublicPlan;
  planId: string;
  offer: OfferResolution;
  capturedAt: Date;
}): OfferSnapshot {
  const { plan, offer } = args;
  const active = offer.state === 'active' && plan.publishedPromotion;
  return {
    version: OFFER_SNAPSHOT_VERSION,
    capturedAt: args.capturedAt.toISOString(),
    planId: args.planId,
    planSlug: plan.slug,
    planName: plan.name,
    currency: plan.currency,
    publishedRevision: plan.publishedRevision,
    promotionState: offer.state,
    effectiveOfferVersion: offer.version,
    baseMonthlyPriceMinor: offer.monthly.baseMinor,
    baseYearlyPriceMinor: offer.yearly.baseMinor,
    effectiveMonthlyPriceMinor: offer.monthly.effectiveMinor,
    effectiveYearlyPriceMinor: offer.yearly.effectiveMinor,
    promotion: active
      ? {
          label: active.label,
          discountType: active.discountType,
          target: active.target,
          percentageBps: active.percentageBps,
          fixedMonthlyMinor: active.fixedMonthlyMinor,
          fixedYearlyMinor: active.fixedYearlyMinor,
          startsAt: active.startsAt,
          endsAt: active.endsAt,
          monthlySavedMinor: offer.monthly.savedMinor,
          yearlySavedMinor: offer.yearly.savedMinor,
          monthlySavedPercentBps: offer.monthly.savedPercentBps,
          yearlySavedPercentBps: offer.yearly.savedPercentBps,
        }
      : null,
  };
}

export function parseOfferSnapshot(raw: unknown): OfferSnapshotParseResult {
  if (raw === null || raw === undefined) return { status: 'none' };
  const parsed = offerSnapshotSchema.safeParse(raw);
  if (!parsed.success) return { status: 'invalid' };
  return { status: 'valid', snapshot: parsed.data };
}

export type SnapshotPriceSummary = {
  currency: SupportedCurrencyCode;
  baseMonthlyPriceMinor: number | null;
  baseYearlyPriceMinor: number | null;
  effectiveMonthlyPriceMinor: number | null;
  effectiveYearlyPriceMinor: number | null;
  promotionState: PromotionState;
  promotionLabel: string | null;
};

export function snapshotPriceSummary(snapshot: OfferSnapshot): SnapshotPriceSummary {
  return {
    currency: snapshot.currency,
    baseMonthlyPriceMinor: snapshot.baseMonthlyPriceMinor,
    baseYearlyPriceMinor: snapshot.baseYearlyPriceMinor,
    effectiveMonthlyPriceMinor: snapshot.effectiveMonthlyPriceMinor,
    effectiveYearlyPriceMinor: snapshot.effectiveYearlyPriceMinor,
    promotionState: snapshot.promotionState,
    promotionLabel: snapshot.promotion?.label ?? null,
  };
}
