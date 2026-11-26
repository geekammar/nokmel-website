/**
 * Fail-closed join-intake gate (W4).
 *
 * Intake is enabled only by an explicit `JOIN_INTAKE_ENABLED` value of `1` or
 * `true` (case-insensitive, trimmed). Missing, empty, or invalid values keep
 * intake disabled. The server route enforces this independently of the form
 * UI, and CMS content can never enable it.
 *
 * Production must not set this variable during W4; enabling intake in a
 * production deployment requires explicit owner authorization and the approved
 * privacy/retention prerequisites (W6 launch gates).
 */

const ENABLING_VALUES = new Set(['1', 'true']);

export function resolveJoinIntakeEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.JOIN_INTAKE_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  return ENABLING_VALUES.has(raw);
}

export function isJoinIntakeEnabled(): boolean {
  return resolveJoinIntakeEnabled();
}
