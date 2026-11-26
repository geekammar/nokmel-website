import {
  derivePromotionState,
  resolveOffer,
  type OfferResolution,
  type PromotionConfig,
} from './promotion';

/**
 * Owner plan-editor promotion preview (W5 NKW-W41-001 correction).
 *
 * A disabled promotion is never forced to "enabled" for the preview: the
 * editor shows ordinary current prices. Only a genuinely scheduled (enabled,
 * future) promotion gets an explicitly labelled hypothetical simulation at its
 * start instant. Active promotions use their real current offer; expired
 * promotions are shown as expired and never simulated as active.
 *
 * This helper changes no effective-offer server semantics; it is presentation
 * only and reuses the authoritative `resolveOffer`.
 */

export type EditorPreviewKind =
  | 'current_active'
  | 'current_no_promotion'
  | 'current_disabled'
  | 'current_expired'
  | 'scheduled_simulation';

export type PromotionEditorPreview = {
  offer: OfferResolution;
  kind: EditorPreviewKind;
  hypothetical: boolean;
  asOf: string;
};

export function buildPromotionEditorPreview(args: {
  promotion: PromotionConfig;
  slug: string;
  publishedRevision: number;
  currency: string;
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
  asOf: Date;
}): PromotionEditorPreview {
  const { promotion, asOf } = args;
  const state = derivePromotionState(promotion, asOf);
  const plan = {
    slug: args.slug || 'preview-plan',
    publishedRevision: args.publishedRevision,
    currency: args.currency,
    monthlyPriceMinor: args.monthlyPriceMinor,
    yearlyPriceMinor: args.yearlyPriceMinor,
  };

  if (state === 'scheduled') {
    const start = Date.parse(promotion.startsAt);
    const simulationAt =
      Number.isFinite(start) && start > asOf.getTime() ? new Date(start) : asOf;
    return {
      offer: resolveOffer(
        { ...plan, promotion: { ...promotion, enabled: true } },
        simulationAt,
      ),
      kind: 'scheduled_simulation',
      hypothetical: true,
      asOf: simulationAt.toISOString(),
    };
  }

  const offer = resolveOffer({ ...plan, promotion }, asOf);
  const kind: EditorPreviewKind =
    state === 'active'
      ? 'current_active'
      : state === 'disabled'
        ? 'current_disabled'
        : state === 'expired'
          ? 'current_expired'
          : 'current_no_promotion';
  return { offer, kind, hypothetical: false, asOf: asOf.toISOString() };
}
