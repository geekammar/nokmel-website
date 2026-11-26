/**
 * Join-intake rate-limit configuration (W4).
 *
 * Default: five accepted attempts per ten minutes per resolved request
 * identity. The `JOIN_RATE_LIMIT_MAX` override is honored only in an explicitly
 * marked disposable test environment (same policy as the sign-in override) and
 * never on hosted Vercel production/preview environments. Invalid values are
 * ignored rather than weakening the limit.
 */

export const JOIN_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
export const JOIN_RATE_LIMIT_MAX = 5;
const MAX_ALLOWED_TEST_OVERRIDE = 1000;
const HOSTED_VERCEL_ENVS = new Set(['production', 'preview']);

export function resolveJoinRateLimitMax(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.JOIN_RATE_LIMIT_MAX?.trim();
  if (!raw) return JOIN_RATE_LIMIT_MAX;
  if (!/^\d+$/.test(raw)) return JOIN_RATE_LIMIT_MAX;
  const value = Number.parseInt(raw, 10);
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_ALLOWED_TEST_OVERRIDE
  ) {
    return JOIN_RATE_LIMIT_MAX;
  }
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv && HOSTED_VERCEL_ENVS.has(vercelEnv)) {
    return JOIN_RATE_LIMIT_MAX;
  }
  if (env.NOKMEL_DISPOSABLE_TEST_ENV !== '1') return JOIN_RATE_LIMIT_MAX;
  return value;
}
