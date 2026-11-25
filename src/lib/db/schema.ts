import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Better Auth core schema (W3.1).
 *
 * Generated from the official Better Auth core schema documentation for the
 * installed version (https://better-auth.com/docs/concepts/database) using the
 * supported Drizzle adapter mapping: snake_case columns, text primary keys,
 * composite `account` identity (providerId + accountId), cascade deletes, and
 * `rate_limit` for Better Auth's database-backed rate limiting.
 *
 * W3.2 adds the two predefined-CMS tables (`content_sections`, `faq_items`).
 * Pricing/join-request/analytics/settings tables remain out of scope.
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

/**
 * Predefined CMS content sections (W3.2).
 *
 * Identity is (page_key, section_key, locale); `id` is a deterministic text
 * key. The section payload is always validated against the predefined content
 * registry before it is stored or rendered. Draft and published payloads are
 * separate columns; `draft_revision` is the page-level optimistic concurrency
 * counter (the page revision is the maximum across its section rows).
 *
 * Draft visibility/removal of individual sections is intentionally not
 * offered in W3.2: every current section is required. FAQ item visibility is
 * modeled in `faq_items`.
 */
export const contentSections = pgTable(
  'content_sections',
  {
    id: text('id').primaryKey(),
    pageKey: text('page_key').notNull(),
    sectionKey: text('section_key').notNull(),
    locale: text('locale').notNull().default('ar'),
    draftPayload: jsonb('draft_payload').$type<Record<string, unknown>>(),
    publishedPayload: jsonb('published_payload').$type<Record<string, unknown>>(),
    draftRevision: integer('draft_revision').notNull().default(0),
    publishedRevision: integer('published_revision'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('content_sections_page_section_locale_unique').on(
      table.pageKey,
      table.sectionKey,
      table.locale,
    ),
    index('content_sections_page_locale_idx').on(table.pageKey, table.locale),
    check('content_sections_draft_revision_nonnegative', sql`${table.draftRevision} >= 0`),
  ],
);

/**
 * Homepage FAQ items (W3.2).
 *
 * `id` is stable across draft/published states. Draft values are always
 * present; published values are null until the homepage is published.
 * `draft_deleted` marks a previously published item that is removed in the
 * draft; unpublished draft-only items are deleted physically on discard.
 */
export const faqItems = pgTable(
  'faq_items',
  {
    id: text('id').primaryKey(),
    locale: text('locale').notNull().default('ar'),
    draftQuestion: text('draft_question').notNull(),
    draftAnswer: text('draft_answer').notNull(),
    draftSortOrder: integer('draft_sort_order').notNull(),
    draftVisible: boolean('draft_visible').notNull().default(true),
    publishedQuestion: text('published_question'),
    publishedAnswer: text('published_answer'),
    publishedSortOrder: integer('published_sort_order'),
    publishedVisible: boolean('published_visible'),
    draftDeleted: boolean('draft_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    index('faq_items_locale_order_idx').on(table.locale, table.draftSortOrder),
    check('faq_items_draft_sort_order_nonnegative', sql`${table.draftSortOrder} >= 0`),
  ],
);
