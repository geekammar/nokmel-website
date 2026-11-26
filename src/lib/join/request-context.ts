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

  // Enabled intake fails closed when trusted origins are missing/invalid, even
  // for a request without an Origin header.
  if (!policy.configured) {
    return { ok: false, message: 'إعدادات المصادر غير متاحة.' };
  }

  // Missing Origin is allowed only for non-browser clients when the origin
  // configuration itself is valid. Browser Origins are matched exactly.
  if (originHeader) {
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
  // Ambiguous chains are not normalized by dropping empty/invalid entries:
  // any comma (including a trailing comma) makes the header untrustworthy.
  const parts = raw.split(',');
  if (parts.length !== 1) return 'unknown';
  const candidate = parts[0].trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!candidate) return 'unknown';
  return isIP(candidate) !== 0 ? candidate : 'unknown';
}

const MIN_JOIN_HMAC_SECRET_LENGTH = 32;

/** Requires a valid Better Auth secret for HMAC bucket derivation. */
export function resolveJoinHmacSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret || secret.length < MIN_JOIN_HMAC_SECRET_LENGTH) return null;
  return secret;
}

export function deriveJoinBucketKey(identity: string, secret: string): string {
  if (!secret || secret.length < MIN_JOIN_HMAC_SECRET_LENGTH) {
    throw new Error('A valid join-intake HMAC secret is required.');
  }
  const digest = createHmac('sha256', secret)
    .update(`nokmel.join-intake.v1:${identity}`)
    .digest('hex');
  return `join-intake:v1:${digest}`;
}
