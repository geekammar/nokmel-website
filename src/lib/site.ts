import { z } from 'zod';

export const siteSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().min(1),
  domain: z.string().regex(/^[a-z0-9.-]+$/i),
  defaultLocale: z.enum(['ar']),
  ctaLabel: z.string().min(1),
});

export type Site = z.infer<typeof siteSchema>;

export const site: Site = siteSchema.parse({
  name: 'Nokmel',
  nameAr: 'نكمّل',
  domain: 'nokmel.tech',
  defaultLocale: 'ar',
  ctaLabel: 'اطلب الانضمام',
});

export const siteUrl = `https://${site.domain}`;
