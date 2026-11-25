/**
 * CMS error types. Messages are controlled and safe to show to the owner;
 * they never include SQL, stack traces, credentials, or internal details.
 */

export class CmsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CmsError';
  }
}

export class CmsValidationError extends CmsError {
  constructor(message = 'بيانات المحتوى غير صالحة.') {
    super(message);
    this.name = 'CmsValidationError';
  }
}

export class CmsConflictError extends CmsError {
  constructor(message = 'تم تعديل المحتوى من جلسة أخرى. أعد تحميل أحدث نسخة.') {
    super(message);
    this.name = 'CmsConflictError';
  }
}

export class CmsNoDraftError extends CmsError {
  constructor(message = 'لا توجد مسودة محفوظة للنشر.') {
    super(message);
    this.name = 'CmsNoDraftError';
  }
}

export class CmsNoChangesError extends CmsError {
  constructor(message = 'لا توجد تغييرات غير منشورة لتجاهلها.') {
    super(message);
    this.name = 'CmsNoChangesError';
  }
}

export class CmsStorageError extends CmsError {
  constructor(message = 'تعذّر الوصول إلى تخزين المحتوى.') {
    super(message);
    this.name = 'CmsStorageError';
  }
}

export class CmsNotMigratedError extends CmsStorageError {
  constructor(message = 'جداول المحتوى غير مهيأة في قاعدة البيانات.') {
    super(message);
    this.name = 'CmsNotMigratedError';
  }
}
