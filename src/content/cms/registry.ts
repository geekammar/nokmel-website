import { z } from 'zod';
import { contact, contactContentSchema, type ContactContent } from '@/content/ar/contact';
import { features, featuresContentSchema, type FeaturesContent } from '@/content/ar/features';
import { home, homeContentSchema, type HomeContent } from '@/content/ar/home';
import { join, joinContentSchema, type JoinContent } from '@/content/ar/join';
import { legal, legalContentSchema, type LegalContent } from '@/content/ar/legal';
import { pricing, pricingContentSchema, type PricingContent } from '@/content/ar/pricing';
import { CmsValidationError } from '@/lib/cms/errors';

/**
 * Predefined CMS content registry (W3.2).
 *
 * The registry is the single source of truth for:
 * - which pages/sections/locales may be stored;
 * - which fields are editable and their limits;
 * - the approved default content used whenever no published override exists;
 * - how editable values are safely applied to a full, code-controlled section
 *   payload (structural fields such as CTA destinations, capability statuses,
 *   join-form field definitions and approved link destinations are preserved
 *   from the defaults).
 *
 * It deliberately contains no database code so it can be used by the client
 * editor for field metadata and by the server for validation.
 */

export const CMS_LOCALES = ['ar'] as const;
export type CmsLocale = (typeof CMS_LOCALES)[number];
export const DEFAULT_CMS_LOCALE: CmsLocale = 'ar';

export const CMS_PAGE_KEYS = [
  'home',
  'features',
  'pricing',
  'join',
  'contact',
  'privacy',
  'terms',
] as const;
export type CmsPageKey = (typeof CMS_PAGE_KEYS)[number];

export const CMS_TEXT_LIMITS = {
  ctaLabel: 40,
  short: 120,
  medium: 300,
  long: 1200,
  legal: 4000,
  faqQuestion: 300,
  faqAnswer: 2000,
} as const;

export const CMS_MAX_FAQ_ITEMS = 30;
export const CMS_MAX_EDITABLE_JSON_BYTES = 64 * 1024;

const APPROVED_INTERNAL_LINKS = new Set([
  '/join',
  '/features',
  '/pricing',
  '/contact',
  '/privacy',
  '/terms',
  '#how-it-works',
]);

const REQUIRED_TEXT = 'هذا الحقل مطلوب.';
const TOO_LONG = 'النص أطول من الحد المسموح.';
const INVALID_COUNT = 'عدد العناصر غير صالح.';
const INVALID_ID = 'معرّف العنصر غير صالح.';

type TextFieldDescriptor = {
  kind: 'text';
  key: string;
  label: string;
  maxLength: number;
  multiline?: boolean;
  help?: string;
};

type GroupFieldDescriptor = {
  kind: 'group';
  key: string;
  label: string;
  fields: readonly FieldDescriptor[];
};

type ListFieldDescriptor = {
  kind: 'list';
  key: string;
  label: string;
  itemLabel: (index: number) => string;
  length: number;
  fields: readonly FieldDescriptor[];
};

type StringListFieldDescriptor = {
  kind: 'stringList';
  key: string;
  label: string;
  itemLabel: (index: number) => string;
  length: number;
  maxLength: number;
};

type BooleanFieldDescriptor = {
  kind: 'boolean';
  key: string;
  label: string;
  help?: string;
  trueLabel?: string;
  falseLabel?: string;
};

export type FieldDescriptor =
  | TextFieldDescriptor
  | GroupFieldDescriptor
  | ListFieldDescriptor
  | StringListFieldDescriptor
  | BooleanFieldDescriptor;

export type SectionDefinition = {
  key: string;
  label: string;
  description?: string;
  fields: readonly FieldDescriptor[];
};

export type PageDefinition = {
  key: CmsPageKey;
  label: string;
  path: PublicPagePath;
  description: string;
  sections: readonly SectionDefinition[];
};

export type PublicPagePath =
  | '/'
  | '/features'
  | '/pricing'
  | '/join'
  | '/contact'
  | '/privacy'
  | '/terms';

export type SectionPayload = Record<string, unknown>;
export type SectionPayloadMap = Record<string, SectionPayload>;

export type CmsFaqItem = {
  id: string;
  question: string;
  answer: string;
  visible: boolean;
};

export type LegalPageContent = {
  draftStatus: LegalContent['draftStatus'];
  page: LegalContent['privacy'];
};

export type CmsPageContent = {
  home: HomeContent;
  features: FeaturesContent;
  pricing: PricingContent;
  join: JoinContent;
  contact: ContactContent;
  privacy: LegalPageContent;
  terms: LegalPageContent;
};

const text = (
  key: string,
  label: string,
  maxLength: number = CMS_TEXT_LIMITS.short,
  options: { multiline?: boolean; help?: string } = {},
): TextFieldDescriptor => ({ kind: 'text', key, label, maxLength, ...options });

const group = (
  key: string,
  label: string,
  fields: readonly FieldDescriptor[],
): GroupFieldDescriptor => ({ kind: 'group', key, label, fields });

const list = (
  key: string,
  label: string,
  itemLabel: (index: number) => string,
  length: number,
  fields: readonly FieldDescriptor[],
): ListFieldDescriptor => ({ kind: 'list', key, label, itemLabel, length, fields });

const stringList = (
  key: string,
  label: string,
  itemLabel: (index: number) => string,
  length: number,
  maxLength: number = CMS_TEXT_LIMITS.medium,
): StringListFieldDescriptor => ({
  kind: 'stringList',
  key,
  label,
  itemLabel,
  length,
  maxLength,
});

const booleanField = (
  key: string,
  label: string,
  options: { help?: string; trueLabel?: string; falseLabel?: string } = {},
): BooleanFieldDescriptor => ({ kind: 'boolean', key, label, ...options });

const ctaLabel = (key: string, label: string): TextFieldDescriptor =>
  text(key, label, CMS_TEXT_LIMITS.ctaLabel);

const itemLabel = (prefix: string) => (index: number) => `${prefix} ${index + 1}`;

export const CMS_PAGES: readonly PageDefinition[] = [
  {
    key: 'home',
    label: 'الصفحة الرئيسية',
    path: '/',
    description: 'الواجهة الرئيسية وأقسام التعريف بالمنتج.',
    sections: [
      {
        key: 'hero',
        label: 'الواجهة الرئيسية',
        fields: [
          text('eyebrow', 'السطر التعريفي العلوي', CMS_TEXT_LIMITS.short),
          text('headline', 'العنوان الرئيسي', CMS_TEXT_LIMITS.short),
          text('tagline', 'الشعار المختصر', CMS_TEXT_LIMITS.short),
          text('subheadline', 'الوصف التعريفي', CMS_TEXT_LIMITS.medium, { multiline: true }),
          group('primaryCta', 'زر الانضمام', [ctaLabel('label', 'نص الزر')]),
          group('secondaryCta', 'الرابط الثانوي', [ctaLabel('label', 'نص الرابط')]),
        ],
      },
      {
        key: 'showcase',
        label: 'العرض المفاهيمي',
        description: 'وصف مفاهيمي لمسار المنتج. لا يمثل واجهة نهائية.',
        fields: [
          booleanField('visible', 'إظهار عرض تجربة المنتج', {
            help:
              'يمكنك إظهار عرض تجربة المنتج أو إخفاؤه من الصفحة الرئيسية دون حذف محتواه.',
            trueLabel: 'ظاهر',
            falseLabel: 'مخفي',
          }),
          text('title', 'عنوان العرض', CMS_TEXT_LIMITS.medium),
          text('body', 'وصف العرض', CMS_TEXT_LIMITS.long, { multiline: true }),
          list('steps', 'الخطوات المفاهيمية', itemLabel('الخطوة'), 3, [
            text('title', 'عنوان الخطوة', CMS_TEXT_LIMITS.short),
            text('body', 'وصف الخطوة', CMS_TEXT_LIMITS.medium, { multiline: true }),
          ]),
          text('caption', 'تنبيه التصور المفاهيمي', CMS_TEXT_LIMITS.short),
          group('primaryCta', 'زر الانضمام', [ctaLabel('label', 'نص الزر')]),
        ],
      },
      {
        key: 'problems',
        label: 'المشكلات',
        fields: [
          text('title', 'عنوان القسم', CMS_TEXT_LIMITS.medium),
          text('lead', 'المقدمة', CMS_TEXT_LIMITS.medium, { multiline: true }),
          list('items', 'عناصر المشكلات', itemLabel('المشكلة'), 4, [
            text('title', 'العنوان', CMS_TEXT_LIMITS.short),
            text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          ]),
        ],
      },
      {
        key: 'capabilities',
        label: 'القدرات',
        description: 'حالة كل قدرة (اتجاه حالي أو مخطط) تبقى محكومة في الكود ولا يمكن تعديلها.',
        fields: [
          text('title', 'عنوان القسم', CMS_TEXT_LIMITS.medium),
          text('lead', 'المقدمة', CMS_TEXT_LIMITS.medium, { multiline: true }),
          list('items', 'عناصر القدرات', itemLabel('القدرة'), 6, [
            text('title', 'العنوان', CMS_TEXT_LIMITS.short),
            text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          ]),
        ],
      },
      {
        key: 'steps',
        label: 'كيف يعمل',
        fields: [
          text('title', 'عنوان القسم', CMS_TEXT_LIMITS.medium),
          text('note', 'ملاحظة القسم', CMS_TEXT_LIMITS.medium, { multiline: true }),
          list('items', 'الخطوات', itemLabel('الخطوة'), 3, [
            text('title', 'العنوان', CMS_TEXT_LIMITS.short),
            text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          ]),
        ],
      },
      {
        key: 'pricingTeaser',
        label: 'تلميح الأسعار',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.medium),
          text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          group('primaryCta', 'زر الانضمام', [ctaLabel('label', 'نص الزر')]),
          group('secondaryCta', 'رابط الأسعار', [ctaLabel('label', 'نص الرابط')]),
        ],
      },
      {
        key: 'faq',
        label: 'الأسئلة الشائعة',
        description: 'يُدار عنوان القسم هنا، وتُدار الأسئلة من محرر الأسئلة أدناه.',
        fields: [text('title', 'عنوان القسم', CMS_TEXT_LIMITS.short)],
      },
      {
        key: 'finalCta',
        label: 'الدعوة الختامية',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.medium),
          text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          group('primaryCta', 'زر الانضمام', [ctaLabel('label', 'نص الزر')]),
          group('secondaryCta', 'الرابط الثانوي', [ctaLabel('label', 'نص الرابط')]),
        ],
      },
    ],
  },
  {
    key: 'features',
    label: 'الميزات',
    path: '/features',
    description: 'أسطر المنتج ومجموعات القدرات الحالية والمخططة.',
    sections: [
      {
        key: 'hero',
        label: 'الواجهة الرئيسية',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.short),
          text('lead', 'المقدمة', CMS_TEXT_LIMITS.long, { multiline: true }),
          text('statusNote', 'ملاحظة حالة المنتج', CMS_TEXT_LIMITS.long, { multiline: true }),
        ],
      },
      {
        key: 'workflows',
        label: 'مسارات العمل الحالية',
        description: 'عناوين وأوصاف القدرات فقط. حالة الاتجاه ومجموعتها محكومة في الكود.',
        fields: [
          text('title', 'عنوان القسم', CMS_TEXT_LIMITS.medium),
          text('lead', 'المقدمة', CMS_TEXT_LIMITS.medium, { multiline: true }),
          list('items', 'مسارات العمل', itemLabel('المسار'), 4, [
            text('title', 'العنوان', CMS_TEXT_LIMITS.short),
            text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          ]),
        ],
      },
      {
        key: 'planned',
        label: 'المخطط لاحقاً',
        description: 'عناوين وأوصاف القدرات المخططة فقط. حالتها محكومة في الكود.',
        fields: [
          text('title', 'عنوان القسم', CMS_TEXT_LIMITS.medium),
          text('lead', 'المقدمة', CMS_TEXT_LIMITS.medium, { multiline: true }),
          list('items', 'القدرات المخططة', itemLabel('القدرة'), 3, [
            text('title', 'العنوان', CMS_TEXT_LIMITS.short),
            text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          ]),
        ],
      },
      {
        key: 'cta',
        label: 'الدعوة الختامية',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.medium),
          text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          group('primaryCta', 'زر الانضمام', [ctaLabel('label', 'نص الزر')]),
        ],
      },
    ],
  },
  {
    key: 'pricing',
    label: 'الأسعار',
    path: '/pricing',
    description: 'نصوص توضيحية فقط. لا أسعار أو خطط أو اشتراكات في هذه المرحلة.',
    sections: [
      {
        key: 'hero',
        label: 'الواجهة الرئيسية',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.short),
          text('lead', 'المقدمة', CMS_TEXT_LIMITS.medium, { multiline: true }),
        ],
      },
      {
        key: 'earlyAccess',
        label: 'الانضمام المبكر',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.medium),
          text('description', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          stringList('points', 'النقاط', itemLabel('النقطة'), 3, CMS_TEXT_LIMITS.medium),
        ],
      },
      {
        key: 'transparency',
        label: 'الشفافية',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.medium),
          text('body', 'النص', CMS_TEXT_LIMITS.long, { multiline: true }),
        ],
      },
      {
        key: 'noPurchase',
        label: 'تنبيه عدم الشراء',
        fields: [text('warning', 'نص التنبيه', CMS_TEXT_LIMITS.long, { multiline: true })],
      },
      {
        key: 'cta',
        label: 'الدعوة الختامية',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.medium),
          text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          group('primaryCta', 'زر الانضمام', [ctaLabel('label', 'نص الزر')]),
          group('secondaryCta', 'رابط التواصل', [ctaLabel('label', 'نص الرابط')]),
        ],
      },
    ],
  },
  {
    key: 'join',
    label: 'طلب الانضمام',
    path: '/join',
    description: 'نصوص تسويقية فقط. بنية النموذج معطّلة ومحكومة في الكود.',
    sections: [
      {
        key: 'hero',
        label: 'الواجهة الرئيسية',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.short),
          text('lead', 'المقدمة', CMS_TEXT_LIMITS.medium, { multiline: true }),
        ],
      },
      {
        key: 'form',
        label: 'نصوص النموذج المعطّل',
        description: 'الحقول وأنواعها وإلزامها وروابطها تبقى كما هي في الكود.',
        fields: [
          text('formTitle', 'عنوان النموذج', CMS_TEXT_LIMITS.short),
          group('disabledNotice', 'تنبيه التعطيل', [
            text('title', 'العنوان', CMS_TEXT_LIMITS.short),
            text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          ]),
          group('submit', 'نص زر الإرسال', [
            ctaLabel('label', 'نص الزر'),
            text('hint', 'التلميح', CMS_TEXT_LIMITS.medium, { multiline: true }),
          ]),
          group('privacyNote', 'ملاحظة الخصوصية', [
            text('label', 'عنوان الملاحظة', CMS_TEXT_LIMITS.short),
            text('body', 'النص', CMS_TEXT_LIMITS.long, { multiline: true }),
          ]),
        ],
      },
    ],
  },
  {
    key: 'contact',
    label: 'تواصل معنا',
    path: '/contact',
    description: 'نصوص توضيحية فقط. قنوات التواصل الرسمية تُدار في مرحلة لاحقة.',
    sections: [
      {
        key: 'hero',
        label: 'الواجهة الرئيسية',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.short),
          text('lead', 'المقدمة', CMS_TEXT_LIMITS.medium, { multiline: true }),
        ],
      },
      {
        key: 'channels',
        label: 'قنوات التواصل',
        description: 'لا توجد قنوات معتمدة بعد. القائمة تبقى فارغة ومحكومة في الكود.',
        fields: [
          text('channelsTitle', 'عنوان القسم', CMS_TEXT_LIMITS.short),
          text('emptyNote', 'ملاحظة عدم توفر القنوات', CMS_TEXT_LIMITS.long, { multiline: true }),
        ],
      },
      {
        key: 'joinSuggestion',
        label: 'اقتراح الانضمام',
        fields: [
          text('title', 'العنوان', CMS_TEXT_LIMITS.medium),
          text('body', 'الوصف', CMS_TEXT_LIMITS.long, { multiline: true }),
          group('primaryCta', 'زر الانضمام', [ctaLabel('label', 'نص الزر')]),
        ],
      },
    ],
  },
  {
    key: 'privacy',
    label: 'سياسة الخصوصية',
    path: '/privacy',
    description: 'مسودة قانونية أولية. تنبيه المسودة وسياسة ما قبل الإطلاق يبقيان في الكود.',
    sections: [
      {
        key: 'legal',
        label: 'نص سياسة الخصوصية',
        fields: [
          text('title', 'عنوان الصفحة', CMS_TEXT_LIMITS.short),
          text('intro', 'المقدمة', CMS_TEXT_LIMITS.long, { multiline: true }),
          list('sections', 'الأقسام القانونية', itemLabel('القسم'), 6, [
            text('heading', 'العنوان', CMS_TEXT_LIMITS.medium),
            text('body', 'النص', CMS_TEXT_LIMITS.legal, { multiline: true }),
          ]),
        ],
      },
    ],
  },
  {
    key: 'terms',
    label: 'الشروط والأحكام',
    path: '/terms',
    description: 'مسودة قانونية أولية. تنبيه المسودة وسياسة ما قبل الإطلاق يبقيان في الكود.',
    sections: [
      {
        key: 'legal',
        label: 'نص الشروط والأحكام',
        fields: [
          text('title', 'عنوان الصفحة', CMS_TEXT_LIMITS.short),
          text('intro', 'المقدمة', CMS_TEXT_LIMITS.long, { multiline: true }),
          list('sections', 'الأقسام القانونية', itemLabel('القسم'), 6, [
            text('heading', 'العنوان', CMS_TEXT_LIMITS.medium),
            text('body', 'النص', CMS_TEXT_LIMITS.legal, { multiline: true }),
          ]),
        ],
      },
    ],
  },
] as const;

const PAGE_BY_KEY = new Map(CMS_PAGES.map((page) => [page.key, page]));

export function isCmsPageKey(value: unknown): value is CmsPageKey {
  return typeof value === 'string' && PAGE_BY_KEY.has(value as CmsPageKey);
}

export function assertCmsPageKey(value: unknown): CmsPageKey {
  if (!isCmsPageKey(value)) throw new CmsValidationError('صفحة محتوى غير معروفة.');
  return value;
}

export function assertCmsLocale(value: unknown): CmsLocale {
  if (typeof value !== 'string' || !(CMS_LOCALES as readonly string[]).includes(value)) {
    throw new CmsValidationError('لغة محتوى غير مدعومة.');
  }
  return value as CmsLocale;
}

export function getPageDefinition(pageKey: CmsPageKey): PageDefinition {
  const page = PAGE_BY_KEY.get(pageKey);
  if (!page) throw new CmsValidationError('صفحة محتوى غير معروفة.');
  return page;
}

export function getSectionDefinition(
  pageKey: CmsPageKey,
  sectionKey: string,
): SectionDefinition {
  const page = getPageDefinition(pageKey);
  const section = page.sections.find((candidate) => candidate.key === sectionKey);
  if (!section) throw new CmsValidationError('قسم محتوى غير معروف.');
  return section;
}

function sectionDefaults(pageKey: CmsPageKey): SectionPayloadMap {
  switch (pageKey) {
    case 'home':
      return {
        hero: home.hero,
        showcase: home.showcase,
        problems: home.problems,
        capabilities: home.capabilities,
        steps: home.steps,
        pricingTeaser: home.pricingTeaser,
        faq: { title: home.faq.title },
        finalCta: home.finalCta,
      };
    case 'features':
      return {
        hero: features.hero,
        workflows: features.workflows,
        planned: features.planned,
        cta: features.cta,
      };
    case 'pricing':
      return {
        hero: pricing.hero,
        earlyAccess: pricing.earlyAccess,
        transparency: pricing.transparency,
        noPurchase: pricing.noPurchase,
        cta: pricing.cta,
      };
    case 'join':
      return {
        hero: join.hero,
        form: {
          formTitle: join.formTitle,
          disabledNotice: join.disabledNotice,
          submit: join.submit,
          privacyNote: join.privacyNote,
        },
      };
    case 'contact':
      return {
        hero: contact.hero,
        channels: {
          channelsTitle: contact.channelsTitle,
          emptyNote: contact.emptyNote,
          channels: contact.channels,
        },
        joinSuggestion: contact.joinSuggestion,
      };
    case 'privacy':
      return { legal: legal.privacy };
    case 'terms':
      return { legal: legal.terms };
  }
}

export const DEFAULT_FAQ_ITEMS: readonly CmsFaqItem[] = home.faq.items.map((item, index) => ({
  id: `faq-default-${index + 1}`,
  question: item.question,
  answer: item.answer,
  visible: true,
}));

export const DEFAULT_FAQ_FOR_RENDER = DEFAULT_FAQ_ITEMS.map(({ question, answer }) => ({
  question,
  answer,
}));

export function defaultSectionPayloads(pageKey: CmsPageKey): SectionPayloadMap {
  return structuredClone(sectionDefaults(pageKey));
}

export function defaultSectionPayload(
  pageKey: CmsPageKey,
  sectionKey: string,
): SectionPayload {
  const payload = sectionDefaults(pageKey)[sectionKey];
  if (!payload) throw new CmsValidationError('قسم محتوى غير معروف.');
  return structuredClone(payload);
}

function textSchema(field: TextFieldDescriptor): z.ZodString {
  return z
    .string({ required_error: REQUIRED_TEXT })
    .trim()
    .min(1, REQUIRED_TEXT)
    .max(field.maxLength, TOO_LONG);
}

function fieldSchema(field: FieldDescriptor): z.ZodTypeAny {
  switch (field.kind) {
    case 'text':
      return textSchema(field);
    case 'group':
      return z
        .object(
          Object.fromEntries(field.fields.map((child) => [child.key, fieldSchema(child)])),
        )
        .strict();
    case 'list':
      return z
        .array(
          z
            .object(
              Object.fromEntries(field.fields.map((child) => [child.key, fieldSchema(child)])),
            )
            .strict(),
        )
        .length(field.length, INVALID_COUNT);
    case 'stringList':
      return z
        .array(z.string({ required_error: REQUIRED_TEXT }).trim().min(1, REQUIRED_TEXT).max(field.maxLength, TOO_LONG))
        .length(field.length, INVALID_COUNT);
    case 'boolean':
      return z.boolean({ required_error: REQUIRED_TEXT });
  }
}

export function sectionEditableSchema(section: SectionDefinition): z.ZodTypeAny {
  return z
    .object(
      Object.fromEntries(section.fields.map((field) => [field.key, fieldSchema(field)])),
    )
    .strict();
}

const pageEditableSchemaCache = new Map<CmsPageKey, z.ZodTypeAny>();

export function pageEditableSchema(pageKey: CmsPageKey): z.ZodTypeAny {
  const cached = pageEditableSchemaCache.get(pageKey);
  if (cached) return cached;
  const page = getPageDefinition(pageKey);
  const schema = z
    .object(
      Object.fromEntries(
        page.sections.map((section) => [section.key, sectionEditableSchema(section)]),
      ),
    )
    .strict();
  pageEditableSchemaCache.set(pageKey, schema);
  return schema;
}

export type EditableSectionValues = Record<string, unknown>;
export type EditablePageValues = Record<string, EditableSectionValues>;

function readField(field: FieldDescriptor, source: unknown, path: string): unknown {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new CmsValidationError(`بنية محتوى غير صالحة: ${path}`);
  }
  const record = source as Record<string, unknown>;
  const value = record[field.key];
  switch (field.kind) {
    case 'text':
      if (typeof value !== 'string') {
        throw new CmsValidationError(`بنية محتوى غير صالحة: ${path}`);
      }
      return value;
    case 'group':
      return Object.fromEntries(
        field.fields.map((child) => [child.key, readField(child, value, `${path}.${child.key}`)]),
      );
    case 'stringList':
      if (!Array.isArray(value) || value.length !== field.length) {
        throw new CmsValidationError(`بنية محتوى غير صالحة: ${path}`);
      }
      return value.map((entry, index) => {
        if (typeof entry !== 'string') {
          throw new CmsValidationError(`بنية محتوى غير صالحة: ${path}.${index}`);
        }
        return entry;
      });
    case 'boolean':
      if (value === undefined || value === null) return false;
      if (typeof value !== 'boolean') {
        throw new CmsValidationError(`بنية محتوى غير صالحة: ${path}`);
      }
      return value;
    case 'list':
      if (!Array.isArray(value) || value.length !== field.length) {
        throw new CmsValidationError(`بنية محتوى غير صالحة: ${path}`);
      }
      return value.map((entry, index) =>
        Object.fromEntries(
          field.fields.map((child) => [
            child.key,
            readField(child, entry, `${path}.${index}.${child.key}`),
          ]),
        ),
      );
  }
}

function writeField(field: FieldDescriptor, target: SectionPayload, values: unknown): void {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new CmsValidationError('بنية محتوى غير صالحة.');
  }
  const record = values as Record<string, unknown>;
  const current = target[field.key];
  switch (field.kind) {
    case 'text':
      target[field.key] = record[field.key];
      return;
    case 'group': {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        throw new CmsValidationError('بنية محتوى غير صالحة.');
      }
      const childValues = record[field.key];
      if (!childValues || typeof childValues !== 'object' || Array.isArray(childValues)) {
        throw new CmsValidationError('بنية محتوى غير صالحة.');
      }
      const next = { ...(current as SectionPayload) };
      for (const child of field.fields) writeField(child, next, childValues);
      target[field.key] = next;
      return;
    }
    case 'stringList':
      target[field.key] = [...(record[field.key] as string[])];
      return;
    case 'boolean':
      if (typeof record[field.key] !== 'boolean') {
        throw new CmsValidationError('بنية محتوى غير صالحة.');
      }
      target[field.key] = record[field.key];
      return;
    case 'list': {
      if (!Array.isArray(current) || current.length < field.length) {
        throw new CmsValidationError('بنية محتوى غير صالحة.');
      }
      const entries = record[field.key] as Record<string, unknown>[];
      target[field.key] = entries.map((entry, index) => {
        const base = current[index];
        if (!base || typeof base !== 'object' || Array.isArray(base)) {
          throw new CmsValidationError('بنية محتوى غير صالحة.');
        }
        const next = { ...(base as SectionPayload) };
        for (const child of field.fields)
          writeField(child, next, { [child.key]: entry[child.key] });
        return next;
      });
      return;
    }
  }
}

export function extractSectionValues(
  pageKey: CmsPageKey,
  sectionKey: string,
  payload: unknown,
): EditableSectionValues {
  const section = getSectionDefinition(pageKey, sectionKey);
  return Object.fromEntries(
    section.fields.map((field) => [
      field.key,
      readField(field, payload, `${pageKey}.${sectionKey}.${field.key}`),
    ]),
  );
}

export function buildSectionPayload(
  pageKey: CmsPageKey,
  sectionKey: string,
  values: unknown,
): SectionPayload {
  const section = getSectionDefinition(pageKey, sectionKey);
  const parsed = sectionEditableSchema(section).parse(values);
  const base = defaultSectionPayload(pageKey, sectionKey);
  for (const field of section.fields) writeField(field, base, parsed);
  return base;
}

export function buildSectionPayloads(
  pageKey: CmsPageKey,
  values: unknown,
): SectionPayloadMap {
  const parsed = pageEditableSchema(pageKey).parse(values) as EditablePageValues;
  const page = getPageDefinition(pageKey);
  return Object.fromEntries(
    page.sections.map((section) => [
      section.key,
      buildSectionPayload(pageKey, section.key, parsed[section.key]),
    ]),
  );
}

export function extractPageValues(
  pageKey: CmsPageKey,
  content: CmsPageContent[CmsPageKey],
): EditablePageValues {
  const page = getPageDefinition(pageKey);
  if (pageKey === 'home') {
    const homeContent = content as HomeContent;
    return {
      hero: extractSectionValues(pageKey, 'hero', homeContent.hero),
      showcase: extractSectionValues(pageKey, 'showcase', homeContent.showcase),
      problems: extractSectionValues(pageKey, 'problems', homeContent.problems),
      capabilities: extractSectionValues(pageKey, 'capabilities', homeContent.capabilities),
      steps: extractSectionValues(pageKey, 'steps', homeContent.steps),
      pricingTeaser: extractSectionValues(pageKey, 'pricingTeaser', homeContent.pricingTeaser),
      faq: { title: homeContent.faq.title },
      finalCta: extractSectionValues(pageKey, 'finalCta', homeContent.finalCta),
    };
  }
  if (pageKey === 'privacy' || pageKey === 'terms') {
    const legalContent = content as LegalPageContent;
    return { legal: extractSectionValues(pageKey, 'legal', legalContent.page) };
  }
  if (pageKey === 'join') {
    const joinContent = content as JoinContent;
    return {
      hero: extractSectionValues(pageKey, 'hero', joinContent.hero),
      form: extractSectionValues(pageKey, 'form', {
        formTitle: joinContent.formTitle,
        disabledNotice: joinContent.disabledNotice,
        submit: joinContent.submit,
        privacyNote: joinContent.privacyNote,
      }),
    };
  }
  if (pageKey === 'contact') {
    const contactContent = content as ContactContent;
    return {
      hero: extractSectionValues(pageKey, 'hero', contactContent.hero),
      channels: {
        channelsTitle: contactContent.channelsTitle,
        emptyNote: contactContent.emptyNote,
      },
      joinSuggestion: extractSectionValues(
        pageKey,
        'joinSuggestion',
        contactContent.joinSuggestion,
      ),
    };
  }

  const pageDef = page;
  const record = content as Record<string, unknown>;
  return Object.fromEntries(
    pageDef.sections.map((section) => [
      section.key,
      extractSectionValues(pageKey, section.key, record[section.key]),
    ]),
  );
}

function assertCtaLinks(value: unknown, path = 'page'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertCtaLinks(entry, `${path}.${index}`));
    return;
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length === 2 &&
    typeof record.label === 'string' &&
    typeof record.href === 'string'
  ) {
    if (!APPROVED_INTERNAL_LINKS.has(record.href)) {
      throw new CmsValidationError(`وجهة رابط غير معتمدة: ${path}`);
    }
  }
  for (const [key, child] of Object.entries(record)) {
    assertCtaLinks(child, `${path}.${key}`);
  }
}

function assertCapabilityStructure(
  actual: readonly { status: string; groupTitle: string }[],
  expected: readonly { status: string; groupTitle: string }[],
): void {
  if (actual.length !== expected.length) {
    throw new CmsValidationError('بنية قدرات غير صالحة.');
  }
  actual.forEach((item, index) => {
    if (
      item.status !== expected[index].status ||
      item.groupTitle !== expected[index].groupTitle
    ) {
      throw new CmsValidationError('لا يمكن تعديل حالة القدرة أو مجموعتها.');
    }
  });
}

function assertPageInvariants(pageKey: CmsPageKey, content: CmsPageContent[CmsPageKey]): void {
  assertCtaLinks(content);
  if (pageKey === 'home') {
    const value = content as HomeContent;
    assertCapabilityStructure(value.capabilities.items, home.capabilities.items);
  }
  if (pageKey === 'features') {
    const value = content as FeaturesContent;
    assertCapabilityStructure(value.workflows.items, features.workflows.items);
    assertCapabilityStructure(value.planned.items, features.planned.items);
  }
  if (pageKey === 'join') {
    const value = content as JoinContent;
    if (JSON.stringify(value.fields) !== JSON.stringify(join.fields)) {
      throw new CmsValidationError('لا يمكن تعديل بنية حقول الانضمام.');
    }
  }
  if (pageKey === 'contact') {
    const value = content as ContactContent;
    if (JSON.stringify(value.channels) !== JSON.stringify(contact.channels)) {
      throw new CmsValidationError('لا يمكن تعديل قنوات التواصل من المحتوى.');
    }
  }
}

function mapFaqForRender(items: readonly { question: string; answer: string }[]) {
  return items.map((item) => ({ question: item.question, answer: item.answer }));
}

export function composePageContent(
  pageKey: 'home',
  sectionPayloads: SectionPayloadMap,
  faqItems?: readonly { question: string; answer: string }[],
): HomeContent;
export function composePageContent(
  pageKey: 'features',
  sectionPayloads: SectionPayloadMap,
  faqItems?: readonly { question: string; answer: string }[],
): FeaturesContent;
export function composePageContent(
  pageKey: 'pricing',
  sectionPayloads: SectionPayloadMap,
  faqItems?: readonly { question: string; answer: string }[],
): PricingContent;
export function composePageContent(
  pageKey: 'join',
  sectionPayloads: SectionPayloadMap,
  faqItems?: readonly { question: string; answer: string }[],
): JoinContent;
export function composePageContent(
  pageKey: 'contact',
  sectionPayloads: SectionPayloadMap,
  faqItems?: readonly { question: string; answer: string }[],
): ContactContent;
export function composePageContent(
  pageKey: 'privacy' | 'terms',
  sectionPayloads: SectionPayloadMap,
  faqItems?: readonly { question: string; answer: string }[],
): LegalPageContent;
export function composePageContent(
  pageKey: CmsPageKey,
  sectionPayloads: SectionPayloadMap,
  faqItems?: readonly { question: string; answer: string }[],
): CmsPageContent[CmsPageKey];
export function composePageContent(
  pageKey: CmsPageKey,
  sectionPayloads: SectionPayloadMap,
  faqItems?: readonly { question: string; answer: string }[],
): CmsPageContent[CmsPageKey] {
  const defaults = sectionDefaults(pageKey);
  const merged: SectionPayloadMap = {};
  for (const [sectionKey, defaultValue] of Object.entries(defaults)) {
    const override = sectionPayloads[sectionKey];
    merged[sectionKey] = override ? structuredClone(override) : structuredClone(defaultValue);
  }

  let content: CmsPageContent[CmsPageKey];
  switch (pageKey) {
    case 'home': {
      const items = faqItems?.length ? faqItems : DEFAULT_FAQ_FOR_RENDER;
      content = homeContentSchema.parse({
        ...home,
        hero: merged.hero,
        showcase: merged.showcase,
        problems: merged.problems,
        capabilities: merged.capabilities,
        steps: merged.steps,
        pricingTeaser: merged.pricingTeaser,
        faq: {
          title: (merged.faq as { title: string }).title,
          items: mapFaqForRender(items),
        },
        finalCta: merged.finalCta,
      });
      break;
    }
    case 'features':
      content = featuresContentSchema.parse({
        ...features,
        hero: merged.hero,
        workflows: merged.workflows,
        planned: merged.planned,
        cta: merged.cta,
      });
      break;
    case 'pricing':
      content = pricingContentSchema.parse({
        ...pricing,
        hero: merged.hero,
        earlyAccess: merged.earlyAccess,
        transparency: merged.transparency,
        noPurchase: merged.noPurchase,
        cta: merged.cta,
      });
      break;
    case 'join':
      content = joinContentSchema.parse({
        ...join,
        hero: merged.hero,
        ...merged.form,
        fields: join.fields,
      });
      break;
    case 'contact':
      content = contactContentSchema.parse({
        ...contact,
        hero: merged.hero,
        channelsTitle: (merged.channels as { channelsTitle: string }).channelsTitle,
        emptyNote: (merged.channels as { emptyNote: string }).emptyNote,
        channels: contact.channels,
        joinSuggestion: merged.joinSuggestion,
      });
      break;
    case 'privacy':
    case 'terms': {
      const sectionSchema =
        pageKey === 'privacy' ? legalContentSchema.shape.privacy : legalContentSchema.shape.terms;
      content = {
        draftStatus: legal.draftStatus,
        page: sectionSchema.parse(merged.legal),
      };
      break;
    }
  }

  assertPageInvariants(pageKey, content);
  return content;
}

export const cmsFaqIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,79}$/, INVALID_ID);

export const cmsFaqItemInputSchema = z
  .object({
    id: cmsFaqIdSchema.optional(),
    question: z.string().trim().min(1, REQUIRED_TEXT).max(CMS_TEXT_LIMITS.faqQuestion, TOO_LONG),
    answer: z.string().trim().min(1, REQUIRED_TEXT).max(CMS_TEXT_LIMITS.faqAnswer, TOO_LONG),
    visible: z.boolean(),
  })
  .strict();

export const cmsFaqItemsInputSchema = z
  .array(cmsFaqItemInputSchema)
  .min(1, 'يلزم سؤال واحد على الأقل.')
  .max(CMS_MAX_FAQ_ITEMS, 'عدد الأسئلة أكبر من الحد المسموح.');

export type CmsFaqItemInput = z.infer<typeof cmsFaqItemInputSchema>;

export function assertFaqRenderable(
  items: readonly { id?: string; question: string; answer: string; visible: boolean }[],
): void {
  const visible = items.filter((item) => item.visible);
  if (visible.length === 0) {
    throw new CmsValidationError('يلزم سؤال ظاهر واحد على الأقل قبل النشر.');
  }
  visible.forEach((item) => {
    cmsFaqItemInputSchema.parse({
      id: item.id,
      question: item.question,
      answer: item.answer,
      visible: item.visible,
    });
  });
}

export function assertEditablePayloadSize(values: unknown): void {
  const bytes = new TextEncoder().encode(JSON.stringify(values ?? null)).length;
  if (bytes > CMS_MAX_EDITABLE_JSON_BYTES) {
    throw new CmsValidationError('حجم المحتوى أكبر من الحد المسموح.');
  }
}
