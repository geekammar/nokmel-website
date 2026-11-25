import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { ConfigError } from '@/lib/config-error';
import { getDb } from '@/lib/db';
import * as schema from '@/lib/db/schema';

/**
 * Self-hosted Better Auth configuration (W3.1).
 *
 * Lazily instantiated so the public website still builds and runs without
 * authentication configuration. Missing configuration must fail closed for
 * admin access — never fall back to an insecure default.
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
};

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

function trustedOriginsFromEnv(): string[] {
  const origins = (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const baseURL = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, '');
  if (baseURL) origins.unshift(baseURL);
  return [...new Set(origins)];
}

export function createAuth(options: CreateAuthOptions = {}) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret?.trim()) {
    throw new ConfigError('BETTER_AUTH_SECRET is not configured.');
  }
  if (secret.trim().length < 32) {
    throw new ConfigError('BETTER_AUTH_SECRET must be at least 32 characters.');
  }
  const trustedOrigins = trustedOriginsFromEnv();
  if (trustedOrigins.length === 0) {
    throw new ConfigError('Trusted origins are not configured (BETTER_AUTH_URL or TRUSTED_ORIGINS).');
  }
  const baseURL = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, '') || undefined;

  const signInMax = parsePositiveInt(process.env.RATE_LIMIT_SIGNIN_MAX) ?? options.rateLimit?.signInMax ?? 5;
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
