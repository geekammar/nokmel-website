import { ConfigError } from '@/lib/config-error';

/**
 * Explicit authentication origin policy (W3.1 hardening).
 *
 * `BETTER_AUTH_URL` is required and must be an absolute application origin:
 * HTTPS for hosted deployments; HTTP only for explicit loopback development /
 * test origins. `TRUSTED_ORIGINS` may add exact, immutable aliases (for
 * example one preview URL) — wildcards, credentials, paths, queries, and
 * fragments are rejected. Better Auth's own origin/CSRF checks stay enabled;
 * this module only validates what they compare against. No request Host header
 * is ever used to derive an authorized origin.
 *
 * `BETTER_AUTH_TRUSTED_ORIGINS` is an implicit Better Auth env input that would
 * bypass this validation, so its presence is rejected.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export type AuthOriginConfig = {
  baseURL: string;
  trustedOrigins: string[];
};

function unbracket(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '');
}

function validateExactOrigin(raw: string, label: string): { origin: string; loopback: boolean } {
  if (!raw.trim()) {
    throw new ConfigError(`${label} must not be empty.`);
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ConfigError(`${label} must be an absolute origin (for example https://nokmel.tech).`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ConfigError(`${label} must use https:// (or http:// only on loopback).`);
  }
  if (url.username || url.password) {
    throw new ConfigError(`${label} must not contain embedded credentials.`);
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new ConfigError(`${label} must be an origin without a path.`);
  }
  if (url.search || url.hash) {
    throw new ConfigError(`${label} must not contain a query string or fragment.`);
  }

  const host = unbracket(url.hostname).toLowerCase();
  if (!host) {
    throw new ConfigError(`${label} must include a host.`);
  }
  if (host.includes('*') || /[\s/]/.test(host)) {
    throw new ConfigError(`${label} must not contain wildcards or invalid host characters.`);
  }

  const loopback = LOOPBACK_HOSTS.has(host);
  if (url.protocol === 'http:' && !loopback) {
    throw new ConfigError(
      `${label} must use HTTPS; plain HTTP is allowed only for explicit loopback development or tests.`,
    );
  }
  return { origin: url.origin, loopback };
}

export function resolveAuthOriginConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthOriginConfig {
  if (env.BETTER_AUTH_TRUSTED_ORIGINS?.trim()) {
    throw new ConfigError(
      'BETTER_AUTH_TRUSTED_ORIGINS is not supported because it bypasses explicit origin validation; use TRUSTED_ORIGINS.',
    );
  }

  const rawBaseURL = env.BETTER_AUTH_URL;
  if (!rawBaseURL?.trim()) {
    throw new ConfigError(
      'BETTER_AUTH_URL is required and must be the exact application origin for the current environment.',
    );
  }
  const base = validateExactOrigin(rawBaseURL, 'BETTER_AUTH_URL');

  const configured = (env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => validateExactOrigin(origin, 'TRUSTED_ORIGINS entry').origin);

  return {
    baseURL: base.origin,
    trustedOrigins: [...new Set([base.origin, ...configured])],
  };
}
