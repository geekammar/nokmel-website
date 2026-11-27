import { contact } from '@/content/ar/contact';
import { features } from '@/content/ar/features';
import { home } from '@/content/ar/home';
import { join } from '@/content/ar/join';
import { legal } from '@/content/ar/legal';
import { pricing } from '@/content/ar/pricing';
import type { CmsPageKey } from '@/content/cms/registry';

export type SeoPageDefaults = {
  title: string;
  description: string;
};

export const SEO_PAGE_DEFAULTS: Record<CmsPageKey, SeoPageDefaults> = {
  home: {
    title: 'نكمّل — متجرك في المحادثة. وإدارة طلباتك في مكان واحد.',
    description: home.hero.subheadline,
  },
  features: {
    title: 'الميزات — نكمّل',
    description: features.hero.lead,
  },
  pricing: {
    title: 'الأسعار — نكمّل',
    description: pricing.hero.lead,
  },
  join: {
    title: 'اطلب الانضمام — نكمّل',
    description: join.hero.lead,
  },
  contact: {
    title: 'تواصل معنا — نكمّل',
    description: contact.hero.lead,
  },
  privacy: {
    title: 'سياسة الخصوصية — نكمّل',
    description: legal.privacy.intro,
  },
  terms: {
    title: 'الشروط والأحكام — نكمّل',
    description: legal.terms.intro,
  },
};
