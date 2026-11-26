# Nokmel Website

Marketing website for Nokmel — a separate project from the Nokmel commerce platform (`geekammar/nokmel`, which must not be accessed or modified by this project).

- Target domain: `nokmel.tech`
- Future hosting: Vercel (account `ammarjaberd`)
- Default branch: `main`

## What this is

A simple, professional, mobile-first SaaS marketing website with a lightweight owner-only administration dashboard. The primary business objective is converting interested merchants into early-access applicants and, later, paying subscribers.

## Documentation

- [Product Spec](docs/PRODUCT_SPEC.md) — approved scope, boundaries, acceptance gates
- [Architecture](docs/ARCHITECTURE.md) — proposed technical stack and data model
- [Design System](docs/DESIGN_SYSTEM.md) — brand and UI rules (source: Brand Kit v2.0)
- [Roadmap](docs/ROADMAP.md) — W0–W6 workstreams
- [Current State](docs/CURRENT_STATE.md) — concise live status
- [W5 Integrations](docs/W5_INTEGRATIONS.md) — GA4 and Telegram external setup handoff
- [Database Permissions](docs/DATABASE_PERMISSIONS.md) — least-privilege roles and per-migration grants

## Working copy (subject to owner approval)

- Marketing headline: متجرك في المحادثة. وبزنسك في مكان واحد.
- Brand tagline: خلي بزنسك يكمل.
- Primary CTA: Request to Join (اطلب الانضمام)

## Status

- **W2-S (Marketing design & interactive product showcase): IMPLEMENTED** on `feature/w2s-marketing-design-showcase` from merged W5 `main` (draft PR; no merge, no deployment). Premium RTL-first refinement of the existing seven public routes, a compact interactive customer/merchant showcase with direct product/action buttons using verified merchant-app behavior and clearly labelled synthetic data, a focused homepage, an improved footer, a 1200 × 630 social-sharing candidate registered in the existing local-image registry, and NKW-W5-001/NKW-W5-002 corrections. No migration, no new public route, no showcase backend, no real commerce mutation and no external provider activation. Merchant-app evidence is pinned to `geekammar/nokmel` commit `74e864dacfa0e6598bb01e99402946e27a94216f` (read-only inspection). Local verification: unit 281/281, PostgreSQL 187/187, Playwright 124/124; exact CI recorded on the final HEAD.
- **W5 (Business overview, external analytics, owner notifications & settings): MERGED & ACCEPTED** via PR #9. Accepted HEAD `5fceb8e97036dfc9c2aa6ec33a03921442257295`; merge commit `4f32b94ac6943f61e96f58014672d25eaa37968e`. All three CI jobs passed on the accepted HEAD (`https://github.com/geekammar/nokmel-website/actions/runs/45883572257`). The owner-supplied independent W5 acceptance record reports 20/20 PASS and the authorized QA cleanup completed. Database-backed Overview with Cairo periods, all-time follow-up backlog, source/plan/historical-promotion breakdowns and latest protected links; disabled-by-default, reversible-consent GA4 reporting/tracking through a server-only adapter with event-specific key-event conversion; optional owner Telegram notifications with test-before-enable, durable attempt-fenced delivery state and safe manual retry; typed owner settings with explicit public/private projection and masked mutation readback; NKW-W41-001 corrected. Additive migration `0005_w5-settings-notifications` adds `site_settings` and nullable notification columns (no analytics-events table). Hosted activation/Production remain external. See `docs/ARCHITECTURE.md` W5 and `docs/W5_INTEGRATIONS.md`.
- **W4.1 (Scheduled promotional pricing & historical offer integrity): MERGED & ACCEPTED** via PR #8 (accepted HEAD `7d33ab734cc84cb51f17d67aa972390559c71e86`, merge commit `d50f7d555859b5f0ee4dc5b7075127f9e02eafde`; independent live acceptance 18/18, 0 FAIL/PARTIAL/BLOCKED). One optional scheduled percentage/fixed discount per plan, Cairo scheduling, draft/published lifecycle, shared effective-offer resolver/version, stale-offer recovery and expanded historical snapshots. Additive migration `0004_w41-scheduled-promotional-pricing` is applied on hosted Development. NKW-W4-006 closed; FAQ Q6 preserved.
- **W4 (Marketing plans, pricing & early-access join requests): CONDITIONAL ACCEPT for Preview** on `feature/w4-plans-join-requests` (draft PR; hosted Development activated; final product-consistency closure). Owner-only Plans & Pricing with draft/publish/hide lifecycle, exact minor-unit monthly/yearly prices (or an explicit unpriced state), accessible feature/order editing, owner preview, public pricing cards, `/join?plan=<slug>` preselection, and a fail-closed (`JOIN_INTAKE_ENABLED`) durable join-request intake with rate limiting, idempotency and historical offer snapshots. Owner-only Join Requests includes filters, bounded pagination, search, status and internal notes. Additive migration `0003_w4-plans-join-requests` is applied on hosted Development; Production intake, privacy/retention approval and all W6 launch gates remain external.
- **W3.3 (Page-level SEO & social metadata): merged** via PR #6 (accepted HEAD `dcf1f8d9ede739a29bd48d036df1a1d5cd9f28bf`, merge commit `0020ddacdd54b3c23471b58b17b54fda1c1a0ae1`). No migration.
- **W3.2 (Lightweight CMS, content publishing & mobile admin navigation): merged** via PR #5 (accepted HEAD `fb677dabc82f2c60a6301d862314142805fba0f8`). Owner-only Content & SEO section with predefined page editors, validated drafts, atomic page publication, protected preview, homepage FAQ management, stale-write protection, safe public defaults, and a compact mobile admin drawer. Additive migration `0002_w32-content-cms`. Hosted migration was completed by the external lead; production is deferred to W6. See `docs/ARCHITECTURE.md` and `docs/CURRENT_STATE.md`.
- **W3.1 (Admin Foundation & Secure Owner Authentication): merged** via PR #4 (accepted PR HEAD `494fc037341772e6aec0592c076c748a78f0d9ac`, merge commit `09a63d3db6ef69ffecd238b408a733d7fdc53c07`). Self-hosted Better Auth, single owner, Neon/Drizzle auth schema, hardened sessions, rate limiting, provisioning/recovery CLI, protected Arabic-first admin shell. Production readiness not granted; hosted security verification remains W6.
- **W0 (Project Context & Repository Setup): merged** via PR #1 on `main` (base SHA `24171ba6805becc7a45fab51c6123b4248185080`).
- **W1 (Application Foundation & Brand Design System): merged.** Brand Kit v2.0 verified — archive SHA-256 `7c04840fc335daff52048f27b13ff3ac1e0159a3dc0d9299fbe8bf55b6931ff9`; canonical tokens committed as `src/styles/brand-tokens.css`.
- **W2 (Public Website): merged.** Seven public routes remain the CMS rendering target; layout, brand, CTA and pre-launch noindex policy are preserved.
- **W2-S (Marketing design): implemented.** The W2 visual layer is refined without changing the seven routes, CMS publication model, SEO defaults, pricing/join semantics or admin section count.

## Development

Requirements: Node.js 22 (`engines: >=22.0.0 <23`) and pnpm 10.34.6 (`packageManager` field + committed `pnpm-lock.yaml`).

```bash
pnpm install --frozen-lockfile
pnpm lint          # ESLint (flat config, next/core-web-vitals + typescript)
pnpm typecheck     # tsc --noEmit (strict)
pnpm test          # vitest unit tests (brand tokens, WCAG contrast, components)
pnpm build         # next build (production; required before e2e)
pnpm test:e2e      # Playwright tests (starts 3100 + intake-disabled 3200 servers)
pnpm verify        # lint + typecheck + test + build
pnpm test:db       # Better Auth integration tests against a disposable loopback PostgreSQL 18
pnpm db:generate   # Drizzle Kit: generate auth-schema migrations (no DB connection)
pnpm db:check      # Drizzle Kit: validate migration metadata
pnpm db:migrate    # validates DATABASE_URL_DIRECT, then applies migrations (never prod without approval)
pnpm owner:provision       # operator-only owner provisioning (interactive or stdin; never a web route)
pnpm owner:reset-password  # operator-only password recovery (rehash + session invalidation)
pnpm qa:cleanup-w4         # operator-only exact-ID QA join-request cleanup (dry-run unless --confirm)
pnpm dev:postgres  # start a disposable local PostgreSQL 18 for DB tests/e2e
```

`DATABASE_URL_DIRECT` is operator-only (migrations, owner provisioning/recovery). It must never be configured in Vercel or exposed to the deployed runtime; the runtime uses the pooled `DATABASE_URL` role. Least-privilege role SQL: `docs/DATABASE_PERMISSIONS.md`.

Early-access join intake is fail-closed behind `JOIN_INTAKE_ENABLED` (`1`/`true` only; missing/invalid keeps it disabled). Enabled intake also requires a valid `BETTER_AUTH_SECRET` (32+ chars) and valid exact `BETTER_AUTH_URL`/`TRUSTED_ORIGINS`; otherwise the API returns a controlled 503 and stores nothing, even for requests without `Origin`. W4 enables it only on the isolated development Preview for acceptance. `JOIN_RATE_LIMIT_MAX` and `NOKMEL_DISPOSABLE_TEST_ENV` are disposable-test-only and must never weaken a hosted environment. QA cleanup is operator-only by exact request IDs/marker per `docs/DATABASE_PERMISSIONS.md` §3d.

W5 integrations are optional and disabled by default. GA4 reporting uses server-only `GA4_PROPERTY_ID`, `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY`; public tracking additionally needs `GA4_MEASUREMENT_ID` and an explicit visitor consent. Owner notifications use the server-only `TELEGRAM_BOT_TOKEN` plus a numeric private chat destination saved in owner Settings. No credential belongs in `NEXT_PUBLIC_*`, public settings, client bundles or logs. Endpoint overrides are disposable-test-only. Exact external setup, property timezone, consent/conversion requirements and activation limits: `docs/W5_INTEGRATIONS.md`. Neither integration activates because a migration runs.

Integration/e2e databases are refused unless they are loopback, use an approved disposable database name, and explicitly set `sslmode=disable`. Without `TEST_DATABASE_URL` the integration harness starts its own temporary embedded PostgreSQL 18. Never point tests at a hosted Neon database.

Local e2e with the admin/intake suite (disposable DB only — synthetic identities):

```bash
pnpm dev:postgres &
pnpm build
DATABASE_URL=postgresql://nokmel_test:nokmel_test@127.0.0.1:55432/nokmel_test?sslmode=disable \
OWNER_EMAIL=owner@nokmel-e2e.test E2E_OWNER_PASSWORD=... \
RATE_LIMIT_SIGNIN_MAX=50 NOKMEL_DISPOSABLE_TEST_ENV=1 \
JOIN_INTAKE_ENABLED=1 JOIN_RATE_LIMIT_MAX=100 pnpm test:e2e
```

Playwright starts packaged servers: `3100` (admin fixture; intake enabled only when the admin e2e environment is configured), `3200` (deliberately intake-disabled coverage) and `3400` (tracking-enabled public fixture for reversible-consent tests), plus loopback GA4 and Telegram stubs on `3300`/`3301`. The W5 provider tests never call real Google or Telegram endpoints. `pnpm build` must run first. Without the admin environment, the admin/analytics specs skip and the public disabled-state coverage still runs.

CI (`.github/workflows/ci.yml`) runs the same checks on every PR to `main`, including the Playwright e2e suite.

## Structure

```
src/app/               # App Router: (public)/ W2 site, (auth)/admin/login, (admin)/admin shell, api/auth handler
src/styles/            # brand-tokens.css (canonical Brand Kit v2.0 tokens) + tokens.json/palette.json
src/components/ui/     # Button, TextLink, Card, Input, Textarea, Container, Section
src/components/brand/  # Logo (Completion Mark variants), Wordmark (temporary text)
src/components/layout/ # Header, Footer
src/i18n/              # locale config + ar messages (English-ready, no switcher yet)
src/lib/               # site config, brand/SEO, db/auth/owner, CMS, plan and join-intake services
src/lib/plans/         # plan model/currencies/validation, promotion resolver, owner/public DB service
src/lib/join/          # intake gate, join validation/phone, origin/identity, rate limit, request service
src/lib/overview/      # Cairo reporting ranges + owner request aggregates
src/lib/analytics/     # server-only GA4 config/adapter, consent/tracking contract
src/lib/notifications/ # Telegram adapter, message builder, durable notification state machine
src/lib/settings/      # typed site settings model, validation, public projection and owner service
src/content/           # Arabic default content + admin/public operational strings
src/content/cms/       # predefined page/section registry, editable fields, defaults, validation
public/brand/logos/    # Completion Mark SVG variants + PNG fallbacks (from kit, unmodified)
public/brand/social/   # Approved-design-system social-sharing candidate (1200 × 630)
public/brand/icons/    # favicon + app icons
licenses/fonts/        # OFL license notices for the self-hosted fonts
tests/e2e/ + tests/integration/  # Playwright specs + PostgreSQL-backed auth/CMS/plans/join/W5 integration specs
```
