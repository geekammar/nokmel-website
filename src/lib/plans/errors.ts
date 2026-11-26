export type PlanErrorCode =
  | 'validation'
  | 'conflict'
  | 'not_found'
  | 'duplicate_slug'
  | 'storage'
  | 'not_migrated'
  | 'unconfigured'
  | 'unexpected';

export class PlanError extends Error {
  readonly code: PlanErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    code: PlanErrorCode,
    message: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'PlanError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class PlanValidationError extends PlanError {
  constructor(fieldErrors: Record<string, string> = {}) {
    super('validation', 'تحقق من حقول الباقة ثم أعد المحاولة.', fieldErrors);
    this.name = 'PlanValidationError';
  }
}

export class PlanConflictError extends PlanError {
  constructor() {
    super(
      'conflict',
      'عُدّلت هذه الباقة من جلسة أو جهاز آخر. لم تُحفظ تغييراتك. أعد تحميل أحدث نسخة ثم أعد المحاولة.',
    );
    this.name = 'PlanConflictError';
  }
}

export class PlanNotFoundError extends PlanError {
  constructor() {
    super('not_found', 'الباقة غير موجودة.');
    this.name = 'PlanNotFoundError';
  }
}

export class PlanDuplicateSlugError extends PlanError {
  constructor() {
    super('duplicate_slug', 'هذا المعرّف مستخدم لباقة أخرى. اختر معرّفاً مختلفاً.', {
      slug: 'هذا المعرّف مستخدم لباقة أخرى.',
    });
    this.name = 'PlanDuplicateSlugError';
  }
}

export class PlanStorageError extends PlanError {
  constructor() {
    super('storage', 'تعذّر الوصول إلى تخزين الباقات. لم يتم حفظ أي تغيير.');
    this.name = 'PlanStorageError';
  }
}
