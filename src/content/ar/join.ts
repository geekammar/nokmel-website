import { z } from 'zod';
import { ctaLinkSchema, joinFieldSchema } from '../schema';

const joinContentSchema = z.object({
  hero: z.object({
    title: z.string().min(1),
    lead: z.string().min(1),
  }),
  formTitle: z.string().min(1),
  fields: z.array(joinFieldSchema).length(4),
  disabledNotice: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
  }),
  submit: z.object({
    label: z.string().min(1),
    hint: z.string().min(1),
  }),
  privacyNote: z.object({
    label: z.string().min(1),
    body: z.string().min(1),
    link: ctaLinkSchema,
  }),
});

export type JoinContent = z.infer<typeof joinContentSchema>;

export const join: JoinContent = joinContentSchema.parse({
  hero: {
    title: 'اطلب الانضمام',
    lead: 'سجّل اهتمامك بالانضمام المبكر إلى نكمّل — مرحلة نبني فيها المنتج مع أوائل التجّار.',
  },
  formTitle: 'بيانات طلب الانضمام',
  fields: [
    {
      id: 'join-name',
      name: 'name',
      label: 'الاسم الكامل',
      type: 'text',
      required: true,
      autoComplete: 'name',
      placeholder: 'اكتب اسمك',
    },
    {
      id: 'join-phone',
      name: 'phone',
      label: 'رقم الهاتف',
      type: 'tel',
      required: true,
      autoComplete: 'tel',
      placeholder: 'مثال: 0500000000',
    },
    {
      id: 'join-email',
      name: 'email',
      label: 'البريد الإلكتروني (اختياري)',
      type: 'email',
      required: false,
      autoComplete: 'email',
      placeholder: 'name@example.com',
    },
    {
      id: 'join-activity',
      name: 'businessActivity',
      label: 'نشاط التجارة (اختياري)',
      type: 'textarea',
      required: false,
      placeholder: 'اشرح بإيجاز ماذا تبيع ووين تدير متجرك',
    },
  ],
  disabledNotice: {
    title: 'استلام الطلبات غير متاح بعد',
    body: 'نُجهّز الآن استقبال طلبات الانضمام وتخزينها بأمان. في هذه المرحلة، الحقول أدناه معروضة للمعاينة فقط ومعطّلة — لن نطلب منك إرسال بياناتك، ولن تُنقل أي معلومات.',
  },
  submit: {
    label: 'اطلب الانضمام',
    hint: 'سيُفعَّل زر الإرسال عند توفر استلام الطلبات في مرحلة لاحقة.',
  },
  privacyNote: {
    label: 'خصوصيتك',
    body: 'لا نجمع بيانات حالياً. سيوضح النص النهائي لسياسة الخصوصية التعامل مع بيانات الطلبات عند تفعيلها.',
    link: { label: 'اقرأ مسودة سياسة الخصوصية', href: '/privacy' },
  },
});
