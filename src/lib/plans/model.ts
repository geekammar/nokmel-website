import { z } from 'zod';

/**
 * Marketing-plan domain model (W4).
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
  priceMinor: 9_999_999_999,
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

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;

export function normalizeNumericInputDigits(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

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
  const normalized = normalizeNumericInputDigits(String(raw ?? ''))
    .replace(/[\u066C\u060C\s]/g, '')
    .replace(/\u066B/g, '.')
    .trim();
  if (normalized === '') return { ok: true, minor: null };
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return { ok: false, message: 'أدخل مبلغاً رقمياً صالحاً بدون رموز أو فواصل آلاف.' };
  }
  const [integerDigits, fractionDigits = ''] = normalized.split('.');
  const exponent = currencyDefinition(currency).exponent;
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
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > PLAN_LIMITS.priceMinor) {
    return { ok: false, message: 'المبلغ أكبر من الحد المسموح.' };
  }
  return { ok: true, minor };
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
  })
  .strict();

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
export function toPublicPlan(input: {
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
}): PublicPlan {
  const features = Array.isArray(input.features)
    ? input.features.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (!isSupportedCurrency(input.currency)) throw new Error('Unsupported currency');
  if (
    typeof input.name !== 'string' ||
    typeof input.description !== 'string' ||
    typeof input.ctaLabel !== 'string' ||
    typeof input.slug !== 'string'
  ) {
    throw new Error('Invalid plan');
  }
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
  };
}

export function planDraftToPublic(plan: OwnerPlan): PublicPlan {
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
  };
}
