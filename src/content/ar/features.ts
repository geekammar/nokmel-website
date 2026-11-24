import { z } from 'zod';
import { capabilityItemSchema, ctaLinkSchema, textItemSchema } from '../schema';

const featuresContentSchema = z.object({
  hero: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
    statusNote: z.string().min(1),
  }),
  legend: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
  }),
  workflows: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
    items: z.array(capabilityItemSchema).min(1),
  }),
  planned: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
    items: z.array(textItemSchema).min(1),
  }),
  availableNote: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
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
  legend: {
    title: 'كيف نصف حالة كل ميزة',
    lead: 'نستخدم تسميات واضحة: «اتجاه المنتج» تعني ميزة نعمل عليها ضمن الاتجاه الحالي (تيليجرام أولاً) خلال الانضمام المبكر، و«مخطط مستقبلاً» تعني ميزة ليست ضمن المرحلة الحالية. ولا نصنّف أي ميزة بأنها «متاحة ومؤكدة» إلا بعد التحقق الفني من توفرها فعلياً.',
  },
  workflows: {
    title: 'الميزات من خلال مسار عملك',
    lead: 'أربعة مسارات أساسية نستهدف تغطيتها في الاتجاه الحالي (تيليجرام أولاً).',
    items: [
      {
        status: 'direction',
        title: 'استقبال الطلبات',
        body: 'عملاؤك يرسلون طلباتهم عبر تيليجرام، والهدف أن تصل الطلبات منظمة في مكان واحد بدلاً من محادثات متفرقة.',
      },
      {
        status: 'direction',
        title: 'إدارة المنتجات والأسعار',
        body: 'منتجات متجرك وأسعارها في كتالوج واحد يسهّل مشاركتها مع العملاء داخل المحادثة بدل إعادة كتابتها كل مرة.',
      },
      {
        status: 'direction',
        title: 'متابعة الطلب بعد إرساله',
        body: 'تأكيد الطلب وتحديث حالته للعميل من نفس المسار، فتقل الأخطاء اليدوية وتزداد ثقة العميل بمتجرك.',
      },
      {
        status: 'direction',
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
        title: 'قنوات محادثة إضافية',
        body: 'توسيع الدعم إلى قنوات أخرى إلى جانب تيليجرام، بحسب أولويات مرحلة الانضمام المبكر.',
      },
      {
        title: 'تقارير ولوحات متابعة',
        body: 'رؤى عن أداء متجرك وحركة طلباته ومؤشرات تهم التجّار.',
      },
      {
        title: 'ربط أدوات التجّار',
        body: 'تكاملات مع أدوات يستخدمها أصحاب المتاجر — تُدرس وفق أولويات التجّار المشاركين في الانضمام المبكر.',
      },
    ],
  },
  availableNote: {
    title: 'قدرات متاحة ومؤكدة',
    body: 'هذه الفئة مخصصة للميزات المشغّلة فعلياً في المنتج بعد التحقق الفني منها. لا توجد أي ميزة مدرجة في هذه الفئة حالياً، وسنضيف إليها فقط ما نستطيع إثبات عمله.',
  },
  cta: {
    title: 'جاهز تجرب الاتجاه المبكر معنا؟',
    body: 'سجل اهتمامك بالانضمام المبكر وشاركنا طبيعة متجرك، وسنتواصل معك عند تفعيل استلام الطلبات.',
    primaryCta: { label: 'اطلب الانضمام', href: '/join' },
  },
});
