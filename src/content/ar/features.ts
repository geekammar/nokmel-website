import { z } from 'zod';
import { capabilityItemSchema, ctaLinkSchema, textItemSchema } from '../schema';

export const featuresContentSchema = z.object({
  hero: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
    statusNote: z.string().min(1),
  }),
  workflows: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
    items: z.array(capabilityItemSchema).min(1),
  }),
  planned: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
    items: z.array(capabilityItemSchema).min(1),
  }),
  cta: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    primaryCta: ctaLinkSchema,
  }),
});

export type FeaturesContent = z.infer<typeof featuresContentSchema>;

export const features: FeaturesContent = featuresContentSchema.parse({
  hero: {
    title: 'الميزات',
    lead: 'نشرح نكمّل من خلال مسارات عمل التجّار اليومية: أين يضيع الجهد اليوم، وكيف يستهدف المنتج تخفيفه — بدلاً من قوائم تقنية.',
    statusNote:
      'نكمّل في مرحلة الانضمام المبكر. كل ما في هذه الصفحة يصف اتجاه المنتج وقدرات مخططة — لا صفحة شراء ولا اشتراكات تجارية في هذه المرحلة.',
  },
  workflows: {
    title: 'الميزات من خلال مسار عملك',
    lead: 'أربعة مسارات أساسية نستهدف تغطيتها في الاتجاه الحالي (تيليجرام أولاً).',
    items: [
      {
        status: 'direction',
        groupTitle: 'ضمن الاتجاه الحالي — تيليجرام أولاً',
        title: 'استقبال الطلبات',
        body: 'عملاؤك يرسلون طلباتهم عبر تيليجرام، والهدف أن تصل الطلبات منظمة في مكان واحد بدلاً من محادثات متفرقة.',
      },
      {
        status: 'direction',
        groupTitle: 'ضمن الاتجاه الحالي — تيليجرام أولاً',
        title: 'إدارة المنتجات والأسعار',
        body: 'منتجات متجرك وأسعارها في كتالوج واحد يسهّل مشاركتها مع العملاء داخل المحادثة بدل إعادة كتابتها كل مرة.',
      },
      {
        status: 'direction',
        groupTitle: 'ضمن الاتجاه الحالي — تيليجرام أولاً',
        title: 'متابعة الطلب بعد إرساله',
        body: 'تأكيد الطلب وتحديث حالته للعميل من نفس المسار، فتقل الأخطاء اليدوية وتزداد ثقة العميل بمتجرك.',
      },
      {
        status: 'direction',
        groupTitle: 'ضمن الاتجاه الحالي — تيليجرام أولاً',
        title: 'صورة واضحة عن وضع المتجر',
        body: 'نظرة مركزة على الطلبات المفتوحة والمنتجات دون تنقل بين أدوات وملاحظات مبعثرة.',
      },
    ],
  },
  planned: {
    title: 'مخطط لمراحل لاحقة',
    lead: 'قدرات تتجاوز المرحلة الأولى — لا نعد بتوفرها قبل اكتمال تجربة تيليجرام أولاً.',
    items: [
      {
        status: 'planned',
        groupTitle: 'مخطط لمراحل لاحقة',
        title: 'قنوات محادثة إضافية',
        body: 'توسيع الدعم إلى قنوات أخرى إلى جانب تيليجرام، بحسب أولويات مرحلة الانضمام المبكر.',
      },
      {
        status: 'planned',
        groupTitle: 'مخطط لمراحل لاحقة',
        title: 'تقارير ولوحات متابعة',
        body: 'رؤى عن أداء متجرك وحركة طلباته ومؤشرات تهم التجّار.',
      },
      {
        status: 'planned',
        groupTitle: 'مخطط لمراحل لاحقة',
        title: 'ربط أدوات التجّار',
        body: 'تكاملات مع أدوات يستخدمها أصحاب المتاجر — تُدرس وفق أولويات التجّار المشاركين في الانضمام المبكر.',
      },
    ],
  },
  cta: {
    title: 'جاهز تجرب الاتجاه المبكر معنا؟',
    body: 'سجل اهتمامك بالانضمام المبكر وشاركنا طبيعة متجرك، وسنتواصل معك عند تفعيل استلام الطلبات.',
    primaryCta: { label: 'اطلب الانضمام', href: '/join' },
  },
});
