/**
 * Admin shell + login strings (W3.1).
 *
 * W3.1 implements only the admin foundation: the login page, the protected
 * shell, the Overview section, and the future information architecture shown
 * honestly as unavailable. No fake dashboards, metrics, or application data.
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
    welcome: 'مرحباً بك في لوحة إدارة نكّمل.',
    overviewEmptyTitle: 'لا توجد بيانات لعرضها بعد',
    overviewEmptyBody:
      'ستظهر هنا ملخصات الموقع وطلبات الانضمام عند تفعيل الأقسام الإدارية القادمة. يمكنك التنقل من القائمة للاطلاع على الأقسام المتاحة.',
    unavailableNote: 'غير متاح — في مرحلة لاحقة',
  },
  nav: [
    { id: 'overview', label: 'نظرة عامة', available: true },
    { id: 'content-seo', label: 'المحتوى والـSEO', available: false },
    { id: 'plans-pricing', label: 'الباقات والأسعار', available: false },
    { id: 'join-requests', label: 'طلبات الانضمام', available: false },
    { id: 'settings', label: 'الإعدادات', available: false },
  ],
} as const;
