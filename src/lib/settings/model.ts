import { z } from 'zod';
import { normalizeDigits } from '@/lib/plans/promotion';

/**
 * Owner-managed website settings domain model (W5).
 *
 * One small typed model with explicit allowlisted fields. There is no generic
 * key/value editor. Public fields (verified contact/social destinations) are
 * projected separately from private integration preferences. Bot tokens and GA
 * credentials are server environment variables and are never part of this
 * model or of any public/client payload.
 */

export const SETTINGS_ROW_ID = 'default';

export const SETTINGS_LIMITS = {
  email: 254,
  phone: 20,
  url: 500,
  chatId: 20,
  revision: 1_000_000,
} as const;

export type SettingsStorageStatus =
  | 'ok'
  | 'unconfigured'
  | 'not_migrated'
  | 'unavailable';

export type PublicSettings = {
  contactEmail: string | null;
  contactPhone: string | null;
  contactTelegramUrl: string | null;
  contactWhatsappUrl: string | null;
  socialInstagramUrl: string | null;
  socialFacebookUrl: string | null;
  socialXUrl: string | null;
};

export const EMPTY_PUBLIC_SETTINGS: PublicSettings = {
  contactEmail: null,
  contactPhone: null,
  contactTelegramUrl: null,
  contactWhatsappUrl: null,
  socialInstagramUrl: null,
  socialFacebookUrl: null,
  socialXUrl: null,
};

export type PublicChannelType =
  | 'email'
  | 'phone'
  | 'telegram'
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'x';

export type PublicChannel = {
  type: PublicChannelType;
  label: string;
  value: string;
  href: string;
};

const CHANNEL_LABELS: Record<PublicChannelType, string> = {
  email: 'البريد الإلكتروني',
  phone: 'الهاتف',
  telegram: 'تيليجرام',
  whatsapp: 'واتساب',
  instagram: 'إنستغرام',
  facebook: 'فيسبوك',
  x: 'X',
};

export function publicSettingsChannels(settings: PublicSettings): PublicChannel[] {
  const channels: PublicChannel[] = [];
  if (settings.contactEmail) {
    channels.push({
      type: 'email',
      label: CHANNEL_LABELS.email,
      value: settings.contactEmail,
      href: `mailto:${settings.contactEmail}`,
    });
  }
  if (settings.contactPhone) {
    channels.push({
      type: 'phone',
      label: CHANNEL_LABELS.phone,
      value: settings.contactPhone,
      href: `tel:${settings.contactPhone.replace(/\s+/g, '')}`,
    });
  }
  const urls: Array<[PublicChannelType, string | null]> = [
    ['telegram', settings.contactTelegramUrl],
    ['whatsapp', settings.contactWhatsappUrl],
    ['instagram', settings.socialInstagramUrl],
    ['facebook', settings.socialFacebookUrl],
    ['x', settings.socialXUrl],
  ];
  for (const [type, url] of urls) {
    if (!url) continue;
    channels.push({
      type,
      label: CHANNEL_LABELS[type],
      value: publicDestinationLabel(type, url),
      href: url,
    });
  }
  return channels;
}

function publicDestinationLabel(type: PublicChannelType, url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/+|\/+$/g, '');
    if (!path) return parsed.host;
    return `@${path.split('/').filter(Boolean).pop() ?? path}`;
  } catch {
    return type;
  }
}

export type PublicSettingsFormValues = {
  contactEmail: string;
  contactPhone: string;
  contactTelegramUrl: string;
  contactWhatsappUrl: string;
  socialInstagramUrl: string;
  socialFacebookUrl: string;
  socialXUrl: string;
};

export const emptyPublicSettingsForm = (): PublicSettingsFormValues => ({
  contactEmail: '',
  contactPhone: '',
  contactTelegramUrl: '',
  contactWhatsappUrl: '',
  socialInstagramUrl: '',
  socialFacebookUrl: '',
  socialXUrl: '',
});

export function publicSettingsFormFrom(settings: PublicSettings): PublicSettingsFormValues {
  return {
    contactEmail: settings.contactEmail ?? '',
    contactPhone: settings.contactPhone ?? '',
    contactTelegramUrl: settings.contactTelegramUrl ?? '',
    contactWhatsappUrl: settings.contactWhatsappUrl ?? '',
    socialInstagramUrl: settings.socialInstagramUrl ?? '',
    socialFacebookUrl: settings.socialFacebookUrl ?? '',
    socialXUrl: settings.socialXUrl ?? '',
  };
}

export type ValidationResult<T> =
  | { ok: true; values: T }
  | { ok: false; errors: Record<string, string> };

const publicInputSchema = z
  .object({
    contactEmail: z.string().max(SETTINGS_LIMITS.email * 2),
    contactPhone: z.string().max(40),
    contactTelegramUrl: z.string().max(SETTINGS_LIMITS.url * 2),
    contactWhatsappUrl: z.string().max(SETTINGS_LIMITS.url * 2),
    socialInstagramUrl: z.string().max(SETTINGS_LIMITS.url * 2),
    socialFacebookUrl: z.string().max(SETTINGS_LIMITS.url * 2),
    socialXUrl: z.string().max(SETTINGS_LIMITS.url * 2),
  })
  .strict();

type ProviderRule = {
  hosts: readonly string[];
  path: (pathname: string) => boolean;
};

const PROVIDER_RULES: Record<
  Exclude<PublicChannelType, 'email' | 'phone'>,
  ProviderRule
> = {
  telegram: {
    hosts: ['t.me', 'telegram.me'],
    path: (path) => /^\/[A-Za-z0-9_]{3,64}$/.test(path),
  },
  whatsapp: {
    hosts: ['wa.me'],
    path: (path) => /^\/[0-9]{6,20}$/.test(path),
  },
  instagram: {
    hosts: ['instagram.com', 'www.instagram.com'],
    path: (path) => /^\/[A-Za-z0-9._]{1,30}$/.test(path),
  },
  facebook: {
    hosts: ['facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com'],
    path: (path) => /^\/[A-Za-z0-9._-]{1,80}$/.test(path),
  },
  x: {
    hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
    path: (path) => /^\/[A-Za-z0-9_]{1,30}$/.test(path),
  },
};

export type UrlValidationResult =
  | { ok: true; url: string | null }
  | { ok: false; message: string };

/**
 * Strict public link validation. Only HTTPS destinations on the expected
 * provider host are accepted; embedded credentials, custom ports, queries,
 * fragments, javascript:/data: schemes and arbitrary external hosts are
 * rejected. Empty input means "not configured".
 */
export function validatePublicUrl(
  raw: unknown,
  type: Exclude<PublicChannelType, 'email' | 'phone'>,
): UrlValidationResult {
  if (typeof raw !== 'string') return { ok: false, message: 'الرابط غير صالح.' };
  const value = raw.trim();
  if (value === '') return { ok: true, url: null };
  if (value.length > SETTINGS_LIMITS.url) {
    return { ok: false, message: 'الرابط أطول من الحد المسموح.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: 'أدخل رابطاً كاملاً يبدأ بـ https://' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, message: 'يجب أن يبدأ الرابط بـ https://' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: 'لا يُسمح برابط يحتوي على بيانات دخول.' };
  }
  if (parsed.port) {
    return { ok: false, message: 'لا يُسمح بمنفذ مخصص في الرابط.' };
  }
  if (parsed.search || parsed.hash) {
    return { ok: false, message: 'أزل معاملات الاستعلام أو الجزء الأخير من الرابط.' };
  }
  const host = parsed.hostname.toLowerCase();
  const rule = PROVIDER_RULES[type];
  if (!rule.hosts.includes(host)) {
    return {
      ok: false,
      message: `استخدم رابطاً من النطاق الرسمي (${rule.hosts[0]}).`,
    };
  }
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  if (!rule.path(pathname)) {
    return { ok: false, message: 'مسار الرابط غير صالح لهذه الخدمة.' };
  }
  return { ok: true, url: `https://${host}${pathname}` };
}

export function normalizeContactPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = normalizeDigits(raw)
    .trim()
    .replace(/[\s().-]+/g, '');
  if (!normalized) return null;
  if (!/^\+?[0-9]{8,15}$/.test(normalized)) return null;
  return normalized;
}

export function validatePublicSettingsInput(
  raw: unknown,
): ValidationResult<PublicSettings> {
  const parsed = publicInputSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.map(String).join('.')] ??= 'قيمة غير صالحة.';
    }
    return { ok: false, errors };
  }
  const errors: Record<string, string> = {};
  const values = { ...parsed.data };

  let contactEmail: string | null = null;
  const emailRaw = values.contactEmail.trim();
  if (emailRaw) {
    if (emailRaw.length > SETTINGS_LIMITS.email) {
      errors.contactEmail = 'البريد الإلكتروني أطول من الحد المسموح.';
    } else {
      const email = z.string().email().safeParse(emailRaw);
      if (!email.success) {
        errors.contactEmail = 'أدخل بريداً إلكترونياً صالحاً.';
      } else {
        contactEmail = emailRaw;
      }
    }
  }

  let contactPhone: string | null = null;
  const phoneRaw = values.contactPhone;
  if (phoneRaw.trim()) {
    contactPhone = normalizeContactPhone(phoneRaw);
    if (!contactPhone) {
      errors.contactPhone = 'أدخل رقم هاتف صالحاً (8–15 رقماً مع رمز الدولة).';
    }
  }

  const urlFields = [
    ['contactTelegramUrl', 'telegram'],
    ['contactWhatsappUrl', 'whatsapp'],
    ['socialInstagramUrl', 'instagram'],
    ['socialFacebookUrl', 'facebook'],
    ['socialXUrl', 'x'],
  ] as const;
  const urls: Record<string, string | null> = {};
  for (const [field, type] of urlFields) {
    const result = validatePublicUrl(values[field], type);
    if (!result.ok) {
      errors[field] = result.message;
    } else {
      urls[field] = result.url;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    values: {
      contactEmail,
      contactPhone,
      contactTelegramUrl: urls.contactTelegramUrl ?? null,
      contactWhatsappUrl: urls.contactWhatsappUrl ?? null,
      socialInstagramUrl: urls.socialInstagramUrl ?? null,
      socialFacebookUrl: urls.socialFacebookUrl ?? null,
      socialXUrl: urls.socialXUrl ?? null,
    },
  };
}

export function isValidTelegramChatId(raw: unknown): raw is string {
  return typeof raw === 'string' && /^[0-9]{1,20}$/.test(raw);
}

export function maskTelegramChatId(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.length <= 4) return '••••';
  return `••••${raw.slice(-4)}`;
}

export type NotificationSettingsValues = {
  notificationsEnabled: boolean;
  telegramChatId: string | null;
};

export function validateNotificationSettingsInput(
  raw: unknown,
): ValidationResult<NotificationSettingsValues> {
  const parsed = z
    .object({
      notificationsEnabled: z.boolean(),
      telegramChatId: z.string().max(SETTINGS_LIMITS.chatId * 2),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: { form: 'بيانات الإشعارات غير صالحة.' } };
  }
  const chatId = parsed.data.telegramChatId.trim();
  if (chatId && !isValidTelegramChatId(chatId)) {
    return {
      ok: false,
      errors: {
        telegramChatId:
          'أدخل معرّف المحادثة الرقمي للدردشة الخاصة (أرقام فقط).',
      },
    };
  }
  if (parsed.data.notificationsEnabled && !chatId) {
    return {
      ok: false,
      errors: {
        telegramChatId:
          'أضف معرّف المحادثة الخاصة أولاً قبل تفعيل إشعارات المالك.',
      },
    };
  }
  return {
    ok: true,
    values: {
      notificationsEnabled: parsed.data.notificationsEnabled,
      telegramChatId: chatId || null,
    },
  };
}

export type AnalyticsSettingsValues = { analyticsEnabled: boolean };

export function validateAnalyticsSettingsInput(
  raw: unknown,
): ValidationResult<AnalyticsSettingsValues> {
  const parsed = z
    .object({ analyticsEnabled: z.boolean() })
    .strict()
    .safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: { form: 'بيانات التحليلات غير صالحة.' } };
  }
  return { ok: true, values: { analyticsEnabled: parsed.data.analyticsEnabled } };
}

function nullableString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function safeEmail(value: unknown): string | null {
  const candidate = nullableString(value, SETTINGS_LIMITS.email);
  if (!candidate) return null;
  return z.string().email().safeParse(candidate).success ? candidate : null;
}

function safePhone(value: unknown): string | null {
  const candidate = nullableString(value, SETTINGS_LIMITS.phone);
  if (!candidate) return null;
  return /^\+?[0-9]{8,15}$/.test(candidate) ? candidate : null;
}

function safeUrl(
  value: unknown,
  type: Exclude<PublicChannelType, 'email' | 'phone'>,
): string | null {
  const result = validatePublicUrl(value, type);
  return result.ok ? result.url : null;
}

/**
 * Defensive read projection: stored public values are re-validated so an
 * invalid legacy row can never become an unsafe public link. Invalid fields are
 * treated as not configured.
 */
export function projectPublicSettings(raw: {
  contactEmail?: unknown;
  contactPhone?: unknown;
  contactTelegramUrl?: unknown;
  contactWhatsappUrl?: unknown;
  socialInstagramUrl?: unknown;
  socialFacebookUrl?: unknown;
  socialXUrl?: unknown;
} | null | undefined): PublicSettings {
  if (!raw) return { ...EMPTY_PUBLIC_SETTINGS };
  return {
    contactEmail: safeEmail(raw.contactEmail),
    contactPhone: safePhone(raw.contactPhone),
    contactTelegramUrl: safeUrl(raw.contactTelegramUrl, 'telegram'),
    contactWhatsappUrl: safeUrl(raw.contactWhatsappUrl, 'whatsapp'),
    socialInstagramUrl: safeUrl(raw.socialInstagramUrl, 'instagram'),
    socialFacebookUrl: safeUrl(raw.socialFacebookUrl, 'facebook'),
    socialXUrl: safeUrl(raw.socialXUrl, 'x'),
  };
}

export function assertRevision(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > SETTINGS_LIMITS.revision
  ) {
    throw new Error('Invalid settings revision');
  }
  return value;
}
