import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { ConfigError } from '@/lib/config-error';
import { resolveAuthOriginConfig } from '@/lib/auth-origins';
import { getDb } from '@/lib/db';
import { resolveSignInRateLimitMax } from '@/lib/rate-limit-config';
import * as schema from '@/lib/db/schema';

/**
 * Self-hosted Better Auth configuration (W3.1).
 *
 * Lazily instantiated so the public website still builds and runs without
 * authentication configuration. Missing or unsafe configuration must fail
 * closed for admin access — never fall back to an insecure default:
 * - `BETTER_AUTH_URL` is required and validated as an exact application origin
 *   (HTTPS for hosted, HTTP only on loopback); every trusted origin is exact,
 *   with no wildcards, credentials, paths, queries, or fragments.
 * - Better Auth's built-in origin and CSRF checks stay enabled.
 * - The sign-in rate limit ceiling can be raised only in an explicitly marked
 *   disposable test environment, never on hosted Vercel environments.
 */

export type Auth = ReturnType<typeof createAuth>;

type RateLimitOptions = {
  enabled?: boolean;
  windowSeconds?: number;
  max?: number;
  signInMax?: number;
};

type CreateAuthOptions = {
  rateLimit?: RateLimitOptions;
  /** Overrides the lazy singleton DB (used by integration tests only). */
  db?: ReturnType<typeof getDb>['db'];
  /** Test-only verifier wrapper used to pause after a real password verification. */
  passwordVerifier?: (data: { hash: string; password: string }) => Promise<boolean>;
};

export function createAuth(options: CreateAuthOptions = {}) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret?.trim()) {
    throw new ConfigError('BETTER_AUTH_SECRET is not configured.');
  }
  if (secret.trim().length < 32) {
    throw new ConfigError('BETTER_AUTH_SECRET must be at least 32 characters.');
  }

  const { baseURL, trustedOrigins } = resolveAuthOriginConfig();

  const signInMax =
    options.rateLimit?.signInMax ?? resolveSignInRateLimitMax();
  const rateLimit = {
    enabled: options.rateLimit?.enabled ?? true,
    storage: 'database' as const,
    window: options.rateLimit?.windowSeconds ?? 60,
    max: options.rateLimit?.max ?? 30,
    customRules: {
      '/sign-in/email': {
        window: options.rateLimit?.windowSeconds ?? 60,
        max: signInMax,
      },
    },
  };

  return betterAuth({
    secret: secret.trim(),
    baseURL,
    trustedOrigins,
    database: drizzleAdapter(options.db ?? getDb().db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      ...(options.passwordVerifier
        ? { password: { verify: options.passwordVerifier } }
        : {}),
    },
    account: {
      accountLinking: {
        enabled: false,
        trustedProviders: [],
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      cookiePrefix: 'nokmel',
      /**
       * Vercel overwrites `x-forwarded-for` with the client public IP and does
       * not forward externally supplied values (official request-header docs:
       * "we currently overwrite the X-Forwarded-For header and do not forward
       * external IPs. This restriction is in place to prevent IP spoofing").
       * Better Auth 1.7.28 trusts only single-value forwarded headers unless
       * `trustedProxies` is configured, so no proxy chain is trusted here.
       * A multi-value/spoofed header resolves to no IP and falls back to a
       * shared per-path rate-limit bucket rather than trusting the leftmost
       * value. Revisit if a reverse proxy is placed in front of Vercel.
       */
      ipAddress: {
        ipAddressHeaders: ['x-forwarded-for'],
      },
    },
    rateLimit,
    plugins: [nextCookies()],
  });
}

let cached: Auth | null = null;

export function getAuth(): Auth {
  cached ??= createAuth();
  return cached;
}
