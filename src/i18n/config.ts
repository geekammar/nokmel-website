export const locales = ['ar'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ar';

export const dirByLocale: Record<Locale, 'rtl' | 'ltr'> = {
  ar: 'rtl',
};
