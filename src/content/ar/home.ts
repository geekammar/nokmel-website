import { z } from 'zod';
import { capabilityItemSchema, ctaLinkSchema, faqItemSchema, textItemSchema } from '../schema';

export const homeContentSchema = z.object({
  hero: z.object({
    title: z.string().min(1),
    eyebrow: z.string().min(1),
    headline: z.string().min(1),
    tagline: z.string().min(1),
    subheadline: z.string().min(1),
    primaryCta: ctaLinkSchema,
    secondaryCta: ctaLinkSchema,
  }),
  showcase: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    steps: z.array(
      z.object({
        title: z.string().min(1),
        body: z.string().min(1),
      }),
    ).length(3),
    caption: z.string().min(1),
    primaryCta: ctaLinkSchema,
  }),
  problems: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
    items: z.array(textItemSchema).min(1),
  }),
  capabilities: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
    items: z.array(capabilityItemSchema).min(2),
  }),
  steps: z.object({
    title: z.string().min(1),
    note: z.string().min(1),
    items: z.array(textItemSchema).length(3),
  }),
  pricingTeaser: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    primaryCta: ctaLinkSchema,
    secondaryCta: ctaLinkSchema,
  }),
  faq: z.object({
    title: z.string().min(1),
    items: z.array(faqItemSchema).min(1),
  }),
  finalCta: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    primaryCta: ctaLinkSchema,
    secondaryCta: ctaLinkSchema,
  }),
});

export type HomeContent = z.infer<typeof homeContentSchema>;

const currentTitle = 'ضمن الاتجاه الحالي — تيليجرام أولاً';
const plannedTitle = 'مخطط لمراحل لاحقة';

export const home: HomeContent = homeContentSchema.parse({
  hero: {
    title: 'نكمّل',
    eyebrow: 'منصة التجارة عبر المحادثة',
    headline: 'متجرك في المحادثة. وبزنسك في مكان واحد.',
    tagline: 'خلي بزنسك يكمل.',
    subheadline:
      'نكمّل منصة تجارة تساعد أصحاب المتاجر على إدارة متاجرهم وعملياتهم التجارية من خلال قنوات المحادثة، بدايةً من تيليجرام.',
    primaryCta: { label: 'اطلب الانضمام', href: '/join' },
    secondaryCta: { label: 'شوف كيف يعمل', href: '#how-it-works' },
  },
  showcase: {
    title: 'الطلبات من المحادثة، والمتابعة من مكان واحد.',
    body: 'هكذا نتخيل استخدام نكمّل في يومك التجاري: الطلب يبدأ في محادثة تيليجرام، يتحول إلى طلب منظّم، وتتابع كل طلباتك من مكان واحد.',
    steps: [
      {
        title: 'الطلب في تيليجرام',
        body: 'العميل يرسل طلبه في المحادثة بشكل طبيعي.',
      },
      {
        title: 'طلب منظّم',
        body: 'تفاصيل الطلب تتجمع في مكان واحد بدل رسائل مبعثرة.',
      },
      {
        title: 'متابعة من مكان واحد',
        body: 'تأكيد وتحديث الطلبات لعملائك من نفس المكان.',
      },
    ],
    caption: 'تصوّر مفاهيمي لاتجاه المنتج — ليس واجهة نهائية',
    primaryCta: { label: 'اطلب الانضمام', href: '/join' },
  },
  problems: {
    title: 'قبل نكمّل، كيف يبدو العمل اليوم؟',
    lead: 'تحديات مألوفة لأصحاب المتاجر التي يدير بيعها من خلال المحادثات.',
    items: [
      {
        title: 'طلبات تضيع بين الرسائل',
        body: 'عملاؤك يرسلون طلباتهم في محادثات متفرقة، وتتبّعها يدوياً يعني طلباً منسيّاً وعميلاً محبَطاً.',
      },
      {
        title: 'معلومات مبعثرة بين الأدوات',
        body: 'منتجات متجرك وأسعارها وتفاصيل عملائك موزعة على تطبيقات وملاحظات مختلفة يصعب الرجوع إليها.',
      },
      {
        title: 'وقت يُستهلك في التكرار',
        body: 'إعادة كتابة الأسعار وتفاصيل الطلب نفسها في كل محادثة تستهلك وقتاً كان يمكن تخصيصه لنمو متجرك.',
      },
      {
        title: 'غياب صورة واضحة عن العمليات',
        body: 'بدون مكان واحد يجمع المحادثات والطلبات، يصعب معرفة وضع متجرك الحالي وما لم يُنجز بعد.',
      },
    ],
  },
  capabilities: {
    title: 'ماذا يقدم نكمّل؟',
    lead: 'نميّز دائماً بين اتجاه المنتج وما هو مخطط لمراحل لاحقة، ولا نصف أي قدرة بأنها «متاحة» إلا بعد التحقق الفني من عملها فعلياً.',
    items: [
      {
        status: 'direction',
        groupTitle: currentTitle,
        title: 'استقبال الطلبات',
        body: 'الطلب يصل منظّم من محادثة تيليجرام.',
      },
      {
        status: 'direction',
        groupTitle: currentTitle,
        title: 'إدارة المنتجات والأسعار',
        body: 'منتجات متجرك وأسعارها في كتالوج واحد يسهّل مشاركتها مع العملاء داخل المحادثة.',
      },
      {
        status: 'direction',
        groupTitle: currentTitle,
        title: 'متابعة ما بعد الطلب',
        body: 'تأكيد الطلب وتحديث حالته للعميل من نفس المسار.',
      },
      {
        status: 'direction',
        groupTitle: currentTitle,
        title: 'صورة واضحة عن وضع المتجر',
        body: 'نظرة مركزة على الطلبات المفتوحة والمنتجات دون تبديل بين أدوات.',
      },
      {
        status: 'planned',
        groupTitle: plannedTitle,
        title: 'قنوات محادثة إضافية',
        body: 'توسيع الدعم إلى قنوات أخرى إلى جانب تيليجرام.',
      },
      {
        status: 'planned',
        groupTitle: plannedTitle,
        title: 'تقارير ولوحات متابعة',
        body: 'رؤى عن أداء متجرك وحركة طلباته.',
      },
    ],
  },
  steps: {
    title: 'كيف يعمل؟ ثلاث خطوات بسيطة',
    note: 'رؤية مبدئية لكيفية استخدام المنتج — قابلة للتعديل خلال مرحلة الانضمام المبكر.',
    items: [
      {
        title: 'اطلب الانضمام',
        body: 'تسجل بيانات متجرك ونشاطه، ونصل إليك لفهم أسلوب عملك وأولوياتك.',
      },
      {
        title: 'جهّز متجرك في المحادثة',
        body: 'نضيف منتجاتك وأسعارها ونجهّز استقبال طلباتك عبر تيليجرام معك خطوة بخطوة.',
      },
      {
        title: 'تابع عملك من مكان واحد',
        body: 'متابعة الطلبات وأوضاعها من مسار واحد، وقرارات أسرع بجهد أقل.',
      },
    ],
  },
  pricingTeaser: {
    title: 'الانضمام المبكر قبل أي تسعير',
    body: 'لا يوجد تسعير تجاري معلن حتى الآن، والشراء غير مفعّل في هذه المرحلة. حالياً نعمل مع أوائل التجّار المتقدمين لبناء المنتج وتحسينه.',
    primaryCta: { label: 'اطلب الانضمام', href: '/join' },
    secondaryCta: { label: 'تفاصيل الأسعار', href: '/pricing' },
  },
  faq: {
    title: 'أسئلة شائعة',
    items: [
      {
        question: 'ما هو نكمّل؟',
        answer:
          'منصة تجارة تساعد أصحاب المتاجر على إدارة متاجرهم وعملياتهم التجارية من خلال قنوات المحادثة، بدءاً من تيليجرام.',
      },
      {
        question: 'ما القنوات المدعومة حالياً؟',
        answer:
          'الاتجاه الحالي هو دعم تيليجرام أولاً. دعم قنوات أخرى مخطط له في مراحل لاحقة، ولا نعد بتوفرها قبل اكتمال التجربة الأولى.',
      },
      {
        question: 'ماذا يعني الانضمام المبكر؟',
        answer:
          'يعني تسجيل اهتمامك بالتواجد مع أوائل التجّار الذين نبني المنتج معهم وأجلهم. لا يتضمن الانضمام المبكر أي دفع أو اشتراك.',
      },
      {
        question: 'هل يمكنني الشراء أو الاشتراك الآن؟',
        answer:
          'لا — الشراء التجاري غير مفعّل في هذه المرحلة. لن نطلب أي بيانات دفع أو مبالغ قبل إعلان التسعير الرسمي.',
      },
      {
        question: 'متى ينطلق المنتج؟',
        answer: 'لم نحدد تاريخ إطلاق نهائياً بعد. نحن في مرحلة مبكرة نعمل فيها مع التجّار المتقدمين للانضمام.',
      },
      {
        question: 'هل نموذج طلب الانضمام يعمل الآن؟',
        answer:
          'يمكنك معرفة حالة استقبال طلبات الانضمام من صفحة «اطلب الانضمام». عندما يكون النموذج متاحًا، يمكنك إرسال طلبك دون دفع أو التزام بشراء اشتراك.',
      },
    ],
  },
  finalCta: {
    title: 'جاهز تخلّي بزنسك يكمل؟',
    body: 'سجّل اهتمامك بالانضمام المبكر، وسنراجع طلبك للتواصل معك بشأن الخطوة التالية عند الحاجة.',
    primaryCta: { label: 'اطلب الانضمام', href: '/join' },
    secondaryCta: { label: 'استعرض الميزات', href: '/features' },
  },
});
