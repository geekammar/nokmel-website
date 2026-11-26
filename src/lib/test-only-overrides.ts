/**
 * Test-only override gate (W5).
 *
 * External-provider endpoint overrides are honored only for explicitly
 * disposable local/CI test runs. They are always ignored on hosted Vercel
 * Preview/Production. This prevents CI from ever calling a real GA4 or
 * Telegram endpoint while keeping the production code path fixed.
 */
export function allowDisposableProviderOverrides(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NOKMEL_DISPOSABLE_TEST_ENV !== '1') return false;
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase();
  return vercelEnv !== 'production' && vercelEnv !== 'preview';
}

export function resolveLoopbackOriginOverride(
  raw: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!allowDisposableProviderOverrides(env)) return null;
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.search || url.hash) return null;
    const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '');
    if (!['127.0.0.1', '::1', 'localhost'].includes(host)) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveLoopbackUrlOverride(
  raw: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!allowDisposableProviderOverrides(env)) return null;
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.search || url.hash) return null;
    const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '');
    if (!['127.0.0.1', '::1', 'localhost'].includes(host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
