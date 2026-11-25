import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Better Auth core schema (W3.1).
 *
 * Generated from the official Better Auth core schema documentation for the
 * installed version (https://better-auth.com/docs/concepts/database) using the
 * supported Drizzle adapter mapping: snake_case columns, text primary keys,
 * composite `account` identity (providerId + accountId), cascade deletes, and
 * `rate_limit` for Better Auth's database-backed rate limiting.
 *
 * Future CMS/pricing/analytics/join-request tables are intentionally out of
 * scope for W3.1 (see docs/ARCHITECTURE.md, Schema boundaries).
 */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    index('account_provider_idx').on(table.providerId, table.accountId),
    /**
     * Single-owner defense in depth: at most one credential account per user.
     * Better Auth's email+password flow never creates a second credential
     * account for the same user, and account linking is disabled in this app.
     */
    uniqueIndex('account_user_credential_unique')
      .on(table.userId)
      .where(sql`${table.providerId} = 'credential'`),
  ],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

/**
 * Better Auth database-backed rate limiting (W3.1).
 * Persisted so limits survive across serverless instances.
 */
export const rateLimit = pgTable(
  'rate_limit',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    count: integer('count').notNull(),
    lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
  },
  (table) => [index('rate_limit_key_idx').on(table.key)],
);
