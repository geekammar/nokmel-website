import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/types';
import {
  JOIN_RATE_LIMIT_WINDOW_SECONDS,
  resolveJoinRateLimitMax,
} from './rate-limit-config';

/**
 * Durable join-intake rate limiter (W4).
 *
 * A single atomic PostgreSQL upsert both increments the bucket and resets it
 * when the fixed window has expired. This survives serverless restarts and
 * concurrent requests without Redis or a second external service. Obsolete rows
 * are pruned opportunistically when a new window is created, so the table does
 * not grow without bound. Raw identities are never stored (HMAC bucket only).
 */

export type JoinRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type JoinRateLimitConfig = {
  max: number;
  windowSeconds: number;
};

export function resolveJoinRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): JoinRateLimitConfig {
  return {
    max: resolveJoinRateLimitMax(env),
    windowSeconds: JOIN_RATE_LIMIT_WINDOW_SECONDS,
  };
}

type RateLimitRow = {
  count?: unknown;
  window_start_epoch?: unknown;
  now_epoch?: unknown;
};

export async function consumeJoinRateLimit(
  args: {
    db: Db;
    bucketKey: string;
    config?: JoinRateLimitConfig;
  },
): Promise<JoinRateLimitDecision> {
  const config = args.config ?? resolveJoinRateLimitConfig();
  const result = await args.db.execute(sql`
    insert into join_intake_rate_limits ("key", "window_start", "count")
    values (${args.bucketKey}, now(), 1)
    on conflict ("key") do update set
      "count" = case
        when join_intake_rate_limits."window_start" <= now() - (${config.windowSeconds} * interval '1 second')
          then 1
        else join_intake_rate_limits."count" + 1
      end,
      "window_start" = case
        when join_intake_rate_limits."window_start" <= now() - (${config.windowSeconds} * interval '1 second')
          then now()
        else join_intake_rate_limits."window_start"
      end
    returning
      "count",
      extract(epoch from "window_start")::double precision as window_start_epoch,
      extract(epoch from now())::double precision as now_epoch
  `);

  const rows = result.rows as RateLimitRow[];
  const row = rows[0];
  if (
    !row ||
    typeof row.count !== 'number' ||
    typeof row.window_start_epoch !== 'number' ||
    typeof row.now_epoch !== 'number'
  ) {
    throw new Error('Rate limit storage returned an invalid result.');
  }

  if (row.count === 1) {
    // Bounded opportunistic cleanup: each new window removes at most 500
    // obsolete buckets (older than one day), keeping the table bounded without
    // a background worker.
    await args.db
      .execute(
        sql`delete from join_intake_rate_limits where "key" in (
          select "key" from join_intake_rate_limits
          where "window_start" < now() - interval '1 day'
          limit 500
        )`,
      )
      .catch(() => undefined);
  }

  if (row.count <= config.max) return { allowed: true };

  const remaining = Math.ceil(
    row.window_start_epoch + config.windowSeconds - row.now_epoch,
  );
  return { allowed: false, retryAfterSeconds: Math.max(1, remaining) };
}
