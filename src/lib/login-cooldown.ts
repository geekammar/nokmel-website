/**
 * Client-side sign-in cooldown policy (W3.1 closure, NKW-W31-S05-01).
 *
 * The server remains authoritative: Better Auth's database-backed limiter
 * returns 429 with an `X-Retry-After` header (seconds). The Better Auth client
 * does not expose response headers in its error object, so the auth client
 * captures that header in an `onResponse` hook (`src/lib/auth-client.ts`).
 * When the header is absent or invalid, the UI uses a conservative cooldown
 * equal to the configured 60-second sign-in window. The displayed countdown is
 * approximate UI guidance, not a claim of an exact server-side timer.
 */

export const DEFAULT_SIGN_IN_COOLDOWN_SECONDS = 60;
const MAX_SIGN_IN_COOLDOWN_SECONDS = 300;

export function parseRetryAfterSeconds(value: string | null | undefined): number | null {
  const raw = value?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(seconds) || seconds < 1) return null;
  return Math.min(seconds, MAX_SIGN_IN_COOLDOWN_SECONDS);
}

export function resolveSignInCooldownSeconds(
  retryAfterSeconds: number | null | undefined,
): number {
  if (retryAfterSeconds !== null && retryAfterSeconds !== undefined) {
    const seconds = Math.trunc(retryAfterSeconds);
    if (Number.isSafeInteger(seconds) && seconds >= 1) {
      return Math.min(seconds, MAX_SIGN_IN_COOLDOWN_SECONDS);
    }
  }
  return DEFAULT_SIGN_IN_COOLDOWN_SECONDS;
}

/** Whole seconds remaining, never negative. */
export function remainingCooldownSeconds(cooldownUntilMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((cooldownUntilMs - nowMs) / 1000));
}
