'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { adminPlansUi } from '@/content/ar/admin-plans';
import { ConfigError } from '@/lib/config-error';
import { getOwnerSession } from '@/lib/owner';
import { PlanError } from '@/lib/plans/errors';
import type { OwnerPlan } from '@/lib/plans/model';
import {
  createPlan,
  hidePlan,
  publishPlan,
  savePlanDraft,
} from '@/lib/plans/service';

/**
 * Owner-only marketing-plan mutations (W4). Server actions are POST-only and
 * Next.js origin/CSRF checks stay enabled. Each action independently verifies
 * the owner session; the admin layout is not the authorization boundary.
 */

export type PlanActionFailure = {
  ok: false;
  code:
    | 'unauthorized'
    | 'validation'
    | 'conflict'
    | 'not_found'
    | 'duplicate_slug'
    | 'storage'
    | 'unexpected';
  message: string;
  fieldErrors?: Record<string, string>;
};

export type PlanActionResult<T> =
  | { ok: true; data: T }
  | PlanActionFailure;

function failure(
  code: PlanActionFailure['code'],
  message: string,
  fieldErrors?: Record<string, string>,
): PlanActionFailure {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

function mapError(operation: string, error: unknown): PlanActionFailure {
  if (error instanceof PlanError) {
    const message =
      error.code === 'validation'
        ? adminPlansUi.messages.validation
        : error.code === 'conflict'
          ? adminPlansUi.messages.conflict
          : error.code === 'duplicate_slug' || error.code === 'not_found'
            ? error.message
            : adminPlansUi.messages.storage;
    const code =
      error.code === 'validation' ||
      error.code === 'conflict' ||
      error.code === 'duplicate_slug' ||
      error.code === 'not_found'
        ? error.code
        : 'storage';
    return failure(code, message, error.fieldErrors);
  }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      fieldErrors[issue.path.map(String).join('.') || 'form'] ??= issue.message;
    }
    return failure('validation', adminPlansUi.messages.validation, fieldErrors);
  }
  if (error instanceof ConfigError) {
    return failure('storage', adminPlansUi.messages.storage);
  }
  console.error('[plans] action failed', {
    operation,
    error: error instanceof Error ? error.name : 'unknown',
  });
  return failure('unexpected', adminPlansUi.messages.unexpected);
}

async function ensureOwner(): Promise<PlanActionFailure | null> {
  try {
    const owner = await getOwnerSession();
    if (!owner) return failure('unauthorized', adminPlansUi.messages.unauthorized);
    return null;
  } catch (error) {
    console.error('[plans] owner session check failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return failure('unexpected', adminPlansUi.messages.unexpected);
  }
}

function revalidatePlans(planId?: string): void {
  try {
    revalidatePath('/pricing');
    revalidatePath('/join');
    revalidatePath('/admin/plans');
    if (planId) revalidatePath(`/admin/plans/${planId}`);
  } catch (error) {
    console.error('[plans] revalidation failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
}

export async function createPlanAction(input: {
  slug: unknown;
  values: unknown;
}): Promise<PlanActionResult<{ id: string }>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const plan = await createPlan({ slug: input.slug, values: input.values });
    revalidatePlans(plan.id);
    return { ok: true, data: { id: plan.id } };
  } catch (error) {
    return mapError('create', error);
  }
}

export async function savePlanAction(input: {
  id: string;
  revision: number;
  values: unknown;
}): Promise<PlanActionResult<OwnerPlan>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const plan = await savePlanDraft({
      id: input.id,
      expectedRevision: input.revision,
      values: input.values,
    });
    revalidatePlans(plan.id);
    return { ok: true, data: plan };
  } catch (error) {
    return mapError('save-draft', error);
  }
}

export async function publishPlanAction(input: {
  id: string;
  revision: number;
}): Promise<PlanActionResult<OwnerPlan>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const plan = await publishPlan({
      id: input.id,
      expectedRevision: input.revision,
    });
    revalidatePlans(plan.id);
    return { ok: true, data: plan };
  } catch (error) {
    return mapError('publish', error);
  }
}

export async function hidePlanAction(input: {
  id: string;
  revision: number;
}): Promise<PlanActionResult<OwnerPlan>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const plan = await hidePlan({
      id: input.id,
      expectedRevision: input.revision,
    });
    revalidatePlans(plan.id);
    return { ok: true, data: plan };
  } catch (error) {
    return mapError('hide', error);
  }
}
