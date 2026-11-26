import { randomUUID } from 'node:crypto';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import { joinRequests, plans } from '@/lib/db/schema';
import type { Db } from '@/lib/db/types';
import { toPublicPlan, type PublicPlan, type SupportedCurrencyCode } from '@/lib/plans/model';
import {
  buildOfferSnapshot,
  parseOfferSnapshot,
  type OfferSnapshot,
} from './snapshot';
import {
  JoinPlanChangedError,
  JoinPlanUnavailableError,
  JoinRequestConflictError,
  JoinRequestNotFoundError,
  JoinStorageError,
  JoinValidationError,
} from './errors';
import type { JoinSource, JoinSubmission } from './validation';

/**
 * Server-side join-request service (W4).
 *
 * Public creation is write-only and always sets status `new`, null internal
 * notes, server timestamps/IDs, and a server-generated snapshot of the current
 * published marketing offer inside the same transaction. Owner list/detail/
 * mutation functions are never mounted on public routes.
 */

export const JOIN_REQUEST_STATUSES = ['new', 'contacted', 'closed'] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export type JoinRequestPlanSnapshot = {
  planId: string;
  name: string;
  priceMinor: number | null;
  pricePeriod: 'monthly' | 'yearly' | null;
  currency: SupportedCurrencyCode;
};

export type JoinRequestSummary = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  businessActivity: string | null;
  planNameSnapshot: string | null;
  planPriceMinorSnapshot: number | null;
  planPricePeriodSnapshot: 'monthly' | 'yearly' | null;
  planCurrencySnapshot: SupportedCurrencyCode | null;
  source: JoinSource;
  status: JoinRequestStatus;
  createdAt: string;
};

export type JoinRequestDetail = JoinRequestSummary & {
  planId: string | null;
  offerSnapshot: OfferSnapshot | null;
  offerSnapshotInvalid: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  notes: string | null;
  revision: number;
  updatedAt: string;
};

export type JoinRequestStorageStatus =
  | 'ok'
  | 'unconfigured'
  | 'not_migrated'
  | 'unavailable'
  | 'invalid';

export type JoinRequestListResult =
  | {
      status: 'ok';
      requests: JoinRequestSummary[];
      counts: Record<JoinRequestStatus, number>;
      filteredTotal: number;
      page: number;
      pageSize: number;
    }
  | { status: Exclude<JoinRequestStorageStatus, 'ok'>; message: string };

export type JoinRequestDetailResult =
  | { status: 'ok'; request: JoinRequestDetail }
  | { status: Exclude<JoinRequestStorageStatus, 'ok'>; message: string };

export type CreateJoinRequestResult =
  | { created: true; id: string }
  | { created: false; duplicate: true };

type JoinServiceOptions = { db?: Db; asOf?: Date };
type JoinRequestRow = typeof joinRequests.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const STORAGE_MESSAGES: Record<Exclude<JoinRequestStorageStatus, 'ok'>, string> = {
  unconfigured:
    'تخزين طلبات الانضمام غير مهيأ في هذه البيئة. لا يمكن عرض الطلبات أو تعديلها.',
  not_migrated:
    'جداول طلبات الانضمام غير مهيأة في قاعدة البيانات. طبّق migrations W4 أولاً.',
  unavailable: 'تعذّر الوصول إلى تخزين طلبات الانضمام مؤقتاً.',
  invalid: 'بيانات طلب الانضمام المحفوظة غير صالحة.',
};

function resolveDb(options: JoinServiceOptions): Db {
  return options.db ?? getDb().db;
}

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function logJoinFailure(operation: string, error: unknown): void {
  const reason =
    error instanceof ConfigError
      ? 'unconfigured'
      : postgresErrorCode(error) === '42P01'
        ? 'not_migrated'
        : error instanceof JoinRequestConflictError || error instanceof JoinRequestNotFoundError
          ? error.name
          : 'unavailable';
  console.error(`[join-requests] ${operation} failed`, { reason });
}

function storageFailure(error: unknown): {
  status: Exclude<JoinRequestStorageStatus, 'ok'>;
  message: string;
} {
  if (error instanceof ConfigError) {
    return { status: 'unconfigured', message: STORAGE_MESSAGES.unconfigured };
  }
  if (postgresErrorCode(error) === '42P01') {
    return { status: 'not_migrated', message: STORAGE_MESSAGES.not_migrated };
  }
  return { status: 'unavailable', message: STORAGE_MESSAGES.unavailable };
}

function asStatus(value: string): JoinRequestStatus {
  if ((JOIN_REQUEST_STATUSES as readonly string[]).includes(value)) {
    return value as JoinRequestStatus;
  }
  throw new JoinStorageError();
}

function asSource(value: string): JoinSource {
  if (value === 'direct' || value === 'pricing' || value === 'join') return value;
  throw new JoinStorageError();
}

function asPricePeriod(value: string | null): 'monthly' | 'yearly' | null {
  if (value === null) return null;
  if (value === 'monthly' || value === 'yearly') return value;
  throw new JoinStorageError();
}

function summaryFromRow(row: JoinRequestRow): JoinRequestSummary {
  if (typeof row.name !== 'string' || typeof row.phone !== 'string') {
    throw new JoinStorageError();
  }
  const currency =
    row.planCurrencySnapshot === null
      ? null
      : (row.planCurrencySnapshot as SupportedCurrencyCode);
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    businessActivity: row.businessActivity,
    planNameSnapshot: row.planNameSnapshot,
    planPriceMinorSnapshot: row.planPriceMinorSnapshot,
    planPricePeriodSnapshot: asPricePeriod(row.planPricePeriodSnapshot),
    planCurrencySnapshot: currency,
    source: asSource(row.source),
    status: asStatus(row.status),
    createdAt: row.createdAt.toISOString(),
  };
}

function detailFromRow(row: JoinRequestRow): JoinRequestDetail {
  const parsedSnapshot = parseOfferSnapshot(row.offerSnapshot);
  return {
    ...summaryFromRow(row),
    planId: row.planId,
    offerSnapshot:
      parsedSnapshot.status === 'valid' ? parsedSnapshot.snapshot : null,
    offerSnapshotInvalid: parsedSnapshot.status === 'invalid',
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    notes: row.notes,
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function publishedPlanSelection(plan: PublicPlan): {
  priceMinor: number | null;
  pricePeriod: 'monthly' | 'yearly' | null;
} {
  if (plan.offer.monthly.effectiveMinor !== null) {
    return { priceMinor: plan.offer.monthly.effectiveMinor, pricePeriod: 'monthly' };
  }
  if (plan.offer.yearly.effectiveMinor !== null) {
    return { priceMinor: plan.offer.yearly.effectiveMinor, pricePeriod: 'yearly' };
  }
  return { priceMinor: null, pricePeriod: null };
}

/**
 * Public write transaction. The selected plan is re-resolved from the current
 * published data; the client cannot provide trusted names or prices. A stale
 * effective-offer version rejects the request without silently changing the
 * selection.
 */
export async function createJoinRequest(
  submission: JoinSubmission,
  options: JoinServiceOptions = {},
): Promise<CreateJoinRequestResult> {
  const asOf = options.asOf ?? new Date();
  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logJoinFailure('create', error);
    throw new JoinStorageError();
  }

  try {
    return await db.transaction(async (tx) => {
      /**
       * Serialize same-token operations. A committed request is resolved
       * before any current-offer validation, so a lost-response retry succeeds
       * even if the plan was republished/hidden in the meantime. Concurrent
       * same-token callers wait for the first transaction and then observe the
       * committed row instead of racing plan validation/INSERT.
       */
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`nokmel.join.token:${submission.submissionToken}`})::bigint)`,
      );
      const existing = await tx
        .select({ id: joinRequests.id })
        .from(joinRequests)
        .where(eq(joinRequests.submissionToken, submission.submissionToken))
        .limit(1);
      if (existing.length > 0) return { created: false, duplicate: true };

      let snapshot: JoinRequestPlanSnapshot | null = null;
      let offerSnapshot: OfferSnapshot | null = null;

      if (submission.planSlug) {
        /**
         * One row read provides the complete offer context. FOR SHARE makes a
         * concurrent plan publication/update wait until this transaction
         * commits, so the accepted snapshot and the validated current offer
         * cannot be mixed.
         */
        const rows = await tx
          .select({
            id: plans.id,
            slug: plans.slug,
            name: plans.publishedName,
            description: plans.publishedDescription,
            features: plans.publishedFeatures,
            monthlyPriceMinor: plans.publishedMonthlyPriceMinor,
            yearlyPriceMinor: plans.publishedYearlyPriceMinor,
            currency: plans.publishedCurrency,
            ctaLabel: plans.publishedCtaLabel,
            featured: plans.publishedFeatured,
            displayOrder: plans.publishedDisplayOrder,
            publishedRevision: plans.publishedRevision,
            publishedPromotion: plans.publishedPromotion,
          })
          .from(plans)
          .where(and(eq(plans.slug, submission.planSlug), eq(plans.status, 'published')))
          .limit(1)
          .for('share');
        const row = rows[0];
        if (
          !row ||
          row.name === null ||
          row.description === null ||
          row.currency === null ||
          row.ctaLabel === null ||
          row.featured === null ||
          row.displayOrder === null ||
          row.publishedRevision === null
        ) {
          throw new JoinPlanUnavailableError();
        }
        let currentPlan: PublicPlan;
        try {
          currentPlan = toPublicPlan(
            {
              slug: row.slug,
              name: row.name,
              description: row.description,
              features: row.features,
              monthlyPriceMinor: row.monthlyPriceMinor,
              yearlyPriceMinor: row.yearlyPriceMinor,
              currency: row.currency,
              ctaLabel: row.ctaLabel,
              featured: row.featured,
              displayOrder: row.displayOrder,
              publishedRevision: row.publishedRevision,
              publishedPromotion: row.publishedPromotion,
            },
            asOf,
          );
        } catch {
          throw new JoinPlanUnavailableError();
        }
        if (submission.offerVersion === null) {
          throw new JoinPlanUnavailableError();
        }
        if (submission.offerVersion !== currentPlan.offer.version) {
          throw new JoinPlanChangedError(currentPlan);
        }
        const price = publishedPlanSelection(currentPlan);
        snapshot = {
          planId: row.id,
          name: currentPlan.name,
          priceMinor: price.priceMinor,
          pricePeriod: price.pricePeriod,
          currency: currentPlan.currency,
        };
        offerSnapshot = buildOfferSnapshot({
          plan: currentPlan,
          planId: row.id,
          offer: currentPlan.offer,
          capturedAt: asOf,
        });
      }

      const now = new Date();
      const inserted = await tx
        .insert(joinRequests)
        .values({
          id: randomUUID(),
          name: submission.name,
          phone: submission.phone,
          email: submission.email,
          businessActivity: submission.businessActivity,
          planId: snapshot?.planId ?? null,
          planNameSnapshot: snapshot?.name ?? null,
          planPriceMinorSnapshot: snapshot?.priceMinor ?? null,
          planPricePeriodSnapshot: snapshot?.pricePeriod ?? null,
          planCurrencySnapshot: snapshot?.currency ?? null,
          offerSnapshot,
          source: submission.source,
          utmSource: submission.utmSource,
          utmMedium: submission.utmMedium,
          utmCampaign: submission.utmCampaign,
          status: 'new',
          notes: null,
          submissionToken: submission.submissionToken,
          revision: 0,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: joinRequests.submissionToken })
        .returning({ id: joinRequests.id });

      if (inserted.length === 0) return { created: false, duplicate: true };
      return { created: true, id: inserted[0].id };
    });
  } catch (error) {
    if (
      error instanceof JoinPlanUnavailableError ||
      error instanceof JoinPlanChangedError
    ) {
      throw error;
    }
    if (postgresErrorCode(error) === '42P01' || error instanceof ConfigError) {
      throw new JoinStorageError();
    }
    logJoinFailure('create', error);
    throw new JoinStorageError();
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function listJoinRequests(
  args: {
    status?: JoinRequestStatus | 'all';
    query?: string;
    page?: number;
    pageSize?: number;
  },
  options: JoinServiceOptions = {},
): Promise<JoinRequestListResult> {
  const pageSize = Math.min(50, Math.max(1, Math.trunc(args.pageSize ?? 20)));
  const page = Math.min(10_000, Math.max(1, Math.trunc(args.page ?? 1)));
  const status = args.status && args.status !== 'all' ? args.status : null;
  const query = (args.query ?? '').trim().slice(0, 100);
  const filters = [];
  if (status) filters.push(eq(joinRequests.status, status));
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    filters.push(
      or(ilike(joinRequests.name, pattern), ilike(joinRequests.phone, pattern)),
    );
  }
  const where = filters.length > 0 ? and(...filters) : undefined;

  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logJoinFailure('list', error);
    return storageFailure(error);
  }

  try {
    const rows = await db
      .select()
      .from(joinRequests)
      .where(where)
      .orderBy(desc(joinRequests.createdAt), desc(joinRequests.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countRows = await db
      .select({
        status: joinRequests.status,
        count: sql<number>`count(*)::int`,
      })
      .from(joinRequests)
      .groupBy(joinRequests.status);

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(joinRequests)
      .where(where);

    const counts: Record<JoinRequestStatus, number> = {
      new: 0,
      contacted: 0,
      closed: 0,
    };
    for (const row of countRows) {
      if (
        row.status === 'new' ||
        row.status === 'contacted' ||
        row.status === 'closed'
      ) {
        counts[row.status] = Number(row.count);
      }
    }

    try {
      return {
        status: 'ok',
        requests: rows.map(summaryFromRow),
        counts,
        filteredTotal: Number(totalRows[0]?.count ?? 0),
        page,
        pageSize,
      };
    } catch (error) {
      logJoinFailure('list-invalid', error);
      return { status: 'invalid', message: STORAGE_MESSAGES.invalid };
    }
  } catch (error) {
    logJoinFailure('list', error);
    return storageFailure(error);
  }
}

export async function getJoinRequest(
  rawId: unknown,
  options: JoinServiceOptions = {},
): Promise<JoinRequestDetailResult> {
  if (typeof rawId !== 'string' || rawId.length > 80) {
    return { status: 'invalid', message: 'طلب الانضمام غير موجود.' };
  }
  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logJoinFailure('detail', error);
    return storageFailure(error);
  }
  try {
    const rows = await db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, rawId))
      .limit(1);
    const row = rows[0];
    if (!row) return { status: 'invalid', message: 'طلب الانضمام غير موجود.' };
    try {
      return { status: 'ok', request: detailFromRow(row) };
    } catch (error) {
      logJoinFailure('detail-invalid', error);
      return { status: 'invalid', message: STORAGE_MESSAGES.invalid };
    }
  } catch (error) {
    logJoinFailure('detail', error);
    return storageFailure(error);
  }
}

function assertRevision(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 1_000_000
  ) {
    throw new JoinRequestConflictError();
  }
  return value;
}

async function updateByRevision(
  db: Db,
  args: {
    id: unknown;
    expectedRevision: unknown;
    set: Partial<typeof joinRequests.$inferInsert>;
  },
): Promise<JoinRequestDetail> {
  if (typeof args.id !== 'string' || args.id.length > 80) {
    throw new JoinRequestNotFoundError();
  }
  const expectedRevision = assertRevision(args.expectedRevision);
  const rows = await db
    .update(joinRequests)
    .set({
      ...args.set,
      revision: expectedRevision + 1,
      updatedAt: new Date(),
    })
    .where(
      and(eq(joinRequests.id, args.id), eq(joinRequests.revision, expectedRevision)),
    )
    .returning();
  const row = rows[0];
  if (row) return detailFromRow(row);
  const exists = await db
    .select({ id: joinRequests.id })
    .from(joinRequests)
    .where(eq(joinRequests.id, args.id))
    .limit(1);
  if (exists.length === 0) throw new JoinRequestNotFoundError();
  throw new JoinRequestConflictError();
}

export async function updateJoinRequestStatus(
  args: { id: unknown; expectedRevision: unknown; status: unknown },
  options: JoinServiceOptions = {},
): Promise<JoinRequestDetail> {
  if (
    typeof args.status !== 'string' ||
    !(JOIN_REQUEST_STATUSES as readonly string[]).includes(args.status)
  ) {
    throw new JoinValidationError('حالة الطلب غير صالحة.');
  }
  const db = resolveDb(options);
  try {
    return await updateByRevision(db, {
      id: args.id,
      expectedRevision: args.expectedRevision,
      set: { status: args.status },
    });
  } catch (error) {
    if (
      error instanceof JoinRequestConflictError ||
      error instanceof JoinRequestNotFoundError ||
      error instanceof JoinValidationError
    ) {
      throw error;
    }
    if (postgresErrorCode(error) === '42P01') throw new JoinStorageError();
    logJoinFailure('status-update', error);
    throw error;
  }
}

export async function saveJoinRequestNotes(
  args: { id: unknown; expectedRevision: unknown; notes: unknown },
  options: JoinServiceOptions = {},
): Promise<JoinRequestDetail> {
  if (typeof args.notes !== 'string') {
    throw new JoinValidationError('نص الملاحظات غير صالح.');
  }
  const trimmed = args.notes.trim();
  if (trimmed.length > 4000) {
    throw new JoinValidationError('الملاحظات أطول من الحد المسموح (4000 حرف).');
  }
  const db = resolveDb(options);
  try {
    return await updateByRevision(db, {
      id: args.id,
      expectedRevision: args.expectedRevision,
      set: { notes: trimmed === '' ? null : trimmed },
    });
  } catch (error) {
    if (
      error instanceof JoinRequestConflictError ||
      error instanceof JoinRequestNotFoundError ||
      error instanceof JoinValidationError
    ) {
      throw error;
    }
    if (postgresErrorCode(error) === '42P01') throw new JoinStorageError();
    logJoinFailure('notes-save', error);
    throw error;
  }
}

export type { Tx };
