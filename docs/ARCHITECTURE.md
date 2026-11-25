# ARCHITECTURE.md — Nokmel Website

Status: technical direction **[APPROVED]** by the external technical lead (2026-11-24).

## Approved stack [APPROVED]

- Next.js App Router + TypeScript
- Tailwind CSS
- Independent Neon PostgreSQL database (separate from the Nokmel platform database)
- Drizzle ORM
- Zod validation
- Secure owner-only authentication (single owner account; no public registration, no multiple roles). RESOLVED in W3.1: self-hosted Better Auth (see the W3.1 section below).
- Lightweight custom CMS using predefined sections (no generic page builder)
- External analytics provider for website traffic and conversion events. The exact provider remains **[OPEN]** until the analytics implementation phase.
- Vercel deployment (account `ammarjaberd`)
- GitHub Actions for CI

## Principles

- Avoid premature abstractions and unnecessary infrastructure.
- Documentation-only in W0: no scaffolding, no infrastructure provisioning, no database creation, no credentials, no deployment, no DNS changes.

## High-level structure

```
app/
  (public)/        # Home, Features, Pricing, Join, Contact, Privacy, Terms
  (admin)/         # Overview, Content & SEO, Plans & Pricing, Requests, Settings
  api/             # join-request intake, owner-authenticated admin APIs
drizzle/           # schema + migrations (independent Neon DB)
lib/               # db client, auth, content loaders
content/           # predefined CMS sections (editable via admin, stored in DB)
```

## Data model

This website's own database stores site content, marketing plans, join requests, and settings only:

- `content_sections` — predefined homepage/page sections (key, locale, JSON body, visibility)
- `faq_items` — question/answer pairs per locale
- `plans` — marketing plan name, description, monthly price and optional yearly price, currency, features, order, visibility, CTA config. **Marketing data only; never authoritative for billing/entitlements.**
- `join_requests` — name, contact, selected plan, status (`new` / `contacted` / `closed`), notes, timestamps
- `site_settings` — website, contact, social, CTA, notification settings
- Owner authentication data lives in the Better Auth schema (`user` + `account` `credential` provider; see the W3.1 section below). Supersedes the earlier `owner_account` placeholder.

**Analytics:** website traffic and conversion events (including join-request conversion metrics) come from the external analytics provider. Do not design or implement a custom analytics pipeline; there is no first-party analytics_events table.

## Security and authorization (mandatory) [APPROVED requirement]

- Owner-only authentication for `/admin` and admin APIs; session-based with secure cookies; CSRF protection; rate limiting on join form and login.
- No public account registration. No role system.
- Join requests are public-write (rate-limited) but public-read never.
- Secrets only via environment variables; never committed.

## Pricing boundary [APPROVED]

Website-managed plans are marketing data only. They must not control subscriptions, entitlements, or merchant permissions. Authoritative pricing/entitlements remain with the Nokmel platform until commercial activation. No billing/payment integration in this phase.

## Deployment [APPROVED, future]

Vercel project under account `ammarjaberd`, linked to `geekammar/nokmel-website`; CI via GitHub Actions (lint, typecheck, build, tests on PRs). No deployment performed in W0; production deployment requires explicit approval.

## W3.1 — Admin foundation & owner authentication [IMPLEMENTED; conditional Preview acceptance]

Status below reflects the W3.1 implementation plus the final acceptance closure (2026-11-25). The isolated Neon development database and Vercel Preview are configured, physical Android functional acceptance passed (owner-reported 7/7), and independent Muse desktop acceptance returned CONDITIONAL ACCEPT for Preview. This closure addresses the confirmed defects; W3.2 has not started.

### Authentication stack [APPROVED, W3.1]

- **Self-hosted Better Auth** (`better-auth@1.7.28`, pinned) with email + password for exactly one owner. No social login, no anonymous users, no guest sessions, no email delivery in W3.1.
- **Public sign-up disabled server-side** via Better Auth's `disableSignUp` — direct requests to registration endpoints fail and create nothing (verified by DB integration tests).
- **No roles**: owner-only access is enforced against the configured `OWNER_EMAIL` identity (normalization: trim + lowercase). A valid session that is not the owner session gets no admin access (enforced in `src/lib/owner.ts`).
- Password hashing uses Better Auth's supported hashing (`better-auth/crypto`); no custom crypto, no JWT, no session token in `localStorage`.

### Database & ORM [APPROVED, W3.1]

- Neon PostgreSQL 18 (independent `nokmel-website` project), Drizzle ORM + Drizzle Kit migrations, `node-postgres` driver (pooled for runtime, direct connection for migrations/provisioning only: `DATABASE_URL_DIRECT`).
- All connection paths share `src/lib/db/connection-policy.ts`. It validates the target **before** a pool/client exists, rejects URL parameters that could override the destination or TLS (`host`, `port`, `user`, `password`, `dbname`, `ssl*`, `options`, `uselibpqcompat`, …), strips query parameters from the string handed to the pinned `pg` driver, and passes TLS explicitly. Hosted connections use certificate + hostname verification (`rejectUnauthorized: true`); `sslmode=disable` is accepted only for an explicit loopback test database. `rejectUnauthorized: false` is never used.
- Migration TLS: `drizzle.config.ts` validates `DATABASE_URL_DIRECT` and supplies structured credentials with an explicit TLS option, so the pg connection-string parser cannot weaken the migration connection. `pnpm db:migrate` validates the direct target first in `scripts/db-migrate.ts`; a pooled endpoint or missing `DATABASE_URL_DIRECT` is refused.
- Pooled connection is a lazy singleton (`src/lib/db/index.ts`) — no per-request pools.
- Migrations are **not** applied during build or startup; they run explicitly via `pnpm db:migrate` (Drizzle Kit) against `DATABASE_URL_DIRECT` (or in tests via the Drizzle migrator against a disposable DB). No `drizzle push` against hosted environments, ever.
- Least-privilege runtime/migration roles and exact grants: `docs/DATABASE_PERMISSIONS.md`. The runtime role does not own the database/schema/tables and has no DDL or TRUNCATE rights.

### Destructive test database safety [W3.1 hardening]

`src/lib/db/disposable-test-database.ts` is the single gate used by integration tests and browser e2e setup. Before any connection, migration, fixture write, truncate, or drop it requires:

- an explicitly allowed loopback host (`127.0.0.1`, `::1`, `localhost`) — remote hosts and Neon endpoints are refused;
- an approved disposable database name (`nokmel_test`, `nokmel_ci_test`, `nokmel_ci_e2e`, or `nokmel_test_*` / `nokmel_ci_*`; the generic `postgres` database is accepted only for the harness-owned temporary embedded instance);
- an explicit `sslmode=disable` (plaintext is not implied);
- no destination/TLS-overriding connection parameters; invalid protocols/malformed URLs are rejected.

The target is re-validated before destructive SQL. `TEST_DATABASE_URL` never falls back to the hosted runtime `DATABASE_URL`; without it the harness launches its own temporary embedded PostgreSQL 18 instance. E2E setup validates `DATABASE_URL` with the same rules before migrating/writing. Unit regression tests prove unsafe targets are rejected without opening a connection.

### Owner provisioning serialization & integrity [W3.1 hardening]

- `provisionOwner`/`resetOwnerPassword` take a transaction-scoped PostgreSQL advisory lock (`pg_advisory_xact_lock(hashtext('nokmel.website.owner_credentials')::bigint)`) **before** reading owner state, so concurrent operator processes cannot both see an empty database. The HTTP credential sign-in path takes the same exclusive lock around the whole `auth.handler()` call (dedicated single-connection lock pool). No process-local mutex is used.
- An existing matching email is not accepted as proof of a valid owner: provisioning requires exactly one credential account whose `account.user_id = account.account_id = user.id`, with a usable Better Auth password hash. Incomplete, duplicate, inconsistent, or unusable records are refused and never silently overwritten.
- A partial unique index (`account_user_credential_unique` on `account(user_id) WHERE provider_id = 'credential'`, migration `drizzle/0001_*.sql`) provides database-level defense in depth.
- Password recovery rehashes in the same transaction that deletes all sessions for the owner. Previously issued sessions stop authorizing immediately (verified). NKW-W31-REC-01 is resolved by the shared sign-in/recovery lock: recovery waits for any in-flight sign-in to finish creating its session, then deletes it in the same transaction. A deterministic PostgreSQL-backed test reproduces the original unlocked race and proves the guarded route leaves no usable old-password session.

#### Authentication schema (W3.1 — actual)

`src/lib/db/schema.ts` + `drizzle/0000_w31-auth-foundation.sql`, generated by Drizzle Kit from the Better Auth core schema (user / session / account / verification) plus `rate_limit` for Better Auth's database-backed rate limiting. The W0-era `owner_account` reference is superseded by the actual Better Auth identity model (`user` + `account(provider: credential)`); owner-only is an authorization policy, not a role.

Future schema boundaries (NOT in W3.1, no tables created): `content_sections`, `faq_items`, `plans`, `join_requests`, `site_settings` (W3.2/W3.3/W4).

### Owner-only authorization model (W3.1)

- `getOwnerSession()` — session + owner identity check (fails closed when config missing).
- `requireOwner()` — admin pages/layouts; redirects to `/admin/login`.
- `enforceOwnerForMutation()` — future protected route handlers/server actions; returns 401 instead of HTML.
- Auth (valid session) and authorization (owner identity) stay separate; middleware only does an optimistic cookie-presence redirect and is never the security boundary.
- Protected admin pages are `force-dynamic`; no cross-session caching of admin responses.

### Session policy (W3.1)

- 7-day expiry (`expiresIn: 7d`), daily refresh (`updateAge: 24h`), server-side session records in PostgreSQL; revoked/deleted/expired sessions stop authorizing immediately (verified by tests).
- Cookies: HTTP-only, `SameSite=Lax`, named `nokmel.session_token` (Secure + `__Secure-` prefix on HTTPS deployments — Better Auth derives this from the deployment origin). No `remember-me` in W3.1; development over plain HTTP keeps the same semantics minus the Secure flag (documented dev exception only).

### Login abuse prevention & CSRF (W3.1)

- Better Auth rate limiting backed by the `rate_limit` table (survives serverless instance restarts): 5 sign-in attempts / minute / resolved request identity; generic 429 response with `X-Retry-After` (Better Auth's actual header; the UI captures it and otherwise uses a conservative 60-second client cooldown). Window-based expiry means no permanent account lockout.
- `RATE_LIMIT_SIGNIN_MAX` is honored only when `NOKMEL_DISPOSABLE_TEST_ENV=1` is also set and `VERCEL_ENV` is not `production`/`preview`. Invalid, zero, negative, or excessive values are ignored and the default 5 remains. Hosted Vercel environments therefore cannot weaken the limit through environment configuration (unit + DB integration tests).
- Better Auth origin checks + Fetch-Metadata CSRF checks remain enabled. `BETTER_AUTH_URL` is mandatory and must be an exact absolute origin: HTTPS for hosted deployments, HTTP only for explicit loopback development/tests. `TRUSTED_ORIGINS` adds exact immutable aliases (for example one preview URL) with no wildcards, credentials, paths, queries, or fragments. `BETTER_AUTH_TRUSTED_ORIGINS` is rejected because Better Auth would merge it without validation. Unknown origins are rejected with 403 for sign-in and sign-out (verified), including arbitrary `*.vercel.app` hosts.
- `callbackURL`/redirect parameters are validated against trusted origins (open-redirect protection, verified). Middleware redirects target fixed app paths only.
- Login errors are generic (identical response for unknown email and wrong password — verified); no owner email appears in page source.

### W3.1 request-identity evidence (Vercel)

Three evidence layers are kept separate:

1. **Library-level integration evidence.** Pinned Better Auth 1.7.28 resolves the rate-limit identity only from single-value configured headers unless `trustedProxies` is set; a multi-value chain resolves to no IP and falls back to one shared per-path bucket rather than trusting the leftmost value. `src/lib/auth.ts` explicitly configures `advanced.ipAddress.ipAddressHeaders = ['x-forwarded-for']` and does not trust a proxy chain. Automated tests cover single-value buckets, spoofed multi-value chains, and shared-bucket fallback.
2. **Official Vercel forwarding guarantee.** The Vercel request-header documentation states that Vercel overwrites `X-Forwarded-For` and does not forward externally supplied IPs ("This restriction is in place to prevent IP spoofing"), and documents `x-real-ip`/`x-vercel-forwarded-for` as identical. The trust decision above relies on that platform guarantee, not on an assumption that arbitrary forwarded headers are safe.
3. **Actual hosted request-header evidence.** Not obtained: the configured Preview remains behind Vercel SSO and no authorized Vercel access is available from the execution environment. This remains an explicit live check; no public debug endpoint exposes request headers. If an external proxy is placed in front of Vercel, this decision must be re-evaluated.

### W3.1 final acceptance closure (2026-11-25)

**Live infrastructure state (configured externally; no secrets in this repository):**

- Neon project `nokmel-website` (`delicate-cake-38544235`), development branch `br-winter-hat-bdqgatki`, database `nokmel_website`. Production branch `br-noisy-fire-bdkl5wa4` remains untouched.
- Roles `nokmel_migrator` and `nokmel_runtime` configured. Runtime has no database/schema CREATE permission and uses the restricted runtime role. The migration role has the required `public` and `drizzle` schema privileges; its temporary database-level CREATE was revoked after the two applied migrations. Future migrations require the temporary re-grant/revoke sequence documented in `docs/DATABASE_PERMISSIONS.md`.
- Migrations applied to development: `0000_w31-auth-foundation` and `0001_parallel_skin` (auth tables + partial credential uniqueness index). QA owner provisioned by the external lead.
- Preview runtime variables configured for the existing PR Preview only: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `OWNER_EMAIL`. `DATABASE_URL_DIRECT` is not configured in Vercel.
- Configured, independently accepted Preview deployment: `dpl_Gs4fzWGwMGcPjkLxcTbECp33HWRn`, immutable URL `https://nokmel-website-96pnuvu12-ammarjaberd-7111.vercel.app`, authorized auth origin `https://nokmel-website-git-vibe-w31-owner-auth-ff98b7-ammarjaberd-7111.vercel.app`. The earlier unconfigured deployment `dpl_FNtx2FMXi8MHAo2NEfz4a5EkG27q` is a different deployment identity (not a functional defect).

**Closure corrections:**

- NKW-W31-REC-01 (password-recovery race) is resolved with the shared database advisory lock described above; deterministic concurrency coverage includes an unlocked control that reproduces the original race.
- NKW-W31-UX-01: password visibility control is a compact eye/eye-off icon with a 44px target inside an LTR wrapper; the Arabic label remains RTL, password content stays LTR, reserved padding and logical positioning are consistent, and the toggle preserves value/accessibility/keyboard behavior.
- NKW-W31-UX-02/03: the Overview card no longer duplicates the navigation section list or displays `W3.1`; it is a compact honest empty state using existing navigation availability labels. Minimal spacing adjustments only; no navigation redesign.
- NKW-W31-S05-01: the login UI captures Better Auth's real `X-Retry-After` response header and shows an approximate countdown; if unavailable it uses a conservative 60-second cooldown. Submission is disabled during cooldown, no permanent lockout is introduced, and the server remains authoritative.
- Security coverage closure: separate-browser-context authorization, server-side public sign-up refusal over HTTP, session cookie attributes, untrusted Origin, unsafe callback URL, request-identity evidence separation, and production-mode noindex/canonical metadata for all seven public routes.

**Acceptance state:** physical Android functional checks 7/7 PASS (owner-reported); Muse desktop acceptance: 35 cases (23 PASS, 2 PARTIAL, 2 FAIL, 6 BLOCKED, 2 NOT TESTED), CONDITIONAL ACCEPT for Preview. The sign-in/recovery lock is transaction-scoped specifically for Neon's pooled endpoint, but local evidence uses a direct disposable PostgreSQL 18; live Preview retesting must confirm the lock through the actual pooler. Remaining live checks are listed in `CURRENT_STATE.md`.

### W3.1 authentication error boundary

`src/app/api/auth/[...all]/route.ts` awaits `auth.handler()` inside the error boundary, converts asynchronous database/adapter failures to a generic 500, keeps missing configuration at 503, and logs only a fixed message plus the error class name (no stack traces, SQL, credentials, tokens, or paths). Database failures never grant access. The public website does not depend on this route.

### Route groups

- `src/app/(public)/` — the seven W2 public routes, unchanged layout (Header/Footer).
- `src/app/(auth)/admin/login` — owner login (no marketing chrome).
- `src/app/(admin)/admin` — protected admin shell (sidebar, session controls, logout) excluding marketing chrome; unavailable future sections are non-interactive with clear "not available" labels.

### W3.1 infrastructure handoff (external lead + owner）

Environment variables (runtime on Vercel; operator values only on the operator machine):

| Variable | Scope | Notes |
|---|---|---|
| `DATABASE_URL` | runtime, **secret** | Pooled Neon URL (`-pooler` host), runtime role |
| `DATABASE_URL_DIRECT` | operator machine only, **secret** | Direct Neon URL, migration role. Must **not** be configured in Vercel or exposed to the deployed runtime; the app never falls back to it |
| `BETTER_AUTH_SECRET` | runtime, **secret** | ≥32 random chars; unique per environment; never reused across preview/production |
| `BETTER_AUTH_URL` | runtime | Exact deployment origin (production: `https://nokmel.tech`) |
| `TRUSTED_ORIGINS` | runtime | Comma-separated exact authorized origins incl. the specific preview URL — no wildcards; `BETTER_AUTH_TRUSTED_ORIGINS` is not supported |
| `OWNER_EMAIL` | runtime | The single authorized owner identity (not a secret, but never published in UI) |
| `RATE_LIMIT_SIGNIN_MAX` | optional, disposable test environments only | Ignored unless `NOKMEL_DISPOSABLE_TEST_ENV=1`; always ignored when `VERCEL_ENV` is `production`/`preview`. Never set in deployed environments |
| `NOKMEL_DISPOSABLE_TEST_ENV` | disposable local/CI test runtime only | Explicit opt-in marker required for the rate-limit test override; never set in preview/production |

Neon role separation (least privilege; exact reviewed SQL in `docs/DATABASE_PERMISSIONS.md`):
- **Runtime role** (`DATABASE_URL`): USAGE on `public` + SELECT/INSERT/UPDATE/DELETE on the five auth tables only; **no** CREATE/ALTER/DROP/TRUNCATE, does not own the database/schema/tables. The runtime never migrates or provisions.
- **Migration/provisioning role** (`DATABASE_URL_DIRECT`): owns the auth tables (for future `ALTER`), has CREATE on `public` and `drizzle`, and DML for owner provisioning/recovery. Database-level CREATE was granted temporarily for the two applied migrations and then revoked. The current pinned migration tool requires that temporary grant again for any future migration run (PostgreSQL checks it even though `drizzle` exists); revoke it immediately afterward. Never used by deployed app instances and never configured in Vercel.

Commands (operator machine; secrets via env — never argv, never committed). `DATABASE_URL_DIRECT` is required for both migration and provisioning; the runtime `DATABASE_URL` is never accepted as a fallback:
```bash
pnpm db:generate           # generate migration SQL after schema edits (Drizzle Kit; no DB connection)
pnpm db:check              # validate migration metadata
pnpm db:migrate            # validates DATABASE_URL_DIRECT, then applies migrations (never production without explicit approval)
pnpm owner:provision       # interactive, hidden input, repeated confirmation; or:
printf '%s' "$OWNER_PASSWORD" | pnpm owner:provision --yes   # non-interactive (stdin, not argv)
pnpm owner:reset-password  # recovery: rehash + invalidate all existing sessions
```

Provisioning behavior: refuses a second owner (only one credential user may exist); idempotent for the same identity (re-run reports "already provisioned" and changes nothing); rejects incomplete/duplicate/inconsistent credential records without overwriting; serializes concurrent runs with a database advisory lock; validates that migrations were applied; exit codes 0/1/2. The operator CLI is a local process, never mounted as an HTTP handler and never prints credentials.

Verification without printing secrets:

```bash
pnpm test:db
# deployment smoke (codes only, no secrets):
# - "/admin/login" should return 200
# - "/admin" without a session cookie should redirect (3xx) to /admin/login
```

Neon projects in scope: `nokmel-website` (production branch `br-noisy-fire-bdkl5wa4`, development branch `br-winter-hat-bdqgatki`). Out of scope: `Nokmel_prod`, `Nokmel_dev`, any other Neon project.

## W3.2 — Lightweight CMS, content publishing & mobile admin navigation [IMPLEMENTED; pending independent acceptance]

Status: implementation complete on `feature/w32-content-management` (base `main` `09a63d3db6ef69ffecd238b408a733d7fdc53c07`). Production activation and hosted acceptance remain deferred to W6; see `CURRENT_STATE.md`.

### Scope and boundaries

The CMS edits only the existing seven predefined public pages and the homepage FAQ. It does not create pages, sections, layouts, media, plans, SEO metadata, join-request storage, analytics, or contact-channel configuration. SEO editing remains W3.3, plans/join requests W4, analytics/settings W5, and launch activation W6.

### Content inventory (implementation source of truth)

| Public page | Stored section keys | Editable fields | Code-controlled / not editable |
|---|---|---|---|
| `/` home | `hero`, `showcase`, `problems`, `capabilities`, `steps`, `pricingTeaser`, `faq`, `finalCta` | Headlines, descriptions, CTA labels, problem/step/capability titles and bodies, showcase copy, pricing teaser, FAQ title | All CTA destinations, capability statuses and group titles, showcase structure/illustration, section order, FAQ item management (separate table), header/footer |
| `/features` | `hero`, `workflows`, `planned`, `cta` | Page heading/lead/status note, workflow/planned titles and bodies, CTA copy | CTA destination, capability statuses and groups, item counts |
| `/pricing` | `hero`, `earlyAccess`, `transparency`, `noPurchase`, `cta` | Introductory/explanatory copy, early-access points, CTA labels | Plan prices/CRUD, billing, CTA destinations, warning placement |
| `/join` | `hero`, `form` | Marketing heading/lead, form title, disabled notice, submit copy, privacy-note copy | Disabled state, field IDs/names/types/requiredness/autocomplete/placeholders, submission, link destinations |
| `/contact` | `hero`, `channels`, `joinSuggestion` | Heading/lead, channel-section title, empty-state copy, join suggestion, CTA label | Contact channels/destinations (empty; W5), CTA destination |
| `/privacy` | `legal` | Page title/intro, six predefined legal section headings/bodies | Draft-status banner, pre-launch legal policy, section count, no invented claims |
| `/terms` | `legal` | Page title/intro, six predefined legal section headings/bodies | Draft-status banner, pre-launch legal policy, section count, no invented claims |

Images: no existing public component has a meaningful owner-editable image field. W3.2 therefore provides no image selector/uploads/media library; brand logo assets remain code-controlled. This is an intentional limitation.

### Persistence model

- `content_sections` — identity `(page_key, section_key, locale)` with deterministic text `id`; separate `draft_payload`/`published_payload` JSONB, `draft_revision`, `published_revision`, `updated_at`, `published_at`. Unique index `content_sections_page_section_locale_unique`; nothing is stored for unregistered pages/sections/locales.
- `faq_items` — stable text `id`, locale, draft question/answer/order/visibility, nullable published question/answer/order/visibility, `draft_deleted`, timestamps and `published_at`. Draft-only additions are deleted physically; removals of published items are flagged in the draft and deleted on publication/discard accordingly.
- No revision history, generic blocks, custom fields, sequences, workflow engine, or page-level table. Page revision is the maximum `draft_revision` across the page's section rows.
- All payloads are validated against the typed registry before storage and before rendering. The payload is always rebuilt from the approved structural default plus the registry's editable fields, so unknown/extra fields (links, statuses, form structure, images) are rejected rather than persisted.

### Draft, preview and publication semantics

- Saving a draft never changes published payloads.
- Publication is explicit, owner-authorized, and atomic for one page; homepage publication also publishes homepage FAQ changes in the same transaction.
- Publication validates the complete effective page (draft where present, otherwise published/default) and refuses an empty FAQ or an item without a question/answer. A failed publication preserves the previous published state.
- Discard clears section drafts and restores FAQ drafts from published values; it never deletes published content and increments the page revision.
- Page-scoped PostgreSQL advisory locks serialize save/publish/discard. Every mutation checks the expected page revision; stale writes/publication/discard return a controlled Arabic conflict error.
- Protected preview: `/admin/content/[pageKey]/preview` is inside the admin shell, calls `requireOwner()` both in its page and the admin layout, is `force-dynamic`, noindex, and renders the saved draft with the same page view components as the public routes. No token or query parameter selects draft mode.

### Defaults and database-failure behavior

- `src/content/ar/*` remains the authoritative default content; the registry in `src/content/cms/registry.ts` is deterministic and side-effect-free.
- The public site renders approved defaults when `DATABASE_URL` is absent, the CMS tables are missing/not migrated, no published record exists, stored published data is invalid, or the database is temporarily unavailable. Invalid stored payloads never trigger draft exposure. Operational logging is sanitized (page + reason class only).
- The admin editor distinguishes: no stored override, draft exists, published override exists, not migrated, unconfigured, temporarily unavailable, invalid stored data. It never reports a save/publication success before the server confirms persistence.
- No seed/bootstrap is required. Initial content is served from code; rows are materialized only when the owner saves a draft. There is no startup/build table creation.

### Public loading and caching

Public routes keep their paths, header/footer, and visual layout. `src/app/(public)/layout.tsx` sets `dynamic = 'force-dynamic'`: each public request reads published sections (one query) and, for home, published FAQ (one query). There is no cross-request content cache, so publication is visible on the next request without a deployment and database-failure fallbacks are never cached indefinitely. Admin/preview content is never shared through public caches. `revalidatePath` is still called after publication for route-cache hygiene. This deliberately simple strategy avoids a bespoke invalidation service; a bounded shared cache can be added later if traffic warrants it.

### Authorization and mobile admin navigation

- Every editor page, preview, and server action independently calls `requireOwner()`/`getOwnerSession()`; the admin layout and middleware are not security boundaries. Server actions are POST-only with Next.js origin/CSRF checks preserved. Unauthorized/non-owner requests write nothing and receive controlled errors.
- Mobile admin navigation is a closed-by-default disclosure panel anchored under a compact header: 44px menu/logout targets, current-section state, Escape close with focus restoration, outside-click close, close on navigation, desktop sidebar preserved. Future sections remain non-interactive with concise labels.
- The `Content & SEO` section is active for content editing only; a clear note states SEO metadata editing arrives in W3.3.

### W3.2 migrations and infrastructure handoff

Additive migration: `drizzle/0002_w32-content-cms.sql` (tables + indexes + checks). It applies from an empty database and upgrades a W3.1 database without touching auth tables/rows (verified against synthetic user/account/session/verification/rate-limit records). Runtime grants and the temporary migrator database-level CREATE requirement are documented in `docs/DATABASE_PERMISSIONS.md`; the runtime receives only SELECT/INSERT/UPDATE/DELETE on the two CMS tables. There are no application sequences. The hosted development migration and new branch Preview configuration are external operator tasks; the coding agent never connects to hosted Neon, never runs hosted migrations, rotates credentials, revokes QA sessions, or touches production.
