import type { PublicPlan } from '@/lib/plans/model';

export class JoinPlanUnavailableError extends Error {
  constructor() {
    super('الخطة المختارة لم تعد متاحة للانضمام.');
    this.name = 'JoinPlanUnavailableError';
  }
}

export class JoinPlanChangedError extends Error {
  readonly currentPlan: PublicPlan;

  constructor(currentPlan: PublicPlan) {
    super('تغيّر العرض المختار بعد فتح النموذج.');
    this.name = 'JoinPlanChangedError';
    this.currentPlan = currentPlan;
  }
}

export class JoinRequestConflictError extends Error {
  constructor() {
    super(
      'عُدّل هذا الطلب من جلسة أو جهاز آخر. لم تُحفظ تغييراتك. أعد تحميل أحدث نسخة ثم أعد المحاولة.',
    );
    this.name = 'JoinRequestConflictError';
  }
}

export class JoinRequestNotFoundError extends Error {
  constructor() {
    super('طلب الانضمام غير موجود.');
    this.name = 'JoinRequestNotFoundError';
  }
}

export class JoinStorageError extends Error {
  constructor() {
    super('تعذّر الوصول إلى تخزين طلبات الانضمام. لم يُسجّل الطلب.');
    this.name = 'JoinStorageError';
  }
}

export class JoinValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JoinValidationError';
  }
}
