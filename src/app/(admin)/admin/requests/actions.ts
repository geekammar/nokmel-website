'use server';

import { revalidatePath } from 'next/cache';
import { adminRequestsUi } from '@/content/ar/admin-requests';
import { ConfigError } from '@/lib/config-error';
import {
  JoinRequestConflictError,
  JoinRequestNotFoundError,
  JoinStorageError,
  JoinValidationError,
} from '@/lib/join/errors';
import {
  saveJoinRequestNotes,
  updateJoinRequestStatus,
  type JoinRequestDetail,
} from '@/lib/join/service';
import {
  retryJoinRequestNotification,
  type NotificationDeliveryOutcome,
} from '@/lib/notifications/service';
import { getOwnerSession } from '@/lib/owner';

/**
 * Owner-only join-request mutations (W4). Every action independently verifies
 * the owner session; public users can never read or modify these records.
 * Server actions keep Next.js origin/CSRF checks enabled.
 */

export type RequestActionFailure = {
  ok: false;
  code: 'unauthorized' | 'validation' | 'conflict' | 'not_found' | 'storage' | 'unexpected';
  message: string;
};

export type RequestActionResult<T> = { ok: true; data: T } | RequestActionFailure;

function failure(
  code: RequestActionFailure['code'],
  message: string,
): RequestActionFailure {
  return { ok: false, code, message };
}

function mapError(operation: string, error: unknown): RequestActionFailure {
  if (error instanceof JoinRequestConflictError) {
    return failure('conflict', adminRequestsUi.messages.conflict);
  }
  if (error instanceof JoinRequestNotFoundError) {
    return failure('not_found', error.message);
  }
  if (error instanceof JoinValidationError) {
    return failure('validation', error.message);
  }
  if (error instanceof JoinStorageError || error instanceof ConfigError) {
    return failure('storage', adminRequestsUi.messages.storage);
  }
  console.error('[join-requests] action failed', {
    operation,
    error: error instanceof Error ? error.name : 'unknown',
  });
  return failure('unexpected', adminRequestsUi.messages.unexpected);
}

async function ensureOwner(): Promise<RequestActionFailure | null> {
  try {
    const owner = await getOwnerSession();
    if (!owner) return failure('unauthorized', adminRequestsUi.messages.unauthorized);
    return null;
  } catch (error) {
    console.error('[join-requests] owner session check failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return failure('unexpected', adminRequestsUi.messages.unexpected);
  }
}

function revalidateRequest(id: string): void {
  try {
    revalidatePath('/admin/requests');
    revalidatePath(`/admin/requests/${id}`);
  } catch (error) {
    console.error('[join-requests] revalidation failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
}

export async function updateRequestStatusAction(input: {
  id: string;
  revision: number;
  status: unknown;
}): Promise<RequestActionResult<JoinRequestDetail>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await updateJoinRequestStatus({
      id: input.id,
      expectedRevision: input.revision,
      status: input.status,
    });
    revalidateRequest(input.id);
    return { ok: true, data };
  } catch (error) {
    return mapError('status-update', error);
  }
}

export async function saveRequestNotesAction(input: {
  id: string;
  revision: number;
  notes: unknown;
}): Promise<RequestActionResult<JoinRequestDetail>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await saveJoinRequestNotes({
      id: input.id,
      expectedRevision: input.revision,
      notes: input.notes,
    });
    revalidateRequest(input.id);
    return { ok: true, data };
  } catch (error) {
    return mapError('notes-save', error);
  }
}

export async function retryRequestNotificationAction(input: {
  id: string;
}): Promise<RequestActionResult<NotificationDeliveryOutcome>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  if (typeof input.id !== 'string' || input.id.length > 80) {
    return failure('validation', adminRequestsUi.messages.validation);
  }
  try {
    const data = await retryJoinRequestNotification(input.id);
    revalidateRequest(input.id);
    return { ok: true, data };
  } catch {
    return failure('unexpected', adminRequestsUi.messages.unexpected);
  }
}
