import { z } from 'zod';
import { ctaLinkSchema } from '../schema';

const pricingContentSchema = z.object({
  hero: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
  }),
  earlyAccess: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    points: z.array(z.string().min(1)).min(1),
  }),
  transparency: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  noPurchase: z.object({
    warning: z.string().min(1),
  }),
  cta: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    primaryCta: ctaLinkSchema,
    secondaryCta: ctaLinkSchema,
  }),
});

export type PricingContent = z.infer<typeof pricingContentSchema>;

export const pricing: PricingContent = pricingContentSchema.parse({
  hero: {
    title: 'الأسعار',
    lead: 'نكمّل في مرحلة الانضمام المبكر: لا يوجد تسعير تجاري معلن بعد، والشراء غير مفعّل.',
  },
  earlyAccess: {
    title: 'مرحلة الانضمام المبكر',
    description:
      'خلال هذه المرحلة لا نبيع اشتراكات ولا نجمع أي مبالغ — مكاننا نبني المنتج مع أوائل التجّار المتقدمين للانضمام.',
    points: [
      'طلب الانضمام لا يتضمن أي دفع في هذه المرحلة.',
      'التسعير التجاري لم يُعلن بعد، ولن نطلب أي بيانات دفع قبل ذلك.',
      'ما يمكنك فعله الآن: طلب الانضمام المبكر ومشاركة طبيعة نشاطك التجاري.',
    ],
  },
  transparency: {
    title: 'شفافية قبل التسعير',
    body: 'قبل إطلاق أي اشتراك مدفوع، سننشر على هذه الصفحة أسماء خطط واضحة وأسعارها وما يشمله كل اشتراك. لن يُفعّل الشراء إلا بعد نشر هذه المعلومات — لن تُطلب منك مبالك دون معرفتها مسبقاً.',
  },
  noPurchase: {
    warning:
      'لا توجد أي أسعار أو خطط في هذه المرحلة. لن نطلب أي بيانات دفع، ولن يُفعّل الشراء إلا بعد إعلان التسعير الرسمي.',
  },
  cta: {
    title: 'مهتم بالانضمام المبكر؟',
    body: 'لا حاجة لأي قرار تجاري الآن — سجل اهتمامك وشاركنا طبيعة متجرك، وسنتواصل معك.',
    primaryCta: { label: 'اطلب الانضمام', href: '/join' },
    secondaryCta: { label: 'تواصل معنا', href: '/contact' },
  },
});
