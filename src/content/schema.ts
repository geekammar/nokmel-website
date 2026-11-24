import { z } from 'zod';

export const publicRoutes = [
  '/',
  '/features',
  '/pricing',
  '/join',
  '/contact',
  '/privacy',
  '/terms',
] as const;

export type PublicRoute = (typeof publicRoutes)[number];

export const publicPathSchema = z.enum(publicRoutes);

/**
 * Availability status of a documented capability.
 *
 * `available` is reserved for verified, shipped functionality. Nothing in W2
 * qualifies: content may only use `direction` (early-access product direction,
 * Telegram-first) or `planned` (later phases).
 */
export const capabilityStatusSchema = z.enum(['available', 'direction', 'planned']);
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;

export const textItemSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});
export type TextItem = z.infer<typeof textItemSchema>;

export const capabilityItemSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  status: capabilityStatusSchema,
  groupTitle: z.string().min(1),
});
export type CapabilityItem = z.infer<typeof capabilityItemSchema>;

export const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
export type FaqItem = z.infer<typeof faqItemSchema>;

export const ctaLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});
export type CtaLink = z.infer<typeof ctaLinkSchema>;

export const joinFieldTypeSchema = z.enum(['text', 'tel', 'email', 'textarea']);

export const joinFieldSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, 'field id must be a stable slug'),
  name: z
    .string()
    .min(1)
    .regex(/^[a-z][a-zA-Z0-9]*$/, 'field name must be a simple identifier'),
  label: z.string().min(1),
  type: joinFieldTypeSchema,
  required: z.boolean(),
  autoComplete: z.enum(['name', 'tel', 'email']).optional(),
  placeholder: z.string().optional(),
});
export type JoinField = z.infer<typeof joinFieldSchema>;

export const legalSectionSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
});
export type LegalSection = z.infer<typeof legalSectionSchema>;
