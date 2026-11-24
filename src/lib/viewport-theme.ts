/**
 * Build-safe viewport theming constants for server metadata.
 *
 * These mirror `--brand-primary` (Deep Sapphire Navy) from the authoritative
 * brand token file `src/styles/brand-tokens.css`. CSS custom properties remain
 * the single runtime source for all visual styling; this static value is only
 * used where a literal is required outside CSS (theme-color metadata).
 *
 * Consistency with the canonical token file is enforced by
 * `src/lib/__tests__/brand-tokens.test.ts` at test time, which may freely use
 * the filesystem — unlike this module, which is import-safe in the deployed
 * serverless runtime.
 */
export const THEME_COLOR_LIGHT = '#192B50';
