/**
 * Sign-in rate-limit configuration policy (W3.1 hardening).
 *
 * The production ceiling stays at five sign-in attempts per minute. The
 * `RATE_LIMIT_SIGNIN_MAX` override exists only for explicitly isolated
 * disposable test environments: it is honored only when
 * `NOKMEL_DISPOSABLE_TEST_ENV=1` is also set and the runtime is not a hosted
 * Vercel deployment (`VERCEL_ENV` is automatically set to `production` or
 * `preview` there). Invalid, zero, negative, non-numeric, or excessively large
 * values are safely ignored rather than weakening the limit.
 *
 * Better Auth's database-backed rate limiting remains the enforcement layer;
 * this module only resolves the configured ceiling.
 */

export const DEFAULT_SIGNIN_RATE_LIMIT_MAX = 5;
export const DISPOSABLE_TEST_ENV_FLAG = 'NOKMEL_DISPOSABLE_TEST_ENV';
const MAX_ALLOWED_TEST_OVERRIDE = 1000;
const HOSTED_VERCEL_ENVS = new Set(['production', 'preview']);

export function resolveSignInRateLimitMax(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.RATE_LIMIT_SIGNIN_MAX?.trim();
  if (!raw) return DEFAULT_SIGNIN_RATE_LIMIT_MAX;
  if (!/^\d+$/.test(raw)) return DEFAULT_SIGNIN_RATE_LIMIT_MAX;

  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_ALLOWED_TEST_OVERRIDE) {
    return DEFAULT_SIGNIN_RATE_LIMIT_MAX;
  }

  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv && HOSTED_VERCEL_ENVS.has(vercelEnv)) {
    return DEFAULT_SIGNIN_RATE_LIMIT_MAX;
  }
  if (env[DISPOSABLE_TEST_ENV_FLAG] !== '1') {
    return DEFAULT_SIGNIN_RATE_LIMIT_MAX;
  }
  return value;
}
