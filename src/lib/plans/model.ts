import { z } from 'zod';
import {
  MAX_PRICE_MINOR,
  cairoDateTimeInputs,
  cairoLocalDateTimeToInstant,
  emptyPromotionFormValues,
  formatPercentageInput,
  normalizeDigits,
  parseMajorAmountInput,
  parsePercentageInput,
  parsePromotionConfig,
  promotionConfigSchema,
  promotionFormSchema,
  resolveOffer,
  validatePromotionAgainstPrices,
  type OfferResolution,
  type PromotionConfig,
  type PromotionFormValues,
} from './promotion';

/**
 * Marketing-plan domain model (W4, extended in W4.1).
 *
 * Plans are marketing data only. They never authorize purchases, subscriptions,
 * entitlements or merchant permissions. Prices are stored as exact integer
 * minor units; no floating-point price is persisted. A plan may have no
 * numerical price at all (displayed later), which is distinct from an explicit
 * zero price.
 */

export const PLAN_STATUSES = ['draft', 'published', 'hidden'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_PRICE_PERIODS = ['monthly', 'yearly'] as const;
export type PlanPricePeriod = (typeof PLAN_PRICE_PERIODS)[number];

export const PLAN_LIMITS = {
  slug: 60,
  name: 120,
  description: 600,
  feature: 160,
  features: 10,
  ctaLabel: 40,
  displayOrder: 9999,
  priceMinor: MAX_PRICE_MINOR,
} as const;

export type SupportedCurrencyCode =
  | 'EGP'
  | 'SAR'
  | 'AED'
  | 'KWD'
  | 'QAR'
  | 'JOD'
  | 'BHD'
  | 'OMR'
  | 'MAD'
  | 'DZD'
  | 'TND'
  | 'IQD'
  | 'LYD'
  | 'SDG'
  | 'SYP'
  | 'YER';

type CurrencyDefinition = {
  code: SupportedCurrencyCode;
  exponent: number;
  label: string;
};

/**
 * Deliberately explicit currency allowlist (target Arab markets). The minor
 * unit exponent is defined per currency; no currency is assumed when the owner
 * creates a plan because the create form requires an explicit selection.
 */
export const SUPPORTED_CURRENCIES: readonly CurrencyDefinition[] = [
  { code: 'EGP', exponent: 2, label: 'جنيه مصري' },
  { code: 'SAR', exponent: 2, label: 'ريال سعودي' },
  { code: 'AED', exponent: 2, label: 'درهم إماراتي' },
  { code: 'KWD', exponent: 3, label: 'دينار كويتي' },
  { code: 'QAR', exponent: 2, label: 'ريال قطري' },
  { code: 'JOD', exponent: 3, label: 'دينار أردني' },
  { code: 'BHD', exponent: 3, label: 'دينار بحريني' },
  { code: 'OMR', exponent: 3, label: 'ريال عماني' },
  { code: 'MAD', exponent: 2, label: 'درهم مغربي' },
  { code: 'DZD', exponent: 2, label: 'دينار جزائري' },
  { code: 'TND', exponent: 3, label: 'دينار تونسي' },
  { code: 'IQD', exponent: 3, label: 'دينار عراقي' },
  { code: 'LYD', exponent: 2, label: 'دينار ليبي' },
  { code: 'SDG', exponent: 2, label: 'جنيه سوداني' },
  { code: 'SYP', exponent: 2, label: 'ليرة سورية' },
  { code: 'YER', exponent: 2, label: 'ريال يمني' },
] as const;

const CURRENCY_BY_CODE = new Map(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency]),
);

export const supportedCurrencyCodes = SUPPORTED_CURRENCIES.map(
  (currency) => currency.code,
) as [SupportedCurrencyCode, ...SupportedCurrencyCode[]];

export const currencyCodeSchema = z.enum(supportedCurrencyCodes);

export function isSupportedCurrency(value: unknown): value is SupportedCurrencyCode {
  return typeof value === 'string' && CURRENCY_BY_CODE.has(value as SupportedCurrencyCode);
}

export function currencyDefinition(code: SupportedCurrencyCode): CurrencyDefinition {
  const currency = CURRENCY_BY_CODE.get(code);
  if (!currency) throw new Error('Unsupported currency');
  return currency;
}

/**
 * Formats exact integer minor units with the currency's own exponent. Latin
 * digits and the ISO code are used for deterministic rendering in the Arabic
 * UI. Never derives discounts or converts between monthly/yearly amounts.
 */
export function formatPriceMinor(
  minor: number | null,
  currency: SupportedCurrencyCode | string,
): string | null {
  if (minor === null) return null;
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error('Invalid minor-unit amount');
  }
  if (!isSupportedCurrency(currency)) {
    throw new Error('Unsupported currency');
  }
  const { exponent } = currencyDefinition(currency);
  const digits = String(minor).padStart(exponent + 1, '0');
  const integerPart = digits.slice(0, digits.length - exponent) || '0';
  const fractionPart = exponent > 0 ? digits.slice(digits.length - exponent) : '';
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fractionPart ? `${grouped}.${fractionPart} ${currency}` : `${grouped} ${currency}`;
}

export const normalizeNumericInputDigits = normalizeDigits;

export type PriceParseResult =
  | { ok: true; minor: number | null }
  | { ok: false; message: string };

/**
 * Parses an owner-entered major-unit price into exact minor units. Empty input
 * means "no numerical price" (null). Explicit `0` means a real zero price.
 */
export function parsePriceInput(
  raw: string,
  currency: SupportedCurrencyCode,
): PriceParseResult {
  return parseMajorAmountInput(raw, currencyDefinition(currency).exponent);
}

export function priceInputFromMinor(
  minor: number | null,
  currency: SupportedCurrencyCode,
): string {
  if (minor === null) return '';
  if (!isSupportedCurrency(currency)) return '';
  const { exponent } = currencyDefinition(currency);
  const digits = String(minor).padStart(exponent + 1, '0');
  const integerPart = digits.slice(0, digits.length - exponent) || '0';
  const fractionPart = exponent > 0 ? digits.slice(digits.length - exponent) : '';
  return fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
}

export const planSlugSchema = z
  .string()
  .trim()
  .min(2, 'المعرّف قصير جداً.')
  .max(PLAN_LIMITS.slug, 'المعرّف أطول من الحد المسموح.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'استخدم حروفاً إنجليزية صغيرة وأرقاماً وشرطات فقط (مثل starter-plan).',
  );

export type PlanDraftValues = {
  name: string;
  description: string;
  features: string[];
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
  currency: SupportedCurrencyCode;
  ctaLabel: string;
  featured: boolean;
  displayOrder: number;
  promotion: PromotionConfig | null;
};

export type PlanFormValues = {
  name: string;
  description: string;
  features: string[];
  monthlyPrice: string;
  yearlyPrice: string;
  currency: SupportedCurrencyCode | '';
  ctaLabel: string;
  featured: boolean;
  displayOrder: number;
  promotion: PromotionFormValues | null;
};

export type PlanFormValidation =
  | { ok: true; values: Omit<PlanDraftValues, 'currency'> & { currency: SupportedCurrencyCode } }
  | { ok: false; errors: Record<string, string> };

const REQUIRED = 'هذا الحقل مطلوب.';
const TOO_LONG = 'النص أطول من الحد المسموح.';

export const planFormInputSchema = z
  .object({
    name: z.string().trim().min(1, REQUIRED).max(PLAN_LIMITS.name, TOO_LONG),
    description: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .max(PLAN_LIMITS.description, TOO_LONG),
    features: z
      .array(z.string().trim().min(1, REQUIRED).max(PLAN_LIMITS.feature, TOO_LONG))
      .max(PLAN_LIMITS.features, 'عدد الميزات أكبر من الحد المسموح.'),
    monthlyPrice: z.string().max(40),
    yearlyPrice: z.string().max(40),
    currency: z.string().min(1, 'اختر عملة الباقة.'),
    ctaLabel: z.string().trim().min(1, REQUIRED).max(PLAN_LIMITS.ctaLabel, TOO_LONG),
    featured: z.boolean(),
    displayOrder: z
      .number()
      .int()
      .min(0, 'ترتيب العرض غير صالح.')
      .max(PLAN_LIMITS.displayOrder, 'ترتيب العرض أكبر من الحد المسموح.'),
    promotion: promotionFormSchema.nullable(),
  })
  .strict();

type PromotionBuildResult =
  | { ok: true; promotion: PromotionConfig | null }
  | { ok: false; errors: Record<string, string> };

function buildPromotionFromForm(
  form: PromotionFormValues | null,
  currency: SupportedCurrencyCode,
  base: { monthlyPriceMinor: number | null; yearlyPriceMinor: number | null },
): PromotionBuildResult {
  if (form === null) return { ok: true, promotion: null };

  const errors: Record<string, string> = {};
  const label = form.label.trim();
  if (!label) errors.label = 'أدخل اسم العرض.';

  const start = cairoLocalDateTimeToInstant(form.startsDate, form.startsTime);
  if (!start.ok) {
    errors.startsDate =
      start.reason === 'nonexistent'
        ? 'هذا الوقت غير موجود بسبب تغيير التوقيت الصيفي. اختر وقتاً آخر.'
        : start.reason === 'ambiguous'
          ? 'هذا الوقت متكرر بسبب تغيير التوقيت الصيفي. اختر وقتاً آخر.'
          : 'أدخل تاريخ ووقت بداية صحيحين.';
  }
  const end = cairoLocalDateTimeToInstant(form.endsDate, form.endsTime);
  if (!end.ok) {
    errors.endsDate =
      end.reason === 'nonexistent'
        ? 'هذا الوقت غير موجود بسبب تغيير التوقيت الصيفي. اختر وقتاً آخر.'
        : end.reason === 'ambiguous'
          ? 'هذا الوقت متكرر بسبب تغيير التوقيت الصيفي. اختر وقتاً آخر.'
          : 'أدخل تاريخ ووقت انتهاء صحيحين.';
  }
  if (start.ok && end.ok && Date.parse(start.iso) >= Date.parse(end.iso)) {
    errors.endsDate = 'يجب أن يكون وقت الانتهاء بعد وقت البداية.';
  }

  let percentageBps: number | null = null;
  let fixedMonthlyMinor: number | null = null;
  let fixedYearlyMinor: number | null = null;

  if (form.discountType === 'percentage') {
    const percentage = parsePercentageInput(form.percentage);
    if (!percentage.ok) errors.percentage = percentage.message;
    else percentageBps = percentage.bps;
  } else {
    if (form.target === 'monthly' || form.target === 'both') {
      const fixed = parsePriceInput(form.fixedMonthly, currency);
      if (!fixed.ok) errors.fixedMonthly = fixed.message;
      else if (fixed.minor === null) errors.fixedMonthly = 'أدخل مبلغ الخصم الشهري.';
      else fixedMonthlyMinor = fixed.minor;
    }
    if (form.target === 'yearly' || form.target === 'both') {
      const fixed = parsePriceInput(form.fixedYearly, currency);
      if (!fixed.ok) errors.fixedYearly = fixed.message;
      else if (fixed.minor === null) errors.fixedYearly = 'أدخل مبلغ الخصم السنوي.';
      else fixedYearlyMinor = fixed.minor;
    }
  }

  if (Object.keys(errors).length > 0 || !start.ok || !end.ok) {
    return { ok: false, errors };
  }

  const promotion: PromotionConfig = {
    enabled: form.enabled,
    label,
    discountType: form.discountType,
    target: form.target,
    percentageBps,
    fixedMonthlyMinor,
    fixedYearlyMinor,
    startsAt: start.iso,
    endsAt: end.iso,
  };

  const promotionErrors = validatePromotionAgainstPrices(promotion, base);
  if (Object.keys(promotionErrors).length > 0) {
    return { ok: false, errors: promotionErrors };
  }

  return { ok: true, promotion };
}

/**
 * Validates and normalizes owner plan input. Currency must be explicit; a
 * yearly price without a monthly price is rejected as an invalid combination.
 */
export function validatePlanForm(raw: unknown): PlanFormValidation {
  const parsed = planFormInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join('.');
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  if (!isSupportedCurrency(parsed.data.currency)) {
    return { ok: false, errors: { currency: 'العملة غير مدعومة.' } };
  }
  const currency = parsed.data.currency;
  const monthly = parsePriceInput(parsed.data.monthlyPrice, currency);
  if (!monthly.ok) {
    return { ok: false, errors: { monthlyPrice: monthly.message } };
  }
  const yearly = parsePriceInput(parsed.data.yearlyPrice, currency);
  if (!yearly.ok) {
    return { ok: false, errors: { yearlyPrice: yearly.message } };
  }
  if (yearly.minor !== null && monthly.minor === null) {
    return {
      ok: false,
      errors: {
        yearlyPrice: 'أضف سعراً شهرياً أولاً، أو اترك السعر السنوي فارغاً.',
      },
    };
  }

  const promotion = buildPromotionFromForm(parsed.data.promotion, currency, {
    monthlyPriceMinor: monthly.minor,
    yearlyPriceMinor: yearly.minor,
  });
  if (!promotion.ok) {
    const errors: Record<string, string> = {};
    for (const [key, message] of Object.entries(promotion.errors)) {
      errors[`promotion.${key}`] = message;
    }
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      name: parsed.data.name,
      description: parsed.data.description,
      features: parsed.data.features,
      monthlyPriceMinor: monthly.minor,
      yearlyPriceMinor: yearly.minor,
      currency,
      ctaLabel: parsed.data.ctaLabel,
      featured: parsed.data.featured,
      displayOrder: parsed.data.displayOrder,
      promotion: promotion.promotion,
    },
  };
}

export type PublicPlan = {
  slug: string;
  name: string;
  description: string;
  features: string[];
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
  currency: SupportedCurrencyCode;
  ctaLabel: string;
  featured: boolean;
  displayOrder: number;
  publishedRevision: number;
  publishedPromotion: PromotionConfig | null;
  offer: OfferResolution;
};

export type PlanPublishedValues = {
  name: string;
  description: string;
  features: string[];
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
  currency: SupportedCurrencyCode;
  ctaLabel: string;
  featured: boolean;
  displayOrder: number;
  promotion: PromotionConfig | null;
};

export type OwnerPlan = {
  id: string;
  slug: string;
  status: PlanStatus;
  revision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  draft: PlanDraftValues;
  published: PlanPublishedValues | null;
};

export function planPriceLabel(plan: {
  monthlyPriceMinor: number | null;
  yearlyPriceMinor: number | null;
  currency: string;
}): string | null {
  const monthly = formatPriceMinor(plan.monthlyPriceMinor, plan.currency);
  const yearly = formatPriceMinor(plan.yearlyPriceMinor, plan.currency);
  return monthly ?? yearly;
}

/**
 * Converts a server-provided public plan into a validated shared view object.
 * Invalid stored data is rejected by callers and never rendered.
 */
export function toPublicPlan(
  input: {
    slug: string;
    name: string;
    description: string;
    features: unknown;
    monthlyPriceMinor: number | null;
    yearlyPriceMinor: number | null;
    currency: string;
    ctaLabel: string;
    featured: boolean;
    displayOrder: number;
    publishedRevision: number;
    publishedPromotion: unknown;
  },
  asOf: Date,
): PublicPlan {
  const features = Array.isArray(input.features)
    ? input.features.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (!isSupportedCurrency(input.currency)) throw new Error('Unsupported currency');
  if (
    typeof input.name !== 'string' ||
    typeof input.description !== 'string' ||
    typeof input.ctaLabel !== 'string' ||
    typeof input.slug !== 'string' ||
    !Number.isSafeInteger(input.monthlyPriceMinor ?? 0) ||
    !Number.isSafeInteger(input.yearlyPriceMinor ?? 0)
  ) {
    throw new Error('Invalid plan');
  }
  const publishedPromotion = parsePromotionConfig(input.publishedPromotion);
  if (publishedPromotion) {
    const promotionErrors = validatePromotionAgainstPrices(publishedPromotion, {
      monthlyPriceMinor: input.monthlyPriceMinor,
      yearlyPriceMinor: input.yearlyPriceMinor,
    });
    if (Object.keys(promotionErrors).length > 0) {
      throw new Error('Invalid published promotion');
    }
  }
  const offer = resolveOffer(
    {
      slug: input.slug,
      publishedRevision: input.publishedRevision,
      currency: input.currency,
      monthlyPriceMinor: input.monthlyPriceMinor,
      yearlyPriceMinor: input.yearlyPriceMinor,
      promotion: publishedPromotion,
    },
    asOf,
  );
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    features,
    monthlyPriceMinor: input.monthlyPriceMinor,
    yearlyPriceMinor: input.yearlyPriceMinor,
    currency: input.currency,
    ctaLabel: input.ctaLabel,
    featured: input.featured,
    displayOrder: input.displayOrder,
    publishedRevision: input.publishedRevision,
    publishedPromotion,
    offer,
  };
}

export function promotionFormValuesFromConfig(
  config: PromotionConfig | null,
  currency: SupportedCurrencyCode,
): PromotionFormValues | null {
  if (!config) return null;
  const start = cairoDateTimeInputs(config.startsAt);
  const end = cairoDateTimeInputs(config.endsAt);
  return {
    enabled: config.enabled,
    label: config.label,
    discountType: config.discountType,
    target: config.target,
    percentage: formatPercentageInput(config.percentageBps),
    fixedMonthly: priceInputFromMinor(config.fixedMonthlyMinor, currency),
    fixedYearly: priceInputFromMinor(config.fixedYearlyMinor, currency),
    startsDate: start.date,
    startsTime: start.time,
    endsDate: end.date,
    endsTime: end.time,
  };
}

export function emptyPlanFormValues(): PlanFormValues {
  return {
    name: '',
    description: '',
    features: [],
    monthlyPrice: '',
    yearlyPrice: '',
    currency: '',
    ctaLabel: 'اطلب الانضمام',
    featured: false,
    displayOrder: 0,
    promotion: null,
  };
}

export function planFormValuesFromOwnerPlan(plan: OwnerPlan): PlanFormValues {
  return {
    name: plan.draft.name,
    description: plan.draft.description,
    features: [...plan.draft.features],
    monthlyPrice: priceInputFromMinor(plan.draft.monthlyPriceMinor, plan.draft.currency),
    yearlyPrice: priceInputFromMinor(plan.draft.yearlyPriceMinor, plan.draft.currency),
    currency: plan.draft.currency,
    ctaLabel: plan.draft.ctaLabel,
    featured: plan.draft.featured,
    displayOrder: plan.draft.displayOrder,
    promotion: promotionFormValuesFromConfig(plan.draft.promotion, plan.draft.currency),
  };
}

export function planDraftToPublic(plan: OwnerPlan, asOf: Date): PublicPlan {
  const offer = resolveOffer(
    {
      slug: plan.slug,
      publishedRevision: plan.revision,
      currency: plan.draft.currency,
      monthlyPriceMinor: plan.draft.monthlyPriceMinor,
      yearlyPriceMinor: plan.draft.yearlyPriceMinor,
      promotion: plan.draft.promotion,
    },
    asOf,
  );
  return {
    slug: plan.slug,
    name: plan.draft.name,
    description: plan.draft.description,
    features: plan.draft.features,
    monthlyPriceMinor: plan.draft.monthlyPriceMinor,
    yearlyPriceMinor: plan.draft.yearlyPriceMinor,
    currency: plan.draft.currency,
    ctaLabel: plan.draft.ctaLabel,
    featured: plan.draft.featured,
    displayOrder: plan.draft.displayOrder,
    publishedRevision: plan.revision,
    publishedPromotion: plan.draft.promotion,
    offer,
  };
}

export { emptyPromotionFormValues, promotionConfigSchema, resolveOffer };
