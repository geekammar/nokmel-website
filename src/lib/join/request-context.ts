import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { resolveAuthOriginConfig } from '@/lib/auth-origins';

/**
 * Join-intake request identity and origin policy (W4).
 *
 * Identity follows the existing reviewed Better Auth header policy: only a
 * single-value `x-forwarded-for` entry that parses as an IP address is used.
 * Multi-value or malformed headers resolve to one shared bucket rather than
 * trusting an attacker-supplied chain. The raw header/IP is never stored; only
 * an HMAC-derived bucket key is persisted. Hosted Vercel forwarded-header
 * verification remains a W6 live check.
 *
 * Browsers must send an exact trusted `Origin`. Missing Origin is allowed only
 * for non-browser requests (documented tradeoff) and is still rate limited.
 */

export type JoinOriginPolicy = {
  configured: boolean;
  origins: ReadonlySet<string>;
};

export function resolveJoinOriginPolicy(
  env: NodeJS.ProcessEnv = process.env,
): JoinOriginPolicy {
  try {
    const { trustedOrigins } = resolveAuthOriginConfig(env);
    return { configured: true, origins: new Set(trustedOrigins) };
  } catch {
    return { configured: false, origins: new Set() };
  }
}

export type JoinOriginDecision = { ok: true } | { ok: false; message: string };

export function checkJoinRequestOrigin(
  headers: Headers,
  policy: JoinOriginPolicy,
): JoinOriginDecision {
  const originHeader = headers.get('origin');
  const secFetchSite = headers.get('sec-fetch-site')?.trim().toLowerCase();

  // Missing Origin is allowed only for non-browser clients; browser requests
  // that include an Origin are matched exactly against the trusted allowlist.
  if (originHeader) {
    if (!policy.configured) {
      return { ok: false, message: 'طلب من مصدر غير مصرّح به.' };
    }
    let origin: string;
    try {
      const url = new URL(originHeader);
      if (url.username || url.password) throw new Error('invalid origin');
      if (url.pathname !== '/' || url.search || url.hash) {
        throw new Error('invalid origin');
      }
      origin = url.origin;
    } catch {
      return { ok: false, message: 'طلب من مصدر غير صالح.' };
    }
    if (!policy.origins.has(origin)) {
      return { ok: false, message: 'طلب من مصدر غير مصرّح به.' };
    }
  }

  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return { ok: false, message: 'طلب عبر الموقع غير مسموح.' };
  }

  return { ok: true };
}

export function resolveForwardedIdentity(headers: Headers): string {
  const raw = headers.get('x-forwarded-for');
  if (!raw) return 'unknown';
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length !== 1) return 'unknown';
  const candidate = parts[0].replace(/^\[/, '').replace(/\]$/, '');
  return isIP(candidate) !== 0 ? candidate : 'unknown';
}

export function deriveJoinBucketKey(
  identity: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = env.BETTER_AUTH_SECRET?.trim() || 'nokmel-join-intake-local';
  const digest = createHmac('sha256', secret)
    .update(`nokmel.join-intake.v1:${identity}`)
    .digest('hex');
  return `join-intake:v1:${digest}`;
}
