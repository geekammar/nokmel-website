import { randomUUID } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import { plans } from '@/lib/db/schema';
import type { Db } from '@/lib/db/types';
import {
  PlanConflictError,
  PlanDuplicateSlugError,
  PlanNotFoundError,
  PlanStorageError,
  PlanValidationError,
} from './errors';
import {
  PLAN_STATUSES,
  isSupportedCurrency,
  planDraftToPublic,
  planSlugSchema,
  toPublicPlan,
  validatePlanForm,
  type OwnerPlan,
  type PlanDraftValues,
  type PlanPublishedValues,
  type PlanStatus,
  type PublicPlan,
} from './model';
import {
  MAX_PRICE_MINOR,
  parsePromotionConfig,
  validatePromotionAgainstPrices,
  type PromotionConfig,
} from './promotion';

/**
 * Server-side marketing-plan service (W4).
 *
 * Public reads are published-only projections (`status = 'published'` and the
 * `published_*` columns); draft values are restricted to the owner editor,
 * owner preview and owner-only write transactions. All public failures return
 * an empty plan list rather than invented offers.
 */

type PlanServiceOptions = { db?: Db; asOf?: Date };

export type PlanStorageStatus =
  | 'ok'
  | 'unconfigured'
  | 'not_migrated'
  | 'unavailable'
  | 'invalid';

export type OwnerPlanLoadResult =
  | { status: 'ok'; plans: OwnerPlan[] }
  | { status: Exclude<PlanStorageStatus, 'ok'>; message: string };

export type OwnerPlanResult =
  | { status: 'ok'; plan: OwnerPlan }
  | { status: Exclude<PlanStorageStatus, 'ok'>; message: string };

export type PublicPlanLoadResult = {
  status: PlanStorageStatus;
  plans: PublicPlan[];
};

type PlanRow = typeof plans.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const STORAGE_MESSAGES: Record<Exclude<PlanStorageStatus, 'ok'>, string> = {
  unconfigured:
    'تخزين الباقات غير مهيأ في هذه البيئة. لا يمكن عرض الباقات أو تعديلها.',
  not_migrated:
    'جداول الباقات غير مهيأة في قاعدة البيانات. طبّق migrations W4 أولاً، ثم أعد المحاولة.',
  unavailable: 'تعذّر الوصول إلى تخزين الباقات مؤقتاً. لم يتم عرض أو حفظ أي بيانات.',
  invalid: 'بيانات الباقة المحفوظة غير صالحة. لم يتم عرضها.',
};

function resolveDb(options: PlanServiceOptions): Db {
  return options.db ?? getDb().db;
}

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function logPlanFailure(operation: string, error: unknown): void {
  const reason =
    postgresErrorCode(error) === '42P01'
      ? 'not_migrated'
      : error instanceof ConfigError
        ? 'unconfigured'
        : error instanceof PlanConflictError || error instanceof PlanNotFoundError
          ? error.code
          : 'unavailable';
  console.error(`[plans] ${operation} failed`, { reason });
}

function storageFailure(error: unknown): {
  status: Exclude<PlanStorageStatus, 'ok'>;
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

function asPlanStatus(value: string): PlanStatus {
  if ((PLAN_STATUSES as readonly string[]).includes(value)) return value as PlanStatus;
  throw new PlanStorageError();
}

function asFeatures(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) {
    throw new PlanStorageError();
  }
  return [...value];
}

function asCurrency(value: string | null): PlanDraftValues['currency'] {
  if (!isSupportedCurrency(value)) throw new PlanStorageError();
  return value;
}

function assertMinor(value: number | null): number | null {
  if (value === null) return null;
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_PRICE_MINOR
  ) {
    throw new PlanStorageError();
  }
  return value;
}

function parseStoredPromotion(
  value: unknown,
  base: { monthlyPriceMinor: number | null; yearlyPriceMinor: number | null },
): PromotionConfig | null {
  try {
    const promotion = parsePromotionConfig(value);
    if (
      promotion &&
      Object.keys(validatePromotionAgainstPrices(promotion, base)).length > 0
    ) {
      throw new PlanStorageError();
    }
    return promotion;
  } catch {
    throw new PlanStorageError();
  }
}

function draftFromRow(row: PlanRow): PlanDraftValues {
  if (
    typeof row.draftName !== 'string' ||
    typeof row.draftDescription !== 'string' ||
    typeof row.draftCtaLabel !== 'string'
  ) {
    throw new PlanStorageError();
  }
  const monthlyPriceMinor = assertMinor(row.draftMonthlyPriceMinor);
  const yearlyPriceMinor = assertMinor(row.draftYearlyPriceMinor);
  return {
    name: row.draftName,
    description: row.draftDescription,
    features: asFeatures(row.draftFeatures),
    monthlyPriceMinor,
    yearlyPriceMinor,
    currency: asCurrency(row.draftCurrency),
    ctaLabel: row.draftCtaLabel,
    featured: Boolean(row.draftFeatured),
    displayOrder: row.draftDisplayOrder,
    promotion: parseStoredPromotion(row.draftPromotion, {
      monthlyPriceMinor,
      yearlyPriceMinor,
    }),
  };
}

function publishedFromRow(row: PlanRow): PlanPublishedValues | null {
  if (
    row.publishedName === null ||
    row.publishedDescription === null ||
    row.publishedCurrency === null ||
    row.publishedCtaLabel === null ||
    row.publishedDisplayOrder === null ||
    row.publishedRevision === null
  ) {
    return null;
  }
  const monthlyPriceMinor = assertMinor(row.publishedMonthlyPriceMinor);
  const yearlyPriceMinor = assertMinor(row.publishedYearlyPriceMinor);
  return {
    name: row.publishedName,
    description: row.publishedDescription,
    features: asFeatures(row.publishedFeatures),
    monthlyPriceMinor,
    yearlyPriceMinor,
    currency: asCurrency(row.publishedCurrency),
    ctaLabel: row.publishedCtaLabel,
    featured: Boolean(row.publishedFeatured),
    displayOrder: row.publishedDisplayOrder,
    promotion: parseStoredPromotion(row.publishedPromotion, {
      monthlyPriceMinor,
      yearlyPriceMinor,
    }),
  };
}

function ownerPlanFromRow(row: PlanRow): OwnerPlan {
  return {
    id: row.id,
    slug: row.slug,
    status: asPlanStatus(row.status),
    revision: row.draftRevision,
    publishedRevision: row.publishedRevision,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    draft: draftFromRow(row),
    published: publishedFromRow(row),
  };
}

function assertExpectedRevision(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 1_000_000
  ) {
    throw new PlanConflictError();
  }
  return value;
}

function validateDraftInput(values: unknown): PlanDraftValues {
  const result = validatePlanForm(values);
  if (!result.ok) throw new PlanValidationError(result.errors);
  return result.values;
}

async function lockPlans(tx: Tx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('nokmel.plans.write')::bigint)`);
}

async function readPlan(tx: Tx, id: string): Promise<PlanRow> {
  const rows = await tx.select().from(plans).where(eq(plans.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new PlanNotFoundError();
  return row;
}

export async function getOwnerPlans(
  options: PlanServiceOptions = {},
): Promise<OwnerPlanLoadResult> {
  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logPlanFailure('owner-list', error);
    return storageFailure(error);
  }
  try {
    const rows = await db
      .select()
      .from(plans)
      .orderBy(asc(plans.draftDisplayOrder), asc(plans.createdAt));
    try {
      return { status: 'ok', plans: rows.map(ownerPlanFromRow) };
    } catch (error) {
      logPlanFailure('owner-list-invalid', error);
      return { status: 'invalid', message: STORAGE_MESSAGES.invalid };
    }
  } catch (error) {
    logPlanFailure('owner-list', error);
    return storageFailure(error);
  }
}

export async function getOwnerPlan(
  rawId: unknown,
  options: PlanServiceOptions = {},
): Promise<OwnerPlanResult> {
  if (typeof rawId !== 'string' || rawId.length > 80) {
    return { status: 'invalid', message: 'الباقة غير موجودة.' };
  }
  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logPlanFailure('owner-get', error);
    return storageFailure(error);
  }
  try {
    const rows = await db.select().from(plans).where(eq(plans.id, rawId)).limit(1);
    const row = rows[0];
    if (!row) return { status: 'invalid', message: 'الباقة غير موجودة.' };
    try {
      return { status: 'ok', plan: ownerPlanFromRow(row) };
    } catch (error) {
      logPlanFailure('owner-get-invalid', error);
      return { status: 'invalid', message: STORAGE_MESSAGES.invalid };
    }
  } catch (error) {
    logPlanFailure('owner-get', error);
    return storageFailure(error);
  }
}

/**
 * Public loader: published visible plans only, in published display order.
 * Never selects draft fields and never caches failures.
 */
export async function getPublicPlans(
  options: PlanServiceOptions = {},
): Promise<PublicPlanLoadResult> {
  if (!options.db && !process.env.DATABASE_URL?.trim()) {
    return { status: 'unconfigured', plans: [] };
  }
  const asOf = options.asOf ?? new Date();
  let db: Db;
  try {
    db = resolveDb(options);
  } catch (error) {
    logPlanFailure('public-list', error);
    return { status: storageFailure(error).status, plans: [] };
  }
  try {
    const rows = await db
      .select({
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
      .where(eq(plans.status, 'published'))
      .orderBy(asc(plans.publishedDisplayOrder), asc(plans.createdAt), asc(plans.slug));

    const publicPlans: PublicPlan[] = [];
    for (const row of rows) {
      try {
        if (
          row.name === null ||
          row.description === null ||
          row.currency === null ||
          row.ctaLabel === null ||
          row.featured === null ||
          row.displayOrder === null ||
          row.publishedRevision === null
        ) {
          throw new Error('Incomplete published plan');
        }
        publicPlans.push(
          toPublicPlan(
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
          ),
        );
      } catch {
        console.error('[plans] public-plan invalid', { reason: 'invalid_row' });
      }
    }
    return { status: publicPlans.length > 0 || rows.length === 0 ? 'ok' : 'invalid', plans: publicPlans };
  } catch (error) {
    logPlanFailure('public-list', error);
    return { status: storageFailure(error).status, plans: [] };
  }
}

export async function getPublicPlanBySlug(
  rawSlug: unknown,
  options: PlanServiceOptions = {},
): Promise<PublicPlan | null> {
  const parsed = planSlugSchema.safeParse(rawSlug);
  if (!parsed.success) return null;
  const result = await getPublicPlans(options);
  return result.plans.find((plan) => plan.slug === parsed.data) ?? null;
}

type WriteResult = { plan: OwnerPlan };

function validateSlug(rawSlug: unknown): string {
  const parsed = planSlugSchema.safeParse(rawSlug);
  if (!parsed.success) {
    throw new PlanValidationError({
      slug: parsed.error.issues[0]?.message ?? 'المعرّف غير صالح.',
    });
  }
  return parsed.data;
}

export async function createPlan(
  args: { slug: unknown; values: unknown },
  options: PlanServiceOptions = {},
): Promise<OwnerPlan> {
  const slug = validateSlug(args.slug);
  const values = validateDraftInput(args.values);
  const db = resolveDb(options);
  try {
    return await db.transaction(async (tx) => {
      await lockPlans(tx);
      const existing = await tx
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.slug, slug))
        .limit(1);
      if (existing.length > 0) throw new PlanDuplicateSlugError();

      const now = new Date();
      const rows = await tx
        .insert(plans)
        .values({
          id: randomUUID(),
          slug,
          draftName: values.name,
          draftDescription: values.description,
          draftFeatures: values.features,
          draftMonthlyPriceMinor: values.monthlyPriceMinor,
          draftYearlyPriceMinor: values.yearlyPriceMinor,
          draftCurrency: values.currency,
          draftCtaLabel: values.ctaLabel,
          draftFeatured: values.featured,
          draftDisplayOrder: values.displayOrder,
          draftPromotion: values.promotion,
          status: 'draft',
          draftRevision: 1,
          updatedAt: now,
          createdAt: now,
        })
        .returning();
      return ownerPlanFromRow(rows[0]);
    });
  } catch (error) {
    if (error instanceof PlanValidationError || error instanceof PlanDuplicateSlugError) {
      throw error;
    }
    if (postgresErrorCode(error) === '23505') throw new PlanDuplicateSlugError();
    if (postgresErrorCode(error) === '42P01') throw new PlanStorageError();
    logPlanFailure('create', error);
    throw error;
  }
}

export async function savePlanDraft(
  args: { id: unknown; expectedRevision: unknown; values: unknown },
  options: PlanServiceOptions = {},
): Promise<OwnerPlan> {
  if (typeof args.id !== 'string' || args.id.length > 80) throw new PlanNotFoundError();
  const expectedRevision = assertExpectedRevision(args.expectedRevision);
  const values = validateDraftInput(args.values);
  const db = resolveDb(options);
  try {
    return await db.transaction(async (tx) => {
      await lockPlans(tx);
      const current = await readPlan(tx, args.id as string);
      if (current.draftRevision !== expectedRevision) throw new PlanConflictError();
      const nextRevision = expectedRevision + 1;
      const now = new Date();
      const rows = await tx
        .update(plans)
        .set({
          draftName: values.name,
          draftDescription: values.description,
          draftFeatures: values.features,
          draftMonthlyPriceMinor: values.monthlyPriceMinor,
          draftYearlyPriceMinor: values.yearlyPriceMinor,
          draftCurrency: values.currency,
          draftCtaLabel: values.ctaLabel,
          draftFeatured: values.featured,
          draftDisplayOrder: values.displayOrder,
          draftPromotion: values.promotion,
          draftRevision: nextRevision,
          updatedAt: now,
        })
        .where(eq(plans.id, args.id as string))
        .returning();
      return ownerPlanFromRow(rows[0]);
    });
  } catch (error) {
    if (
      error instanceof PlanConflictError ||
      error instanceof PlanNotFoundError ||
      error instanceof PlanValidationError
    ) {
      throw error;
    }
    if (postgresErrorCode(error) === '42P01') throw new PlanStorageError();
    logPlanFailure('save-draft', error);
    throw error;
  }
}

/**
 * Explicit publication/show: copies the saved draft into the published columns
 * and makes the plan publicly selectable. Editing a live plan never changes the
 * public offer before this action.
 */
export async function publishPlan(
  args: { id: unknown; expectedRevision: unknown },
  options: PlanServiceOptions = {},
): Promise<OwnerPlan> {
  if (typeof args.id !== 'string' || args.id.length > 80) throw new PlanNotFoundError();
  const expectedRevision = assertExpectedRevision(args.expectedRevision);
  const db = resolveDb(options);
  try {
    return await db.transaction(async (tx) => {
      await lockPlans(tx);
      const current = await readPlan(tx, args.id as string);
      if (current.draftRevision !== expectedRevision) throw new PlanConflictError();
      const draft = draftFromRow(current);
      if (draft.promotion) {
        const promotionErrors = validatePromotionAgainstPrices(draft.promotion, {
          monthlyPriceMinor: draft.monthlyPriceMinor,
          yearlyPriceMinor: draft.yearlyPriceMinor,
        });
        if (Object.keys(promotionErrors).length > 0) {
          throw new PlanValidationError(
            Object.fromEntries(
              Object.entries(promotionErrors).map(([key, message]) => [
                `promotion.${key}`,
                message,
              ]),
            ),
          );
        }
      }
      const nextRevision = expectedRevision + 1;
      const now = new Date();
      const rows = await tx
        .update(plans)
        .set({
          publishedName: draft.name,
          publishedDescription: draft.description,
          publishedFeatures: draft.features,
          publishedMonthlyPriceMinor: draft.monthlyPriceMinor,
          publishedYearlyPriceMinor: draft.yearlyPriceMinor,
          publishedCurrency: draft.currency,
          publishedCtaLabel: draft.ctaLabel,
          publishedFeatured: draft.featured,
          publishedDisplayOrder: draft.displayOrder,
          publishedPromotion: draft.promotion,
          status: 'published',
          draftRevision: nextRevision,
          publishedRevision: nextRevision,
          publishedAt: now,
          updatedAt: now,
        })
        .where(eq(plans.id, args.id as string))
        .returning();
      return ownerPlanFromRow(rows[0]);
    });
  } catch (error) {
    if (
      error instanceof PlanConflictError ||
      error instanceof PlanNotFoundError ||
      error instanceof PlanStorageError
    ) {
      throw error;
    }
    if (postgresErrorCode(error) === '42P01') throw new PlanStorageError();
    logPlanFailure('publish', error);
    throw error;
  }
}

/**
 * Hide: removes the plan from public listing and new join selection while
 * keeping published values and historical join-request references intact.
 */
export async function hidePlan(
  args: { id: unknown; expectedRevision: unknown },
  options: PlanServiceOptions = {},
): Promise<OwnerPlan> {
  if (typeof args.id !== 'string' || args.id.length > 80) throw new PlanNotFoundError();
  const expectedRevision = assertExpectedRevision(args.expectedRevision);
  const db = resolveDb(options);
  try {
    return await db.transaction(async (tx) => {
      await lockPlans(tx);
      const current = await readPlan(tx, args.id as string);
      if (current.draftRevision !== expectedRevision) throw new PlanConflictError();
      const now = new Date();
      const rows = await tx
        .update(plans)
        .set({
          status: 'hidden',
          draftRevision: expectedRevision + 1,
          updatedAt: now,
        })
        .where(eq(plans.id, args.id as string))
        .returning();
      return ownerPlanFromRow(rows[0]);
    });
  } catch (error) {
    if (
      error instanceof PlanConflictError ||
      error instanceof PlanNotFoundError ||
      error instanceof PlanStorageError
    ) {
      throw error;
    }
    if (postgresErrorCode(error) === '42P01') throw new PlanStorageError();
    logPlanFailure('hide', error);
    throw error;
  }
}

export { planDraftToPublic };
export type { WriteResult };
