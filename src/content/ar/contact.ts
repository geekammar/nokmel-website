import { z } from 'zod';
import { ctaLinkSchema } from '../schema';

export const contactContentSchema = z.object({
  hero: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
  }),
  channelsTitle: z.string().min(1),
  channels: z.array(
    z.object({
      type: z.enum(['email', 'telegram', 'other']),
      label: z.string().min(1),
      value: z.string().min(1),
      href: z.string().min(1),
    }),
  ),
  emptyNote: z.string().min(1),
  joinSuggestion: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    primaryCta: ctaLinkSchema,
  }),
});

export type ContactContent = z.infer<typeof contactContentSchema>;

export const contact: ContactContent = contactContentSchema.parse({
  hero: {
    title: 'تواصل معنا',
    lead: 'هنا ستُنشر وسائل التواصل الرسمية الخاصة بموقع نكمّل.',
  },
  channelsTitle: 'وسائل التواصل',
  channels: [],
  emptyNote:
    'لم تُحدَّد وسائل التواصل الرسمية بعد. عندما يعتمدها مالك الموقع، ستُنشر هنا (بريد إلكتروني أو حساب رسمي معتمد). تجنّب أي وسيلة تواصل لا تظهر على هذه الصفحة.',
  joinSuggestion: {
    title: 'تريد تجربة نكمّل مبكراً؟',
    body: 'إذا كان هدفك الانضمام المبكر، أسرع طريق هو نموذج الانضمام وليس صفحة التواصل.',
    primaryCta: { label: 'اطلب الانضمام', href: '/join' },
  },
});
