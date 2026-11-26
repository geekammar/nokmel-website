'use server';

import { revalidatePath } from 'next/cache';
import { adminSettingsUi } from '@/content/ar/admin-settings';
import { getOwnerSession } from '@/lib/owner';
import {
  sendOwnerTestNotification,
  type NotificationTestResult,
} from '@/lib/notifications/service';
import {
  SettingsConflictError,
  SettingsStorageError,
  SettingsValidationError,
  saveAnalyticsSettings,
  saveNotificationSettings,
  savePublicSettings,
} from '@/lib/settings/service';
import type {
  AnalyticsSettingsValues,
  NotificationSettingsValues,
  PublicSettings,
  PublicSettingsFormValues,
} from '@/lib/settings/model';

/**
 * Owner-only settings mutations (W5). Each server action independently checks
 * the owner session. Validation is server-side; stale optimistic revisions are
 * rejected; secrets are never accepted or returned.
 */

export type SettingsActionFailure = {
  ok: false;
  code: 'unauthorized' | 'validation' | 'conflict' | 'storage' | 'unexpected';
  message: string;
  fieldErrors?: Record<string, string>;
};

export type SettingsActionResult<T> = { ok: true; data: T } | SettingsActionFailure;

function failure(
  code: SettingsActionFailure['code'],
  message: string,
  fieldErrors?: Record<string, string>,
): SettingsActionFailure {
  return { ok: false, code, message, ...(fieldErrors ? { fieldErrors } : {}) };
}

function mapError(operation: string, error: unknown): SettingsActionFailure {
  if (error instanceof SettingsConflictError) {
    return failure('conflict', adminSettingsUi.messages.conflict);
  }
  if (error instanceof SettingsValidationError) {
    return failure('validation', adminSettingsUi.messages.validation, error.fieldErrors);
  }
  if (error instanceof SettingsStorageError) {
    return failure('storage', adminSettingsUi.messages.storage);
  }
  console.error('[settings] action failed', {
    operation,
    error: error instanceof Error ? error.name : 'unknown',
  });
  return failure('unexpected', adminSettingsUi.messages.unexpected);
}

async function ensureOwner(): Promise<SettingsActionFailure | null> {
  try {
    const owner = await getOwnerSession();
    if (!owner) return failure('unauthorized', adminSettingsUi.messages.unauthorized);
    return null;
  } catch {
    return failure('unexpected', adminSettingsUi.messages.unexpected);
  }
}

function revalidateSettings(): void {
  try {
    revalidatePath('/admin/settings');
    revalidatePath('/contact');
    revalidatePath('/');
  } catch {
    // Revalidation is best effort; the database is authoritative.
  }
}

export async function savePublicSettingsAction(input: {
  expectedRevision: number;
  values: PublicSettingsFormValues;
}): Promise<SettingsActionResult<{ revision: number; settings: PublicSettings }>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await savePublicSettings(input);
    revalidateSettings();
    return { ok: true, data };
  } catch (error) {
    return mapError('public-save', error);
  }
}

export async function saveNotificationSettingsAction(input: {
  expectedRevision: number;
  values: NotificationSettingsValues;
}): Promise<
  SettingsActionResult<{
    revision: number;
    notificationsEnabled: boolean;
    telegramChatIdMasked: string | null;
  }>
> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await saveNotificationSettings(input);
    revalidateSettings();
    return { ok: true, data };
  } catch (error) {
    return mapError('notification-save', error);
  }
}

export async function saveAnalyticsSettingsAction(input: {
  expectedRevision: number;
  values: AnalyticsSettingsValues;
}): Promise<SettingsActionResult<AnalyticsSettingsValues & { revision: number }>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await saveAnalyticsSettings(input);
    revalidateSettings();
    return { ok: true, data: { ...data.settings, revision: data.revision } };
  } catch (error) {
    return mapError('analytics-save', error);
  }
}

export type TestNotificationActionResult =
  | { ok: true; data: NotificationTestResult }
  | SettingsActionFailure;

export async function sendNotificationTestAction(): Promise<TestNotificationActionResult> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await sendOwnerTestNotification();
    revalidateSettings();
    return { ok: true, data };
  } catch (error) {
    return mapError('test-notification', error);
  }
}
