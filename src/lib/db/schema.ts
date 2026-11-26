import { sql } from 'drizzle-orm';
import type { PromotionConfig } from '../plans/promotion';
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
 * W4 adds `plans`, `join_requests` and `join_intake_rate_limits`; W4.1 adds
 * nullable draft/published promotion JSONB and an immutable offer snapshot.
 * Analytics/settings tables remain out of scope (W5).
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
/**
 * Marketing plans (W4).
 *
 * Marketing data only: never authoritative for billing, subscriptions,
 * entitlements or merchant permissions. Each plan keeps independent draft and
 * published values. Public pricing/selection reads only `published_*` columns
 * while `status = 'published'`; owner edits never change the public offer until
 * the owner explicitly publishes. `draft_revision` is the per-plan optimistic
 * concurrency counter (edits, publication and hide all advance it).
 */
export const plans = pgTable(
  'plans',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    draftName: text('draft_name').notNull(),
    draftDescription: text('draft_description').notNull(),
    draftFeatures: jsonb('draft_features').$type<string[]>().notNull().default([]),
    draftMonthlyPriceMinor: integer('draft_monthly_price_minor'),
    draftYearlyPriceMinor: integer('draft_yearly_price_minor'),
    draftCurrency: text('draft_currency').notNull(),
    draftCtaLabel: text('draft_cta_label').notNull(),
    draftFeatured: boolean('draft_featured').notNull().default(false),
    draftDisplayOrder: integer('draft_display_order').notNull().default(0),
    draftPromotion: jsonb('draft_promotion').$type<PromotionConfig>(),
    publishedName: text('published_name'),
    publishedDescription: text('published_description'),
    publishedFeatures: jsonb('published_features').$type<string[]>(),
    publishedMonthlyPriceMinor: integer('published_monthly_price_minor'),
    publishedYearlyPriceMinor: integer('published_yearly_price_minor'),
    publishedCurrency: text('published_currency'),
    publishedCtaLabel: text('published_cta_label'),
    publishedFeatured: boolean('published_featured'),
    publishedDisplayOrder: integer('published_display_order'),
    publishedPromotion: jsonb('published_promotion').$type<PromotionConfig>(),
    status: text('status').notNull().default('draft'),
    draftRevision: integer('draft_revision').notNull().default(0),
    publishedRevision: integer('published_revision'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('plans_slug_unique').on(table.slug),
    index('plans_public_order_idx').on(table.status, table.publishedDisplayOrder),
    check('plans_status_valid', sql`${table.status} in ('draft', 'published', 'hidden')`),
    check('plans_draft_revision_nonnegative', sql`${table.draftRevision} >= 0`),
    check(
      'plans_draft_monthly_price_nonnegative',
      sql`${table.draftMonthlyPriceMinor} is null or ${table.draftMonthlyPriceMinor} >= 0`,
    ),
    check(
      'plans_draft_yearly_price_nonnegative',
      sql`${table.draftYearlyPriceMinor} is null or ${table.draftYearlyPriceMinor} >= 0`,
    ),
    check(
      'plans_published_monthly_price_nonnegative',
      sql`${table.publishedMonthlyPriceMinor} is null or ${table.publishedMonthlyPriceMinor} >= 0`,
    ),
    check(
      'plans_published_yearly_price_nonnegative',
      sql`${table.publishedYearlyPriceMinor} is null or ${table.publishedYearlyPriceMinor} >= 0`,
    ),
    check(
      'plans_display_order_range',
      sql`${table.draftDisplayOrder} between 0 and 9999 and (${table.publishedDisplayOrder} is null or ${table.publishedDisplayOrder} between 0 and 9999)`,
    ),
    check('plans_draft_currency_format', sql`${table.draftCurrency} ~ '^[A-Z]{3}$'`),
    check(
      'plans_published_currency_format',
      sql`${table.publishedCurrency} is null or ${table.publishedCurrency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      'plans_draft_promotion_object',
      sql`${table.draftPromotion} is null or jsonb_typeof(${table.draftPromotion}) = 'object'`,
    ),
    check(
      'plans_published_promotion_object',
      sql`${table.publishedPromotion} is null or jsonb_typeof(${table.publishedPromotion}) = 'object'`,
    ),
    check(
      'plans_published_complete',
      sql`${table.status} <> 'published' or (
        ${table.publishedName} is not null and
        ${table.publishedDescription} is not null and
        ${table.publishedFeatures} is not null and
        ${table.publishedCurrency} is not null and
        ${table.publishedCtaLabel} is not null and
        ${table.publishedFeatured} is not null and
        ${table.publishedDisplayOrder} is not null and
        ${table.publishedRevision} is not null
      )`,
    ),
  ],
);

/**
 * Early-access join requests (W4).
 *
 * Public write-only surface: submissions are created with status `new`,
 * internal notes unset, server-generated IDs/timestamps, and a server-generated
 * snapshot of the selected marketing offer. Administrative fields are never
 * accepted from clients. `revision` protects owner status/note edits from
 * silently overwriting a concurrent change.
 */
export const joinRequests = pgTable(
  'join_requests',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    businessActivity: text('business_activity'),
    planId: text('plan_id').references(() => plans.id, { onDelete: 'restrict' }),
    planNameSnapshot: text('plan_name_snapshot'),
    planPriceMinorSnapshot: integer('plan_price_minor_snapshot'),
    planPricePeriodSnapshot: text('plan_price_period_snapshot'),
    planCurrencySnapshot: text('plan_currency_snapshot'),
    offerSnapshot: jsonb('offer_snapshot').$type<Record<string, unknown>>(),
    source: text('source').notNull().default('direct'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    status: text('status').notNull().default('new'),
    notes: text('notes'),
    submissionToken: text('submission_token').notNull(),
    revision: integer('revision').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('join_requests_submission_token_unique').on(table.submissionToken),
    index('join_requests_created_at_idx').on(table.createdAt),
    index('join_requests_status_created_at_idx').on(table.status, table.createdAt),
    index('join_requests_plan_id_idx').on(table.planId),
    check('join_requests_status_valid', sql`${table.status} in ('new', 'contacted', 'closed')`),
    check(
      'join_requests_source_valid',
      sql`${table.source} in ('direct', 'pricing', 'join')`,
    ),
    check('join_requests_revision_nonnegative', sql`${table.revision} >= 0`),
    check('join_requests_phone_length', sql`char_length(${table.phone}) between 8 and 20`),
    check(
      'join_requests_plan_snapshot_valid',
      sql`${table.planId} is null or (${table.planNameSnapshot} is not null and ${table.planCurrencySnapshot} is not null)`,
    ),
    check(
      'join_requests_price_period_valid',
      sql`${table.planPricePeriodSnapshot} is null or ${table.planPricePeriodSnapshot} in ('monthly', 'yearly')`,
    ),
    check(
      'join_requests_price_snapshot_nonnegative',
      sql`${table.planPriceMinorSnapshot} is null or ${table.planPriceMinorSnapshot} >= 0`,
    ),
    check(
      'join_requests_offer_snapshot_object',
      sql`${table.offerSnapshot} is null or jsonb_typeof(${table.offerSnapshot}) = 'object'`,
    ),
    check(
      'join_requests_notes_length',
      sql`${table.notes} is null or char_length(${table.notes}) <= 4000`,
    ),
  ],
);

/**
 * Durable join-intake rate limiting (W4).
 *
 * One row per derived request-identity bucket (the raw IP/header is never
 * stored). The upsert in `src/lib/join/rate-limit.ts` is atomic; window expiry
 * resets the counter. Obsolete rows are pruned with a bounded cleanup. This
 * table is deliberately separate from Better Auth's `rate_limit` rows.
 */
export const joinIntakeRateLimits = pgTable(
  'join_intake_rate_limits',
  {
    key: text('key').primaryKey(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull(),
  },
  (table) => [
    index('join_intake_rate_limits_window_idx').on(table.windowStart),
    check('join_intake_rate_limits_count_nonnegative', sql`${table.count} >= 0`),
  ],
);

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
