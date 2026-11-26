import { sql } from 'drizzle-orm';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import type { Db } from '@/lib/db/types';
import { cairoReportingRange, type OverviewPeriod } from './cairo';

/**
 * Owner business overview aggregates (W5-A).
 *
 * All request metrics come from authoritative `join_requests` rows. Clear
 * boundaries:
 * - period metrics count requests created inside the selected Africa/Cairo
 *   calendar range;
 * - the "needs attention now" backlog is a current all-time count of
 *   status = 'new' and is never filtered by the reporting period;
 * - latest requests are the newest overall and are labelled as such.
 *
 * No revenue/ARR/MRR/subscription metric is derived from early-access leads.
 * No full table is loaded into application or browser memory.
 */

export type OverviewStorageStatus = 'ok' | 'unconfigured' | 'not_migrated' | 'unavailable';

export type OverviewSource = 'direct' | 'pricing' | 'join';
export type OverviewStatus = 'new' | 'contacted' | 'closed';

export type OverviewPlanInterest = {
  planId: string | null;
  planName: string | null;
  count: number;
};

export type OverviewPromotions = {
  active: number;
  noActive: number;
  legacyUnknown: number;
  unknown: number;
  noPlan: number;
};

export type OverviewLatestRequest = {
  id: string;
  name: string;
  status: OverviewStatus;
  source: OverviewSource;
  planName: string | null;
  createdAt: string;
};

export type OverviewMetrics = {
  period: OverviewPeriod;
  startDate: string;
  endDate: string;
  dates: string[];
  receivedInPeriod: number;
  periodStatus: Record<OverviewStatus, number>;
  periodWithUtm: number;
  periodNoPlan: number;
  currentNewBacklog: number;
  daily: Array<{ date: string; count: number }>;
  sources: Array<{ source: OverviewSource; count: number }>;
  plans: OverviewPlanInterest[];
  promotions: OverviewPromotions;
  latest: OverviewLatestRequest[];
};

export type OverviewResult =
  | { status: 'ok'; metrics: OverviewMetrics }
  | { status: Exclude<OverviewStorageStatus, 'ok'>; message: string };

const STORAGE_MESSAGES: Record<Exclude<OverviewStorageStatus, 'ok'>, string> = {
  unconfigured: 'تخزين طلبات الانضمام غير مهيأ في هذه البيئة؛ لا توجد بيانات لعرضها.',
  not_migrated: 'جداول طلبات الانضمام غير مهيأة في قاعدة البيانات بعد.',
  unavailable: 'تعذّر الوصول إلى بيانات الطلبات مؤقتاً. لم تُعرض أي قيم بديلة.',
};

type OverviewServiceOptions = { db?: Db; now?: Date };

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function storageFailure(error: unknown): Exclude<OverviewStorageStatus, 'ok'> {
  if (error instanceof ConfigError) return 'unconfigured';
  if (postgresErrorCode(error) === '42P01') return 'not_migrated';
  return 'unavailable';
}

function logFailure(error: unknown): void {
  console.error('[overview] aggregate load failed', {
    reason: storageFailure(error),
    error: error instanceof Error ? error.name : 'unknown',
  });
}

function asCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function asSource(value: unknown): OverviewSource {
  return value === 'pricing' || value === 'join' ? value : 'direct';
}

function asStatus(value: unknown): OverviewStatus {
  return value === 'contacted' || value === 'closed' ? value : 'new';
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function loadOverviewMetrics(
  period: OverviewPeriod,
  options: OverviewServiceOptions = {},
): Promise<OverviewResult> {
  const now = options.now ?? new Date();
  const range = cairoReportingRange(now, period);
  let db: Db;
  try {
    db = options.db ?? getDb().db;
  } catch (error) {
    logFailure(error);
    return { status: 'unconfigured', message: STORAGE_MESSAGES.unconfigured };
  }

  try {
    const snapshot = await db.transaction(
      async (tx) => {
        const start = range.start.toISOString();
        const end = range.endExclusive.toISOString();

        const cohortResult = await tx.execute(sql`
          select
            count(*)::int as total,
            count(*) filter (where "status" = 'new')::int as new_count,
            count(*) filter (where "status" = 'contacted')::int as contacted_count,
            count(*) filter (where "status" = 'closed')::int as closed_count,
            count(*) filter (
              where "utm_source" is not null
                 or "utm_medium" is not null
                 or "utm_campaign" is not null
            )::int as utm_count,
            count(*) filter (where "plan_id" is null)::int as no_plan_count
          from join_requests
          where "created_at" >= ${start}::timestamptz
            and "created_at" < ${end}::timestamptz
        `);
        const cohort = (cohortResult.rows[0] ?? {}) as Record<string, unknown>;

        const backlogResult = await tx.execute(sql`
          select count(*)::int as count
          from join_requests
          where "status" = 'new'
        `);
        const backlog = (backlogResult.rows[0] ?? {}) as Record<string, unknown>;

        const dailyResult = await tx.execute(sql`
          select
            to_char("created_at" at time zone 'Africa/Cairo', 'YYYY-MM-DD') as date,
            count(*)::int as count
          from join_requests
          where "created_at" >= ${start}::timestamptz
            and "created_at" < ${end}::timestamptz
          group by 1
          order by 1
        `);

        const sourceResult = await tx.execute(sql`
          select "source", count(*)::int as count
          from join_requests
          where "created_at" >= ${start}::timestamptz
            and "created_at" < ${end}::timestamptz
          group by 1
          order by 2 desc, 1
        `);

        const planResult = await tx.execute(sql`
          select
            coalesce("offer_snapshot"->>'planId', "plan_id") as plan_id,
            coalesce("offer_snapshot"->>'planName', "plan_name_snapshot") as plan_name,
            count(*)::int as count
          from join_requests
          where "created_at" >= ${start}::timestamptz
            and "created_at" < ${end}::timestamptz
          group by 1, 2
          order by 3 desc, 2 nulls last
          limit 20
        `);

        const promotionResult = await tx.execute(sql`
          select classification, count(*)::int as count
          from (
            select
              case
                when "plan_id" is null
                 and "plan_name_snapshot" is null
                 and "plan_price_minor_snapshot" is null
                  then 'no_plan'
                when "offer_snapshot" is null then 'legacy_unknown'
                when jsonb_typeof("offer_snapshot") <> 'object' then 'unknown'
                when not coalesce(
                  ("offer_snapshot"->>'promotionState') in ('none', 'scheduled', 'active', 'expired', 'disabled'),
                  false
                ) then 'unknown'
                when ("offer_snapshot"->>'promotionState') = 'active'
                 and jsonb_typeof("offer_snapshot"->'promotion') = 'object'
                  then 'active'
                when ("offer_snapshot"->>'promotionState') = 'active' then 'unknown'
                else 'no_active'
              end as classification
            from join_requests
            where "created_at" >= ${start}::timestamptz
              and "created_at" < ${end}::timestamptz
          ) classified
          group by classification
        `);

        const latestResult = await tx.execute(sql`
          select
            "id",
            "name",
            "status",
            "source",
            coalesce("offer_snapshot"->>'planName', "plan_name_snapshot") as plan_name,
            "created_at"
          from join_requests
          order by "created_at" desc, "id" desc
          limit 5
        `);

        return { cohort, backlog, dailyResult, sourceResult, planResult, promotionResult, latestResult };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );

    const dailyCounts = new Map<string, number>();
    for (const row of snapshot.dailyResult.rows as Array<Record<string, unknown>>) {
      if (typeof row.date === 'string') dailyCounts.set(row.date, asCount(row.count));
    }

    const sources: Array<{ source: OverviewSource; count: number }> = [];
    for (const row of snapshot.sourceResult.rows as Array<Record<string, unknown>>) {
      sources.push({ source: asSource(row.source), count: asCount(row.count) });
    }
    sources.sort((a, b) => b.count - a.count);

    const plans: OverviewPlanInterest[] = [];
    for (const row of snapshot.planResult.rows as Array<Record<string, unknown>>) {
      plans.push({
        planId: nullableText(row.plan_id),
        planName: nullableText(row.plan_name),
        count: asCount(row.count),
      });
    }

    const promotions: OverviewPromotions = {
      active: 0,
      noActive: 0,
      legacyUnknown: 0,
      unknown: 0,
      noPlan: 0,
    };
    for (const row of snapshot.promotionResult.rows as Array<Record<string, unknown>>) {
      const count = asCount(row.count);
      if (row.classification === 'active') promotions.active = count;
      else if (row.classification === 'no_active') promotions.noActive = count;
      else if (row.classification === 'legacy_unknown') promotions.legacyUnknown = count;
      else if (row.classification === 'unknown') promotions.unknown = count;
      else if (row.classification === 'no_plan') promotions.noPlan = count;
    }

    const latest: OverviewLatestRequest[] = [];
    for (const row of snapshot.latestResult.rows as Array<Record<string, unknown>>) {
      if (typeof row.id !== 'string' || typeof row.name !== 'string') continue;
      const createdAt = row.created_at instanceof Date ? row.created_at : new Date(String(row.created_at));
      if (!Number.isFinite(createdAt.getTime())) continue;
      latest.push({
        id: row.id,
        name: row.name,
        status: asStatus(row.status),
        source: asSource(row.source),
        planName: nullableText(row.plan_name),
        createdAt: createdAt.toISOString(),
      });
    }

    return {
      status: 'ok',
      metrics: {
        period,
        startDate: range.startDate,
        endDate: range.endDate,
        dates: range.dates,
        receivedInPeriod: asCount(snapshot.cohort.total),
        periodStatus: {
          new: asCount(snapshot.cohort.new_count),
          contacted: asCount(snapshot.cohort.contacted_count),
          closed: asCount(snapshot.cohort.closed_count),
        },
        periodWithUtm: asCount(snapshot.cohort.utm_count),
        periodNoPlan: asCount(snapshot.cohort.no_plan_count),
        currentNewBacklog: asCount(snapshot.backlog.count),
        daily: range.dates.map((date) => ({ date, count: dailyCounts.get(date) ?? 0 })),
        sources,
        plans,
        promotions,
        latest,
      },
    };
  } catch (error) {
    logFailure(error);
    return { status: storageFailure(error), message: STORAGE_MESSAGES[storageFailure(error)] };
  }
}
