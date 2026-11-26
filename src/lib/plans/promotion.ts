import { z } from 'zod';

/**
 * Scheduled promotional pricing domain (W4.1).
 *
 * Marketing data only: a promotion never creates a purchase, payment,
 * subscription, contractual discount, entitlement or merchant permission.
 * One optional promotion configuration belongs to one marketing plan.
 *
 * All monetary values are exact integer minor units. Percentage discounts use
 * integer basis points (1% = 100 bps) and BigInt intermediate arithmetic, so
 * no floating-point value is authoritative. Rounding is deterministic:
 * half-up to the currency minor unit.
 *
 * Schedule instants are stored as absolute UTC ISO strings. Owner-facing input
 * is interpreted in Africa/Cairo local time. A promotion is active only when
 * enabled, now >= startsAt (inclusive) and now < endsAt (exclusive).
 */

export const PROMOTION_TIMEZONE = 'Africa/Cairo';
export const PROMOTION_TIMEZONE_LABEL = 'بتوقيت القاهرة';

/**
 * Maximum signed 32-bit PostgreSQL integer. The W4 schema stores prices in
 * `integer` columns; validation must never accept a value the database cannot
 * represent.
 */
export const MAX_PRICE_MINOR = 2_147_483_647;

export const PROMOTION_LIMITS = {
  label: 80,
  percentageMaxBps: 10_000,
  minYear: 2000,
  maxYear: 2100,
} as const;

export const PROMOTION_DISCOUNT_TYPES = ['percentage', 'fixed'] as const;
export type PromotionDiscountType = (typeof PROMOTION_DISCOUNT_TYPES)[number];

export const PROMOTION_TARGETS = ['monthly', 'yearly', 'both'] as const;
export type PromotionTarget = (typeof PROMOTION_TARGETS)[number];

export const PROMOTION_STATES = [
  'none',
  'scheduled',
  'active',
  'expired',
  'disabled',
] as const;
export type PromotionState = (typeof PROMOTION_STATES)[number];

export const promotionFormSchema = z
  .object({
    enabled: z.boolean(),
    label: z.string().max(PROMOTION_LIMITS.label, 'اسم العرض أطول من الحد المسموح.'),
    discountType: z.enum(PROMOTION_DISCOUNT_TYPES),
    target: z.enum(PROMOTION_TARGETS),
    percentage: z.string().max(20),
    fixedMonthly: z.string().max(40),
    fixedYearly: z.string().max(40),
    startsDate: z.string().max(10),
    startsTime: z.string().max(5),
    endsDate: z.string().max(10),
    endsTime: z.string().max(5),
  })
  .strict();

export type PromotionConfig = {
  enabled: boolean;
  label: string;
  discountType: PromotionDiscountType;
  target: PromotionTarget;
  percentageBps: number | null;
  fixedMonthlyMinor: number | null;
  fixedYearlyMinor: number | null;
  startsAt: string;
  endsAt: string;
};

export type PromotionFormValues = {
  enabled: boolean;
  label: string;
  discountType: PromotionDiscountType;
  target: PromotionTarget;
  percentage: string;
  fixedMonthly: string;
  fixedYearly: string;
  startsDate: string;
  startsTime: string;
  endsDate: string;
  endsTime: string;
};

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;

export function normalizeDigits(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

export type MajorAmountParseResult =
  | { ok: true; minor: number | null }
  | { ok: false; message: string };

/**
 * Parses an owner-entered major-unit amount into exact minor units. Shared by
 * plan base prices and fixed promotion amounts so both follow the same
 * currency-exponent and Arabic-Indic digit rules.
 */
export function parseMajorAmountInput(
  raw: string,
  exponent: number,
): MajorAmountParseResult {
  const normalized = normalizeDigits(String(raw ?? ''))
    .replace(/[\u066C\u060C\s]/g, '')
    .replace(/\u066B/g, '.')
    .trim();
  if (normalized === '') return { ok: true, minor: null };
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { ok: false, message: 'أدخل مبلغاً رقمياً صالحاً بدون رموز أو فواصل آلاف.' };
  }
  const [integerDigits, fractionDigits = ''] = normalized.split('.');
  if (fractionDigits.length > exponent) {
    return {
      ok: false,
      message:
        exponent === 0
          ? 'هذه العملة لا تقبل كسوراً عشرية.'
          : `هذه العملة تقبل ${exponent} خانة عشرية كحد أقصى.`,
    };
  }
  if (integerDigits.length > 10) {
    return { ok: false, message: 'المبلغ أكبر من الحد المسموح.' };
  }
  const minorDigits = `${integerDigits}${fractionDigits.padEnd(exponent, '0')}`;
  const minor = Number(minorDigits);
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > MAX_PRICE_MINOR) {
    return { ok: false, message: 'المبلغ أكبر من الحد المسموح.' };
  }
  return { ok: true, minor };
}

export type PercentageParseResult =
  | { ok: true; bps: number }
  | { ok: false; message: string };

/**
 * Parses an owner-entered percentage (for example 12.5) into integer basis
 * points. Zero, negative, over 100 and sub-basis-point values are rejected.
 */
export function parsePercentageInput(raw: string): PercentageParseResult {
  const normalized = normalizeDigits(String(raw ?? ''))
    .replace(/[\u066C\u060C%\s]/g, '')
    .replace(/\u066B/g, '.')
    .trim();
  if (normalized === '') {
    return { ok: false, message: 'أدخل نسبة الخصم.' };
  }
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) {
    return {
      ok: false,
      message: 'أدخل نسبة بين 0.01 و100 بخانتين عشريتين كحد أقصى.',
    };
  }
  const [integerDigits, fractionDigits = ''] = normalized.split('.');
  const bps =
    Number(integerDigits) * 100 +
    Number(fractionDigits.padEnd(2, '0').slice(0, 2) || '0');
  if (!Number.isInteger(bps) || bps < 1 || bps > PROMOTION_LIMITS.percentageMaxBps) {
    return {
      ok: false,
      message: 'النسبة يجب أن تكون أكبر من صفر ولا تتجاوز 100%.',
    };
  }
  return { ok: true, bps };
}

/**
 * Exact percentage discount in minor units. Uses BigInt for the intermediate
 * multiplication and rounds half-up to the nearest minor unit.
 */
export function percentageDiscountMinor(baseMinor: number, bps: number): number {
  if (!Number.isSafeInteger(baseMinor) || baseMinor < 0) {
    throw new Error('Invalid base minor amount');
  }
  if (!Number.isInteger(bps) || bps < 0 || bps > PROMOTION_LIMITS.percentageMaxBps) {
    throw new Error('Invalid percentage basis points');
  }
  const product = BigInt(baseMinor) * BigInt(bps);
  const discount = (product + BigInt(5_000)) / BigInt(10_000);
  const result = Number(discount);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Discount arithmetic overflow');
  }
  return result;
}

export function formatSavedPercent(bps: number | null): string | null {
  if (bps === null || !Number.isInteger(bps) || bps < 0) return null;
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  if (fraction === 0) return `${whole}%`;
  const fractionText = String(fraction).padStart(2, '0').replace(/0$/, '');
  return `${whole}.${fractionText}%`;
}

const CAIRO_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: PROMOTION_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  calendar: 'gregory',
  numberingSystem: 'latn',
});

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(epochMs: number): ZonedParts {
  const parts = CAIRO_PARTS_FORMATTER.formatToParts(new Date(epochMs));
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? NaN);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function timeZoneOffsetMs(epochMs: number): number {
  const floored = Math.floor(epochMs / 1000) * 1000;
  const parts = zonedParts(floored);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - floored
  );
}

export type CairoInstantResult =
  | { ok: true; iso: string }
  | { ok: false; reason: 'invalid' | 'nonexistent' | 'ambiguous' };

/**
 * Converts an Africa/Cairo local wall-clock date/time to an absolute UTC
 * instant. Nonexistent (spring-forward gap) and ambiguous (fall-back repeated)
 * local times are rejected instead of being silently adjusted.
 */
export function cairoLocalDateTimeToInstant(
  rawDate: string,
  rawTime: string,
): CairoInstantResult {
  const dateText = normalizeDigits(String(rawDate ?? '')).trim();
  const timeText = normalizeDigits(String(rawTime ?? '')).trim();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText);
  if (!dateMatch || !timeMatch) return { ok: false, reason: 'invalid' };

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (
    year < PROMOTION_LIMITS.minYear ||
    year > PROMOTION_LIMITS.maxYear ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const check = new Date(naive);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const offsets = new Set<number>();
  const dayMs = 24 * 60 * 60 * 1000;
  for (const probe of [naive - 2 * dayMs, naive, naive + 2 * dayMs]) {
    offsets.add(timeZoneOffsetMs(probe));
  }

  const matching = new Set<number>();
  for (const offset of offsets) {
    const candidate = naive - offset;
    const parts = zonedParts(candidate);
    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute
    ) {
      matching.add(candidate);
    }
  }

  if (matching.size === 0) return { ok: false, reason: 'nonexistent' };
  if (matching.size > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: true, iso: new Date([...matching][0]).toISOString() };
}

export function formatCairoDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const epoch = Date.parse(iso);
  if (!Number.isFinite(epoch)) return null;
  const parts = zonedParts(epoch);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function cairoDateTimeInputs(
  iso: string | null,
): { date: string; time: string } {
  const formatted = formatCairoDateTime(iso);
  if (!formatted) return { date: '', time: '' };
  const [date, time] = formatted.split(' ');
  return { date, time };
}

const utcInstantSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    'توقيت غير صالح.',
  )
  .refine((value) => Number.isFinite(Date.parse(value)), 'توقيت غير صالح.');

const nullableMinor = z
  .number()
  .int()
  .min(1, 'قيمة الخصم غير صالحة.')
  .max(MAX_PRICE_MINOR, 'قيمة الخصم أكبر من الحد المسموح.')
  .nullable();

export const promotionConfigSchema = z
  .object({
    enabled: z.boolean(),
    label: z
      .string()
      .trim()
      .min(1, 'أدخل اسم العرض.')
      .max(PROMOTION_LIMITS.label, 'اسم العرض أطول من الحد المسموح.'),
    discountType: z.enum(PROMOTION_DISCOUNT_TYPES),
    target: z.enum(PROMOTION_TARGETS),
    percentageBps: z.number().int().min(1).max(10_000).nullable(),
    fixedMonthlyMinor: nullableMinor,
    fixedYearlyMinor: nullableMinor,
    startsAt: utcInstantSchema,
    endsAt: utcInstantSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.discountType === 'percentage') {
      if (value.percentageBps === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['percentage'],
          message: 'أدخل نسبة الخصم.',
        });
      }
      if (value.fixedMonthlyMinor !== null || value.fixedYearlyMinor !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['form'],
          message: 'لا يمكن حفظ مبالغ ثابتة مع خصم نسبي.',
        });
      }
    } else if (value.percentageBps !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['form'],
        message: 'لا يمكن حفظ نسبة مع خصم مبلغ ثابت.',
      });
    }

    if (value.target === 'monthly' || value.target === 'both') {
      if (value.discountType === 'fixed' && value.fixedMonthlyMinor === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedMonthly'],
          message: 'أدخل مبلغ الخصم الشهري.',
        });
      }
    } else if (value.fixedMonthlyMinor !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['form'],
        message: 'لا يمكن حفظ خصم شهري عند استهداف السعر السنوي فقط.',
      });
    }

    if (value.target === 'yearly' || value.target === 'both') {
      if (value.discountType === 'fixed' && value.fixedYearlyMinor === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedYearly'],
          message: 'أدخل مبلغ الخصم السنوي.',
        });
      }
    } else if (value.fixedYearlyMinor !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['form'],
        message: 'لا يمكن حفظ خصم سنوي عند استهداف السعر الشهري فقط.',
      });
    }

    const start = Date.parse(value.startsAt);
    const end = Date.parse(value.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startsDate'],
        message: 'توقيت العرض غير صالح.',
      });
    } else if (start >= end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endsDate'],
        message: 'يجب أن يكون وقت الانتهاء بعد وقت البداية.',
      });
    }
  });

export type PromotionPriceContext = {
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
};

export type PromotionValidationErrors = Record<string, string>;

function targetedPeriods(target: PromotionTarget): Array<'monthly' | 'yearly'> {
  if (target === 'both') return ['monthly', 'yearly'];
  return [target];
}

/**
 * Validates a structurally parsed promotion against the plan base prices.
 * Rejects discounts on null/zero prices, fixed amounts above the base, and
 * percentages that round to no meaningful saving.
 */
export function validatePromotionAgainstPrices(
  config: PromotionConfig,
  context: PromotionPriceContext,
): PromotionValidationErrors {
  const parsed = promotionConfigSchema.safeParse(config);
  if (!parsed.success) {
    const errors: PromotionValidationErrors = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.map(String).join('.');
      const key =
        path === 'percentageBps'
          ? 'percentage'
          : path === 'startsAt'
            ? 'startsDate'
            : path === 'endsAt'
              ? 'endsDate'
              : path || 'form';
      errors[key] ??= issue.message;
    }
    return errors;
  }

  const errors: PromotionValidationErrors = {};
  const normalized = parsed.data as PromotionConfig;
  const start = Date.parse(normalized.startsAt);
  const end = Date.parse(normalized.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    errors.endsDate = 'يجب أن يكون وقت الانتهاء بعد وقت البداية.';
    return errors;
  }

  for (const period of targetedPeriods(normalized.target)) {
    const base =
      period === 'monthly'
        ? context.monthlyPriceMinor
        : context.yearlyPriceMinor;
    if (base === null) {
      errors.target ??=
        period === 'monthly'
          ? 'لا يمكن تطبيق خصم على سعر شهري غير معلن.'
          : 'لا يمكن تطبيق خصم على سعر سنوي غير معلن.';
      continue;
    }
    if (!Number.isSafeInteger(base) || base <= 0) {
      errors.target ??= 'لا يمكن تطبيق خصم على سعر صفري.';
      continue;
    }
    if (normalized.discountType === 'percentage') {
      const bps = normalized.percentageBps;
      if (bps === null) {
        errors.percentage ??= 'أدخل نسبة الخصم.';
        continue;
      }
      if (percentageDiscountMinor(base, bps) < 1) {
        errors.percentage ??=
          'النسبة صغيرة جداً بحيث لا تُنتج خصماً قابلاً للتمثيل في هذه العملة.';
      }
    } else {
      const amount =
        period === 'monthly'
          ? normalized.fixedMonthlyMinor
          : normalized.fixedYearlyMinor;
      if (amount === null) {
        errors[period === 'monthly' ? 'fixedMonthly' : 'fixedYearly'] ??=
          period === 'monthly'
            ? 'أدخل مبلغ الخصم الشهري.'
            : 'أدخل مبلغ الخصم السنوي.';
        continue;
      }
      if (amount <= 0) {
        errors[period === 'monthly' ? 'fixedMonthly' : 'fixedYearly'] ??=
          'قيمة الخصم يجب أن تكون أكبر من صفر.';
      } else if (amount > base) {
        errors[period === 'monthly' ? 'fixedMonthly' : 'fixedYearly'] ??=
          'قيمة الخصم أكبر من السعر الأساسي.';
      }
    }
  }

  return errors;
}

export function parsePromotionConfig(raw: unknown): PromotionConfig | null {
  if (raw === null || raw === undefined) return null;
  const parsed = promotionConfigSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Invalid stored promotion configuration');
  return parsed.data as PromotionConfig;
}

export function derivePromotionState(
  promotion: PromotionConfig | null,
  asOf: Date,
): PromotionState {
  if (!promotion) return 'none';
  if (!promotion.enabled) return 'disabled';
  const now = asOf.getTime();
  const start = Date.parse(promotion.startsAt);
  const end = Date.parse(promotion.endsAt);
  if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end)) {
    return 'disabled';
  }
  if (now < start) return 'scheduled';
  if (now >= end) return 'expired';
  return 'active';
}

export type PeriodOffer = {
  baseMinor: number | null;
  effectiveMinor: number | null;
  savedMinor: number | null;
  savedPercentBps: number | null;
  discounted: boolean;
};

export type OfferPlanInput = {
  slug: string;
  publishedRevision: number;
  currency: string;
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
  promotion: PromotionConfig | null;
};

export type OfferResolution = {
  version: string;
  asOf: string;
  state: PromotionState;
  label: string | null;
  startsAt: string | null;
  endsAt: string | null;
  discountType: PromotionDiscountType | null;
  target: PromotionTarget | null;
  monthly: PeriodOffer;
  yearly: PeriodOffer;
};

function emptyPeriod(baseMinor: number | null): PeriodOffer {
  return {
    baseMinor,
    effectiveMinor: baseMinor,
    savedMinor: null,
    savedPercentBps: null,
    discounted: false,
  };
}

function discountedPeriod(baseMinor: number, discountMinor: number): PeriodOffer {
  const safeDiscount = Math.max(0, Math.min(baseMinor, discountMinor));
  const effectiveMinor = baseMinor - safeDiscount;
  const savedPercentBps =
    baseMinor === 0
      ? null
      : Number((BigInt(safeDiscount) * BigInt(10_000)) / BigInt(baseMinor));
  return {
    baseMinor,
    effectiveMinor,
    savedMinor: safeDiscount,
    savedPercentBps,
    discounted: safeDiscount > 0,
  };
}

function fnv1a64Hex(input: string): string {
  let hash = BigInt('0xcbf29ce484222325');
  const bytes = new TextEncoder().encode(input);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * BigInt('0x100000001b3')) & BigInt('0xffffffffffffffff');
  }
  return hash.toString(16).padStart(16, '0');
}

function canonicalOfferVersion(
  plan: OfferPlanInput,
  state: PromotionState,
  monthly: PeriodOffer,
  yearly: PeriodOffer,
): string {
  const active = state === 'active' ? plan.promotion : null;
  const source = JSON.stringify([
    'nokmel.effective-offer.v1',
    plan.slug,
    plan.publishedRevision,
    plan.currency,
    plan.monthlyPriceMinor,
    plan.yearlyPriceMinor,
    state,
    monthly.effectiveMinor,
    yearly.effectiveMinor,
    active
      ? [
          active.label,
          active.discountType,
          active.target,
          active.percentageBps,
          active.fixedMonthlyMinor,
          active.fixedYearlyMinor,
          active.startsAt,
          active.endsAt,
          monthly.savedMinor,
          yearly.savedMinor,
        ]
      : null,
  ]);
  return `w41-${fnv1a64Hex(source)}`;
}

/**
 * Single authoritative offer resolver. Public pricing, join presentation,
 * submission validation and historical snapshots all use these semantics.
 */
export function resolveOffer(plan: OfferPlanInput, asOf: Date): OfferResolution {
  if (!Number.isFinite(asOf.getTime())) throw new Error('Invalid asOf instant');
  const state = derivePromotionState(plan.promotion, asOf);
  let monthly = emptyPeriod(plan.monthlyPriceMinor);
  let yearly = emptyPeriod(plan.yearlyPriceMinor);

  if (state === 'active' && plan.promotion) {
    const promotion = plan.promotion;
    const appliesMonthly =
      promotion.target === 'monthly' || promotion.target === 'both';
    const appliesYearly =
      promotion.target === 'yearly' || promotion.target === 'both';

    if (appliesMonthly && monthly.baseMinor !== null && monthly.baseMinor > 0) {
      const discount =
        promotion.discountType === 'percentage'
          ? promotion.percentageBps === null
            ? 0
            : percentageDiscountMinor(monthly.baseMinor, promotion.percentageBps)
          : promotion.fixedMonthlyMinor ?? 0;
      monthly = discountedPeriod(monthly.baseMinor, discount);
    }
    if (appliesYearly && yearly.baseMinor !== null && yearly.baseMinor > 0) {
      const discount =
        promotion.discountType === 'percentage'
          ? promotion.percentageBps === null
            ? 0
            : percentageDiscountMinor(yearly.baseMinor, promotion.percentageBps)
          : promotion.fixedYearlyMinor ?? 0;
      yearly = discountedPeriod(yearly.baseMinor, discount);
    }
  }

  return {
    version: canonicalOfferVersion(plan, state, monthly, yearly),
    asOf: asOf.toISOString(),
    state,
    label: plan.promotion?.label ?? null,
    startsAt: plan.promotion?.startsAt ?? null,
    endsAt: plan.promotion?.endsAt ?? null,
    discountType:
      state === 'active' ? (plan.promotion?.discountType ?? null) : null,
    target: state === 'active' ? (plan.promotion?.target ?? null) : null,
    monthly,
    yearly,
  };
}

export function emptyPromotionFormValues(): PromotionFormValues {
  return {
    enabled: true,
    label: '',
    discountType: 'percentage',
    target: 'monthly',
    percentage: '',
    fixedMonthly: '',
    fixedYearly: '',
    startsDate: '',
    startsTime: '',
    endsDate: '',
    endsTime: '',
  };
}

export function formatPercentageInput(bps: number | null): string {
  if (bps === null) return '';
  const whole = Math.floor(bps / 100);
  const fraction = bps % 100;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`;
}
