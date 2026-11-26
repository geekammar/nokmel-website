import { z } from 'zod';
import { SEO_PAGE_DEFAULTS, type SeoPageDefaults } from '@/content/ar/seo';
import {
  DEFAULT_SOCIAL_IMAGE_ID,
  SOCIAL_IMAGE_IDS,
  getSocialImage,
  type SocialImageAsset,
  type SocialImageId,
} from '@/content/cms/social-images';
import { getPageDefinition, type CmsPageKey } from './registry';

export const CMS_SEO_SECTION_KEY = 'seo';

export const CMS_SEO_LIMITS = {
  title: 200,
  description: 500,
} as const;

export const SEO_EDITORIAL_GUIDANCE = {
  titleMin: 50,
  titleMax: 60,
  descriptionMin: 120,
  descriptionMax: 160,
} as const;

const REQUIRED_TEXT = 'هذا الحقل مطلوب.';
const TOO_LONG = 'النص أطول من الحد المسموح.';

export type SeoStoredValues = {
  title: string;
  description: string;
  socialTitle?: string;
  socialDescription?: string;
  socialImage?: SocialImageId;
};

export type SeoFormValues = {
  title: string;
  description: string;
  socialTitle: string;
  socialDescription: string;
  socialImage: SocialImageId | '';
};

export type EffectiveSeo = {
  title: string;
  description: string;
  socialTitle: string;
  socialDescription: string;
  socialTitleInherited: boolean;
  socialDescriptionInherited: boolean;
  socialImageId: SocialImageId;
  image: SocialImageAsset;
};

export type SeoStoredParseResult =
  | { ok: true; value: SeoStoredValues }
  | { ok: false };

const optionalStoredText = (maxLength: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().max(maxLength, TOO_LONG).optional());

const optionalStoredImage = z.preprocess(
  (value) => (value === null || value === '' ? undefined : value),
  z.enum(SOCIAL_IMAGE_IDS).optional(),
);

export const seoStoredSchema = z
  .object({
    title: z
      .string({ required_error: REQUIRED_TEXT })
      .trim()
      .min(1, REQUIRED_TEXT)
      .max(CMS_SEO_LIMITS.title, TOO_LONG),
    description: z
      .string({ required_error: REQUIRED_TEXT })
      .trim()
      .min(1, REQUIRED_TEXT)
      .max(CMS_SEO_LIMITS.description, TOO_LONG),
    socialTitle: optionalStoredText(CMS_SEO_LIMITS.title),
    socialDescription: optionalStoredText(CMS_SEO_LIMITS.description),
    socialImage: optionalStoredImage,
  })
  .strict();

export const seoFormSchema = z
  .object({
    title: z
      .string({ required_error: REQUIRED_TEXT })
      .trim()
      .min(1, REQUIRED_TEXT)
      .max(CMS_SEO_LIMITS.title, TOO_LONG),
    description: z
      .string({ required_error: REQUIRED_TEXT })
      .trim()
      .min(1, REQUIRED_TEXT)
      .max(CMS_SEO_LIMITS.description, TOO_LONG),
    socialTitle: z.string().trim().max(CMS_SEO_LIMITS.title, TOO_LONG),
    socialDescription: z.string().trim().max(CMS_SEO_LIMITS.description, TOO_LONG),
    socialImage: z.union([
      z.literal(''),
      z.enum(SOCIAL_IMAGE_IDS),
    ]),
  })
  .strict();

export function getPageSeoDefaults(pageKey: CmsPageKey): SeoPageDefaults {
  getPageDefinition(pageKey);
  return SEO_PAGE_DEFAULTS[pageKey];
}

export function parseStoredSeo(value: unknown): SeoStoredParseResult {
  const result = seoStoredSchema.safeParse(value);
  if (!result.success) return { ok: false };
  return {
    ok: true,
    value: {
      title: result.data.title,
      description: result.data.description,
      ...(result.data.socialTitle ? { socialTitle: result.data.socialTitle } : {}),
      ...(result.data.socialDescription
        ? { socialDescription: result.data.socialDescription }
        : {}),
      ...(result.data.socialImage ? { socialImage: result.data.socialImage } : {}),
    },
  };
}

export function buildSeoPayloadFromForm(value: unknown): SeoStoredValues {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : value;
  const normalized =
    source && typeof source === 'object' && !Array.isArray(source)
      ? {
          ...(source as Record<string, unknown>),
          socialTitle: (source as Record<string, unknown>).socialTitle ?? '',
          socialDescription: (source as Record<string, unknown>).socialDescription ?? '',
          socialImage: (source as Record<string, unknown>).socialImage ?? '',
        }
      : source;
  const form = seoFormSchema.parse(normalized);
  const parsed = seoStoredSchema.parse({
    title: form.title,
    description: form.description,
    socialTitle: form.socialTitle,
    socialDescription: form.socialDescription,
    socialImage: form.socialImage,
  });
  return {
    title: parsed.title,
    description: parsed.description,
    ...(parsed.socialTitle ? { socialTitle: parsed.socialTitle } : {}),
    ...(parsed.socialDescription ? { socialDescription: parsed.socialDescription } : {}),
    ...(parsed.socialImage ? { socialImage: parsed.socialImage } : {}),
  };
}

export function seoFormValuesFromStored(
  pageKey: CmsPageKey,
  stored: SeoStoredValues | null,
): SeoFormValues {
  const defaults = getPageSeoDefaults(pageKey);
  return {
    title: stored?.title ?? defaults.title,
    description: stored?.description ?? defaults.description,
    socialTitle: stored?.socialTitle ?? '',
    socialDescription: stored?.socialDescription ?? '',
    socialImage: stored?.socialImage ?? '',
  };
}

export function resolveEffectiveSeo(
  pageKey: CmsPageKey,
  stored: SeoStoredValues | null,
): EffectiveSeo {
  const defaults = getPageSeoDefaults(pageKey);
  const title = stored?.title ?? defaults.title;
  const description = stored?.description ?? defaults.description;
  const socialImageId = stored?.socialImage ?? DEFAULT_SOCIAL_IMAGE_ID;
  return {
    title,
    description,
    socialTitle: stored?.socialTitle ?? title,
    socialDescription: stored?.socialDescription ?? description,
    socialTitleInherited: !stored?.socialTitle,
    socialDescriptionInherited: !stored?.socialDescription,
    socialImageId,
    image: getSocialImage(socialImageId),
  };
}

export function resolveEffectiveSeoFromForm(
  pageKey: CmsPageKey,
  form: SeoFormValues,
): EffectiveSeo {
  const parsed = seoFormSchema.safeParse(form);
  if (!parsed.success) return resolveEffectiveSeo(pageKey, null);
  return resolveEffectiveSeo(pageKey, buildSeoPayloadFromForm(parsed.data));
}
