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

## W3.1 — Admin foundation & owner authentication [IMPLEMENTED, branch review pending]

Status below reflects the W3.1 implementation (self-hosted Better Auth approved by the external technical lead). Items marked in the handoff section require external infrastructure configuration before live acceptance.

### Authentication stack [APPROVED, W3.1]

- **Self-hosted Better Auth** (`better-auth@1.7.28`, pinned) with email + password for exactly one owner. No social login, no anonymous users, no guest sessions, no email delivery in W3.1.
- **Public sign-up disabled server-side** via Better Auth's `disableSignUp` — direct requests to registration endpoints fail and create nothing (verified by DB integration tests).
- **No roles**: owner-only access is enforced against the configured `OWNER_EMAIL` identity (normalization: trim + lowercase). A valid session that is not the owner session gets no admin access (enforced in `src/lib/owner.ts`).
- Password hashing uses Better Auth's supported hashing (`better-auth/crypto`); no custom crypto, no JWT, no session token in `localStorage`.

### Database & ORM [APPROVED, W3.1]

- Neon PostgreSQL 18 (independent `nokmel-website` project), Drizzle ORM + Drizzle Kit migrations, `node-postgres` driver (pooled for runtime, direct connection for migrations/provisioning only: `DATABASE_URL_DIRECT`).
- TLS always on with certificate validation for hosted connections (`sslmode=disable` accepted exclusively for loopback test databases).
- Pooled connection is a lazy singleton (`src/lib/db/index.ts`) — no per-request pools.
- Migrations are **not** applied during build or startup; they run explicitly via `pnpm db:migrate` (Drizzle Kit) against `DATABASE_URL_DIRECT` (or in tests via the Drizzle migrator against a disposable DB). No `drizzle push` against hosted environments, ever.

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

- Better Auth rate limiting backed by the `rate_limit` table (survives serverless instance restarts): ~5 sign-in attempts / minute / trusted request identity; generic 429 response with `Retry-After`. Window-based expiry means no permanent account lockout. `RATE_LIMIT_SIGNIN_MAX` exists only to raise the ceiling inside disposable automated e2e environments.
- Better Auth origin checks + Fetch-Metadata CSRF checks remain enabled; trusted origins come from `BETTER_AUTH_URL` + `TRUSTED_ORIGINS` (exact hosts only, no wildcards). Unknown origins are rejected with 403 for sign-in and sign-out (verified).
- `callbackURL`/redirect parameters are validated against trusted origins (open-redirect protection, verified). Middleware redirects target fixed app paths only.
- Login errors are generic (identical response for unknown email and wrong password — verified); no owner email appears in page source.

### W3.1 rate-limit identity caveat

Better Auth derives the rate-limit identity from `X-Forwarded-For` by default. On Vercel the edge sets/appends this header; configuring `advanced.ipAddress.trustedProxies` / `ipAddressHeaders` for the actual edge behavior is an infrastructure-configuration item for the external lead (see handoff below). Auth security does not depend on IP; only rate-limit granularity does.

### Route groups

- `src/app/(public)/` — the seven W2 public routes, unchanged layout (Header/Footer).
- `src/app/(auth)/admin/login` — owner login (no marketing chrome).
- `src/app/(admin)/admin` — protected admin shell (sidebar, session controls, logout) excluding marketing chrome; unavailable future sections are non-interactive with clear "not available" labels.

### W3.1 infrastructure handoff (external lead + owner）

Environment variables (Vercel; per environment — preview values separate from production):

| Variable | Scope | Notes |
|---|---|---|
| `DATABASE_URL` | runtime, **secret** | Pooled Neon URL (`-pooler` host), runtime role |
| `DATABASE_URL_DIRECT` | migration/provisioning only, **secret** | Direct Neon URL, migration role; never used by the app runtime |
| `BETTER_AUTH_SECRET` | runtime, **secret** | ≥32 random chars; unique per environment; never reused across preview/production |
| `BETTER_AUTH_URL` | runtime | Exact deployment origin (production: `https://nokmel.tech`) |
| `TRUSTED_ORIGINS` | runtime | Comma-separated exact authorized origins incl. the specific preview URL — no wildcards |
| `OWNER_EMAIL` | runtime | The single authorized owner identity (not a secret, but never published in UI) |
| `RATE_LIMIT_SIGNIN_MAX` | optional, disposable test environments only | Raises the sign-in rate-limit ceiling for automated e2e; do not set in preview/production |

Neon role separation (least privilege, configured by the lead):
- **Runtime role** (`DATABASE_URL`): SELECT/INSERT/UPDATE/DELETE on the auth tables only; **no** CREATE/ALTER/DROP. The runtime never migrates.
- **Migration/provisioning role** (`DATABASE_URL_DIRECT`): CREATE/ALTER on the public schema (used only for `pnpm db:migrate`) + the same DML as runtime (used only for owner provisioning). Never used by deployed app instances.

Commands (operator machine; secrets via env — never argv, never committed):
```bash
pnpm db:generate           # generate migration SQL after schema edits (Drizzle Kit, DATABASE_URL_DIRECT)
pnpm db:check              # validate migration metadata
pnpm db:migrate            # apply migrations to DATABASE_URL_DIRECT (never to production without explicit approval)
pnpm owner:provision       # interactive, hidden input, repeated confirmation; or:
printf '%s' "$OWNER_PASSWORD" | pnpm owner:provision --yes   # non-interactive (stdin, not argv)
pnpm owner:reset-password  # recovery: rehash + invalidate all existing sessions
```

Provisioning behavior: refuses a second owner (only one credential user may exist); idempotent for the same identity (re-run reports "already provisioned" and changes nothing); validates that migrations were applied; exit codes 0/1/2. The operator CLI is a local process, never mounted as an HTTP handler.

Verification without printing secrets:

```bash
pnpm test:db
# deployment smoke (codes only, no secrets):
# - "/admin/login" should return 200
# - "/admin" without a session cookie should redirect (3xx) to /admin/login
```

Neon projects in scope: `nokmel-website` (production branch `br-noisy-fire-bdkl5wa4`, development branch `br-winter-hat-bdqgatki`). Out of scope: `Nokmel_prod`, `Nokmel_dev`, any other Neon project.
