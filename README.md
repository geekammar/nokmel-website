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
- [Security](docs/SECURITY.md) — controls, W6 findings register and residual risks
- [W6 Launch Readiness](docs/W6_LAUNCH_READINESS.md) — production isolation, indexing release control and launch gates

## Working copy (subject to owner approval)

- Marketing headline: متجرك في المحادثة. وإدارة طلباتك في مكان واحد.
- Brand tagline: خلي بزنسك يكمل.
- Primary CTA: Request to Join (اطلب الانضمام)

## Status

- **W2-V (Product-led visual design & mobile-first homepage): MERGED & ACCEPTED.** Delivered via PR #11 (merge commit `53157b9e79f93cea2d9cd922072e8a49d2ce393f`; accepted W2-V HEAD `b88704b604ff253b7ac63e4bf5b20e4bf7f24f73`; accepted CI run `46042089986`). The external lead accepted the final visual implementation. The recorded Muse review at `b31e6e8` reported 14 PASS, 1 PARTIAL, 0 FAIL (the PARTIAL was unavailable live mobile viewport emulation); the subsequent mobile visual-balance refinement at `b88704b` was followed by owner physical Android visual acceptance 7/7 on 2026-11-27. The homepage uses the approved static Telegram/merchant composition, four CMS-backed benefits, three-step onboarding, early-access callout, FAQ and final CTA. Hosted Development homepage published revision 55 has the product visual enabled; no pending CMS drafts were reported. No migration.
- **W6 (Launch readiness): ENGINEERING DELIVERY on `feature/w6-launch-readiness`.** Security findings review, owner-auth/recovery verification, launch indexing controls, release identity in protected Settings, approved default social card, fresh-database/least-privilege verification and production activation/acceptance handoffs. No merge, no Production deployment, no hosted mutation, no indexing/analytics/Telegram activation. Engineering readiness is not Production approval.
- **W5 (Business overview, external analytics, owner notifications & settings): MERGED & ACCEPTED** via PR #9. Accepted HEAD `5fceb8e97036dfc9c2aa6ec33a03921442257295`; merge commit `4f32b94ac6943f61e96f58014672d25eaa37968e`. Owner-supplied independent acceptance reports 20/20 PASS and the authorized QA cleanup completed. Additive migration `0005_w5-settings-notifications` adds `site_settings` and nullable notification columns. GA4 and Telegram remain disabled/unconfigured.
- **W4.1 (Scheduled promotional pricing & historical offer integrity): MERGED & ACCEPTED** via PR #8 (accepted HEAD `7d33ab734cc84cb51f17d67aa972390559c71e86`, merge commit `d50f7d555859b5f0ee4dc5b7075127f9e02eafde`; independent live acceptance 18/18). Additive migration `0004_w41-scheduled-promotional-pricing` is applied on hosted Development. FAQ Q6 preserved.
- **W4 (Marketing plans, pricing & early-access join requests): merged/accepted for continued development** via the W4 merge baseline. Owner-only Plans & Pricing, public pricing cards, fail-closed join intake with rate limiting/idempotency/historical snapshots, and owner Join Requests. Additive migration `0003_w4-plans-join-requests` is applied on hosted Development. Production intake remains a W6 launch gate.
- **W3.3 (Page-level SEO & social metadata): merged** via PR #6 (accepted HEAD `dcf1f8d9ede739a29bd48d036df1a1d5cd9f28bf`, merge commit `0020ddacdd54b3c23471b58b17b54fda1c1a0ae1`). No migration.
- **W3.2 (Lightweight CMS, content publishing & mobile admin navigation): merged** via PR #5 (accepted HEAD `fb677dabc82f2c60a6301d862314142805fba0f8`). Owner-only Content & SEO with predefined editors, drafts, atomic publication, protected preview and mobile admin navigation. Additive migration `0002_w32-content-cms`; applied on hosted Development.
- **W3.1 (Admin foundation & secure owner authentication): merged** via PR #4 (accepted PR HEAD `494fc037341772e6aec0592c076c748a78f0d9ac`, merge commit `09a63d3db6ef69ffecd238b408a733d7fdc53c07`). Self-hosted Better Auth, single owner, hardened sessions/rate limiting, operator provisioning/recovery and protected admin shell. Hosted security/recovery checks remain W6 external gates.
- **W2-S (Marketing design): MERGED & ACCEPTED** via PR #10 (merge commit `f1aeb5c04ee6660d149d492bf2bb5c2d7f3704d7`; accepted HEAD `dd71987cce35e3cf1981e42f87b638e3bcdbbdc3`).
- **W0/W1/W2:** merged foundations, Brand Kit v2.0 tokens and the seven public routes.

Hosted Development state (external record): migrations `0000`–`0005` applied; homepage published revision 55 with product visual enabled; no pending CMS drafts; no successful QA requests; two synthetic plans remain hidden; GA4 and Telegram are disabled and unconfigured. Production is not configured or accepted.

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

Early-access join intake is fail-closed behind `JOIN_INTAKE_ENABLED` (`1`/`true` only; missing/invalid keeps it disabled). Enabled intake also requires a valid `BETTER_AUTH_SECRET` (32+ chars) and valid exact `BETTER_AUTH_URL`/`TRUSTED_ORIGINS`; otherwise the API returns a controlled 503 and stores nothing, even for requests without `Origin`. Production intake remains disabled until explicit owner approval. `JOIN_RATE_LIMIT_MAX` and `NOKMEL_DISPOSABLE_TEST_ENV` are disposable-test-only and must never weaken a hosted environment. QA cleanup is operator-only by exact request IDs/marker per `docs/DATABASE_PERMISSIONS.md` §3d.

Public indexing is disabled by default. `SITE_INDEXING_ENABLED` is a runtime-only launch flag; it is effective only outside Vercel Preview/development deployments, and `/admin` stays `noindex, nofollow` regardless. Do not set it until the owner-authorized launch step in `docs/W6_LAUNCH_READINESS.md`. Protected Settings shows read-only application version, Git commit SHA, environment and deployment identifier from trusted build/runtime metadata (or an honest unavailable state).

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
src/components/marketing/ # Product-led homepage, static product visual and benefits
src/components/marketing/product-visual/ # Shared demo data and noninteractive Telegram/merchant preview
src/i18n/              # locale config + ar messages (English-ready, no switcher yet)
src/lib/               # site config, brand/SEO, db/auth/owner, CMS, plan and join-intake services
src/lib/localization/  # Market context boundary + Intl minor-unit money formatter
src/lib/plans/         # plan model/currencies/validation, promotion resolver, owner/public DB service
src/lib/join/          # intake gate, join validation/phone, origin/identity, rate limit, request service
src/lib/overview/      # Cairo reporting ranges + owner request aggregates
src/lib/analytics/     # server-only GA4 config/adapter, consent/tracking contract
src/lib/notifications/ # Telegram adapter, message builder, durable notification state machine
src/lib/settings/      # typed site settings model, validation, public projection and owner service
src/content/           # Arabic default content + admin/public operational strings
src/content/cms/       # predefined page/section registry, editable fields, defaults, validation
public/brand/logos/    # Completion Mark SVG variants + PNG fallbacks (from kit, unmodified)
public/brand/social/   # Approved default social-sharing card (1200 × 630)
public/brand/icons/    # favicon + app icons
public/marketing/demo/ # Local AVIF/WebP product illustration for the homepage visual
licenses/fonts/        # OFL license notices for the self-hosted fonts
tests/e2e/ + tests/integration/  # Playwright specs + PostgreSQL-backed auth/CMS/plans/join/W5 integration specs
```
