import { z } from 'zod';
import { planSlugSchema } from '@/lib/plans/model';

/**
 * Public join-intake validation (W4). Pure module shared by the browser form
 * and the server route so both apply identical normalization. No database or
 * Node-only imports are allowed here.
 */

export const JOIN_LIMITS = {
  name: 120,
  phone: 40,
  email: 254,
  businessActivity: 1000,
  source: 20,
  utm: 100,
  submissionToken: 100,
  planSlug: 60,
} as const;

export const JOIN_SOURCES = ['direct', 'pricing', 'join'] as const;
export type JoinSource = (typeof JOIN_SOURCES)[number];

export type CountryCallingCode = {
  code: string;
  label: string;
  callingCode: string;
};

export const COUNTRY_CALLING_CODES: readonly CountryCallingCode[] = [
  { code: 'EG', label: 'مصر', callingCode: '+20' },
  { code: 'SA', label: 'السعودية', callingCode: '+966' },
  { code: 'AE', label: 'الإمارات', callingCode: '+971' },
  { code: 'KW', label: 'الكويت', callingCode: '+965' },
  { code: 'QA', label: 'قطر', callingCode: '+974' },
  { code: 'JO', label: 'الأردن', callingCode: '+962' },
  { code: 'BH', label: 'البحرين', callingCode: '+973' },
  { code: 'OM', label: 'عمان', callingCode: '+968' },
  { code: 'MA', label: 'المغرب', callingCode: '+212' },
  { code: 'DZ', label: 'الجزائر', callingCode: '+213' },
  { code: 'TN', label: 'تونس', callingCode: '+216' },
  { code: 'IQ', label: 'العراق', callingCode: '+964' },
  { code: 'LY', label: 'ليبيا', callingCode: '+218' },
  { code: 'SD', label: 'السودان', callingCode: '+249' },
  { code: 'SY', label: 'سوريا', callingCode: '+963' },
  { code: 'YE', label: 'اليمن', callingCode: '+967' },
  { code: 'PS', label: 'فلسطين', callingCode: '+970' },
] as const;

const COUNTRY_BY_CODE = new Map(
  COUNTRY_CALLING_CODES.map((country) => [country.code, country]),
);
const CALLING_CODES = new Set(
  COUNTRY_CALLING_CODES.map((country) => country.callingCode),
);

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;

export function normalizeDigits(value: string): string {
  return value
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    );
}

export type PhoneNormalization =
  | { ok: true; phone: string }
  | { ok: false; message: string };

/**
 * Normalizes a phone number to E.164 digits. Arabic-Indic digits are accepted.
 * A local number requires an explicit country calling code; no country is
 * guessed when the number is ambiguous.
 */
export function normalizePhone(
  rawPhone: string,
  rawCountryCode?: string | null,
): PhoneNormalization {
  const cleaned = normalizeDigits(String(rawPhone ?? ''))
    .replace(/[\s\u00a0\u200e\u200f\-().\u2010-\u2015]/g, '')
    .trim();
  if (!cleaned) {
    return { ok: false, message: 'رقم الهاتف مطلوب.' };
  }
  if (!/^[+0-9]+$/.test(cleaned)) {
    return { ok: false, message: 'استخدم أرقام الهاتف فقط، مع رمز الدولة عند الحاجة.' };
  }

  let international: string;
  if (cleaned.startsWith('+')) {
    international = cleaned;
  } else if (cleaned.startsWith('00')) {
    international = `+${cleaned.slice(2)}`;
  } else {
    const countryCode = String(rawCountryCode ?? '').trim();
    if (!countryCode) {
      return {
        ok: false,
        message: 'اختر رمز الدولة، أو أدخل الرقم بصيغة دولية تبدأ بـ +.',
      };
    }
    const byIso = COUNTRY_BY_CODE.get(countryCode.toUpperCase());
    const normalizedCallingCode = normalizeDigits(
      byIso?.callingCode ?? countryCode,
    ).replace(/^\+/, '');
    const selected = `+${normalizedCallingCode}`;
    if (!CALLING_CODES.has(selected)) {
      return { ok: false, message: 'رمز الدولة غير مدعوم.' };
    }
    const national = cleaned.replace(/^0+/, '');
    if (!national) {
      return { ok: false, message: 'رقم الهاتف غير صالح.' };
    }
    international = `${selected}${national}`;
  }

  if (!/^\+[1-9]\d{6,14}$/.test(international)) {
    return {
      ok: false,
      message: 'رقم الهاتف غير صالح. أدخله بصيغة دولية صحيحة مع رمز الدولة.',
    };
  }
  return { ok: true, phone: international };
}

export function countryByCode(code: string | null | undefined): CountryCallingCode | null {
  if (!code) return null;
  return COUNTRY_BY_CODE.get(code) ?? null;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const UTM_PATTERN = /^[A-Za-z0-9._~+-]{1,100}$/;

function optionalText(max: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().max(max, 'النص أطول من الحد المسموح.').optional(),
  );
}

function optionalUtm() {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed || !UTM_PATTERN.test(trimmed)) return undefined;
    return trimmed;
  }, z.string().max(JOIN_LIMITS.utm).optional());
}

function optionalSource() {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return (JOIN_SOURCES as readonly string[]).includes(trimmed) ? trimmed : undefined;
  }, z.enum(JOIN_SOURCES).optional());
}

export const joinSubmissionInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'أدخل الاسم الكامل.')
      .max(JOIN_LIMITS.name, 'الاسم أطول من الحد المسموح.')
      .refine((value) => !CONTROL_CHARS.test(value), 'الاسم يحتوي رموزاً غير صالحة.'),
    phone: z
      .string()
      .max(JOIN_LIMITS.phone, 'رقم الهاتف أطول من الحد المسموح.')
      .min(1, 'رقم الهاتف مطلوب.'),
    countryCode: z.string().max(8).optional(),
    email: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed === '' ? undefined : trimmed.toLowerCase();
      },
      z
        .string()
        .email('أدخل بريداً إلكترونياً صالحاً أو اتركه فارغاً.')
        .max(JOIN_LIMITS.email, 'البريد الإلكتروني أطول من الحد المسموح.')
        .optional(),
    ),
    businessActivity: optionalText(JOIN_LIMITS.businessActivity),
    planSlug: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed === '' ? undefined : trimmed;
      },
      planSlugSchema.optional(),
    ),
    planRevision: z
      .number()
      .int('إصدار الخطة غير صالح.')
      .min(0, 'إصدار الخطة غير صالح.')
      .max(1_000_000, 'إصدار الخطة غير صالح.')
      .optional(),
    source: optionalSource(),
    utmSource: optionalUtm(),
    utmMedium: optionalUtm(),
    utmCampaign: optionalUtm(),
    submissionToken: z
      .string()
      .trim()
      .min(16, 'رمز الإرسال غير صالح.')
      .max(JOIN_LIMITS.submissionToken, 'رمز الإرسال غير صالح.')
      .regex(/^[A-Za-z0-9_-]+$/, 'رمز الإرسال غير صالح.'),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.planSlug && value.planRevision === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['planRevision'],
        message: 'إصدار الخطة مطلوب عند اختيار خطة.',
      });
    }
    if (!value.planSlug && value.planRevision !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['planSlug'],
        message: 'اختر خطة صالحة أو أزل اختيار الخطة.',
      });
    }
  });

export type JoinSubmission = {
  name: string;
  phone: string;
  email: string | null;
  businessActivity: string | null;
  planSlug: string | null;
  planRevision: number | null;
  source: JoinSource;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  submissionToken: string;
};

export type JoinValidationResult =
  | { ok: true; submission: JoinSubmission }
  | { ok: false; errors: Record<string, string> };

export function parseJoinSubmission(raw: unknown): JoinValidationResult {
  const parsed = joinSubmissionInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join('.') || 'form';
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const phone = normalizePhone(parsed.data.phone, parsed.data.countryCode);
  if (!phone.ok) {
    return { ok: false, errors: { phone: phone.message } };
  }
  return {
    ok: true,
    submission: {
      name: parsed.data.name,
      phone: phone.phone,
      email: parsed.data.email ?? null,
      businessActivity: parsed.data.businessActivity ?? null,
      planSlug: parsed.data.planSlug ?? null,
      planRevision: parsed.data.planRevision ?? null,
      source: parsed.data.source ?? 'direct',
      utmSource: parsed.data.utmSource ?? null,
      utmMedium: parsed.data.utmMedium ?? null,
      utmCampaign: parsed.data.utmCampaign ?? null,
      submissionToken: parsed.data.submissionToken,
    },
  };
}

export function sanitizeJoinSource(
  value: string | string[] | undefined | null,
): JoinSource {
  if (typeof value !== 'string') return 'direct';
  return (JOIN_SOURCES as readonly string[]).includes(value)
    ? (value as JoinSource)
    : 'direct';
}

export function sanitizeUtmValue(
  value: string | string[] | undefined | null,
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > JOIN_LIMITS.utm || !UTM_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function sanitizePlanQuery(
  value: string | string[] | undefined | null,
): string | null {
  if (typeof value !== 'string') return null;
  const parsed = planSlugSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
