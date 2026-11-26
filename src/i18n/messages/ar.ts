export const ar = {
  common: {
    skipLink: 'تخطَّ إلى المحتوى',
    main: 'المحتوى الرئيسي',
  },
  nav: {
    primary: 'التنقل الرئيسي',
    mobile: 'قائمة التنقل للجوال',
    home: 'نكمّل — الصفحة الرئيسية',
    menu: 'القائمة',
    closeMenu: 'إغلاق القائمة',
    footerExplore: 'روابط الاستكشاف',
    items: [
      { href: '/', label: 'الرئيسية' },
      { href: '/features', label: 'الميزات' },
      { href: '/pricing', label: 'الأسعار' },
      { href: '/contact', label: 'تواصل معنا' },
    ],
  },
  footer: {
    description:
      'نكمّل منصة تجارة تساعد أصحاب المتاجر على إدارة متاجرهم وعملياتهم التجارية من خلال قنوات المحادثة.',
    exploreTitle: 'التنقل',
    explore: [
      { href: '/', label: 'الرئيسية' },
      { href: '/features', label: 'الميزات' },
      { href: '/pricing', label: 'الأسعار' },
      { href: '/join', label: 'اطلب الانضمام' },
      { href: '/contact', label: 'تواصل معنا' },
    ],
    legalTitle: 'القانونية',
    legal: [
      { href: '/privacy', label: 'سياسة الخصوصية' },
      { href: '/terms', label: 'الشروط والأحكام' },
    ],
    tagline: 'خلي بزنسك يكمل.',
    contactTitle: 'تواصل معنا',
    earlyAccessNote: 'نكمّل في مرحلة الانضمام المبكر — الشراء التجاري غير مفعّل بعد.',
    rights: '© 2026 Nokmel — نكمّل. جميع الحقوق محفوظة.',
  },
} as const;

export type Messages = typeof ar;
