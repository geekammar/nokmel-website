'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { getPageDefinition, type CmsPageKey } from '@/content/cms/registry';
import { adminContentUi } from '@/content/ar/admin-content';
import { ConfigError } from '@/lib/config-error';
import {
  CmsConflictError,
  CmsNoChangesError,
  CmsNoDraftError,
  CmsNotMigratedError,
  CmsStorageError,
  CmsValidationError,
} from '@/lib/cms/errors';
import {
  discardPageDraft,
  getEditorPageData,
  getPublicationReview,
  publishPageContent,
  savePageDraft,
  type PublicationReviewResult,
  type PublishResult,
  type SaveDraftResult,
} from '@/lib/cms/service';
import { getOwnerSession } from '@/lib/owner';

/**
 * Owner-only content mutations (W3.2).
 *
 * Server actions are POST-only and Next.js keeps its server-action origin/CSRF
 * checks enabled. Every action independently re-checks the owner session on
 * the server; the admin layout is not treated as the authorization boundary.
 * Errors are mapped to controlled Arabic messages without SQL/stack details.
 */

export type ContentActionFailure = {
  ok: false;
  code:
    | 'unauthorized'
    | 'conflict'
    | 'validation'
    | 'no_draft'
    | 'no_changes'
    | 'storage'
    | 'invalid_data'
    | 'unexpected';
  message: string;
};

export type ContentActionSuccess<T> = { ok: true; data: T };
export type ContentActionResult<T> = ContentActionSuccess<T> | ContentActionFailure;

function failure(code: ContentActionFailure['code'], message: string): ContentActionFailure {
  return { ok: false, code, message };
}

function mapError(operation: string, error: unknown): ContentActionFailure {
  if (error instanceof CmsConflictError) {
    return failure('conflict', adminContentUi.messages.conflict);
  }
  if (error instanceof CmsNoDraftError) {
    return failure('no_draft', adminContentUi.messages.noDraft);
  }
  if (error instanceof CmsNoChangesError) {
    return failure('no_changes', adminContentUi.messages.noChanges);
  }
  if (error instanceof CmsNotMigratedError) {
    return failure('storage', adminContentUi.messages.storage);
  }
  if (error instanceof CmsValidationError) {
    return failure('invalid_data', adminContentUi.messages.invalidData);
  }
  if (error instanceof ZodError) {
    return failure('validation', adminContentUi.messages.validation);
  }
  if (error instanceof CmsStorageError || error instanceof ConfigError) {
    return failure('storage', adminContentUi.messages.storage);
  }
  console.error('[cms] content action failed', {
    operation,
    error: error instanceof Error ? error.name : 'unknown',
  });
  return failure('unexpected', adminContentUi.messages.unexpected);
}

async function ensureOwner(): Promise<ContentActionFailure | null> {
  try {
    const owner = await getOwnerSession();
    if (!owner) return failure('unauthorized', adminContentUi.messages.unauthorized);
    return null;
  } catch (error) {
    console.error('[cms] owner session check failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return failure('unexpected', adminContentUi.messages.unexpected);
  }
}

function revalidatePaths(paths: string[]): void {
  try {
    for (const path of paths) revalidatePath(path);
  } catch (error) {
    console.error('[cms] post-publish revalidation failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
}

function revalidatePublicPage(pageKey: CmsPageKey): void {
  const page = getPageDefinition(pageKey);
  const paths = [page.path, `/admin/content/${pageKey}`];
  if (pageKey === 'home') paths.push('/');
  revalidatePaths(paths);
}

export async function saveDraftAction(input: {
  pageKey: string;
  revision: number;
  values: unknown;
  faqItems?: unknown;
}): Promise<ContentActionResult<SaveDraftResult>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await savePageDraft({
      pageKey: input.pageKey,
      locale: 'ar',
      expectedRevision: input.revision,
      values: input.values,
      faqItems: input.faqItems,
    });
    return { ok: true, data };
  } catch (error) {
    return mapError('save-draft', error);
  }
}

export async function getPublicationReviewAction(input: {
  pageKey: string;
  revision: number;
}): Promise<ContentActionResult<PublicationReviewResult>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await getPublicationReview({
      pageKey: input.pageKey,
      locale: 'ar',
      expectedRevision: input.revision,
    });
    return { ok: true, data };
  } catch (error) {
    return mapError('publication-review', error);
  }
}

export async function publishContentAction(input: {
  pageKey: string;
  revision: number;
}): Promise<ContentActionResult<PublishResult>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await publishPageContent({
      pageKey: input.pageKey,
      locale: 'ar',
      expectedRevision: input.revision,
    });
    revalidatePublicPage(input.pageKey as CmsPageKey);
    return { ok: true, data };
  } catch (error) {
    return mapError('publish', error);
  }
}

export type DiscardActionData = {
  revision: number;
  hasDraft: false;
  hasPublished: boolean;
  lastPublishedAt: string | null;
  values: unknown | null;
  faqItems: unknown | null;
};

export async function discardDraftAction(input: {
  pageKey: string;
  revision: number;
}): Promise<ContentActionResult<DiscardActionData>> {
  const unauthorized = await ensureOwner();
  if (unauthorized) return unauthorized;
  try {
    const data = await discardPageDraft({
      pageKey: input.pageKey,
      locale: 'ar',
      expectedRevision: input.revision,
    });
    const fresh = await getEditorPageData(input.pageKey, 'ar');
    revalidatePaths([`/admin/content/${input.pageKey}`]);
    return {
      ok: true,
      data: {
        ...data,
        values: fresh.status === 'ok' ? fresh.data.values : null,
        faqItems: fresh.status === 'ok' ? fresh.data.faqItems : null,
      },
    };
  } catch (error) {
    return mapError('discard-draft', error);
  }
}
