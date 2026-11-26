/**
 * Admin shell + login strings (W3.1; W5 activates all five sections).
 *
 * The admin shell contains exactly the five approved primary sections. W5
 * replaces the Overview placeholder with database-backed business metrics and
 * activates Settings; no sixth section is added.
 */

export const adminUi = {
  login: {
    heading: 'تسجيل دخول المالك',
    subheading: 'لوحة إدارة موقع نكّمل — للمالك فقط.',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    submit: 'تسجيل الدخول',
    submitting: 'جارٍ تسجيل الدخول…',
    invalidCredentials: 'بيانات الدخول غير صحيحة.',
    rateLimited: 'محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.',
    rateLimitedRetry: 'يمكنك المحاولة مرة أخرى بعد {seconds} ثانية تقريباً.',
    authUnavailable: 'خدمة الدخول غير مهيأة حالياً. حاول لاحقاً أو تواصل مع مشرف الموقع.',
    unexpectedError: 'تعذّر تسجيل الدخول. حاول مرة أخرى.',
  },
  shell: {
    adminTitle: 'إدارة نكّمل',
    ownerSession: 'جلسة المالك',
    logout: 'تسجيل الخروج',
    navLabel: 'التنقل في لوحة الإدارة',
    overviewTitle: 'نظرة عامة',
  },
  nav: [
    { id: 'overview', label: 'نظرة عامة', available: true, href: '/admin' },
    { id: 'content-seo', label: 'المحتوى والـSEO', available: true, href: '/admin/content' },
    { id: 'plans-pricing', label: 'الباقات والأسعار', available: true, href: '/admin/plans' },
    { id: 'join-requests', label: 'طلبات الانضمام', available: true, href: '/admin/requests' },
    { id: 'settings', label: 'الإعدادات', available: true, href: '/admin/settings' },
  ],
} as const;
