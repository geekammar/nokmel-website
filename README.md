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

## Working copy (subject to owner approval)

- Marketing headline: متجرك في المحادثة. وبزنسك في مكان واحد.
- Brand tagline: خلي بزنسك يكمل.
- Primary CTA: Request to Join (اطلب الانضمام)

## Status

- **W4 (Marketing plans, pricing & early-access join requests): implemented** on `feature/w4-plans-join-requests` (draft PR; external acceptance pending). Owner-only Plans & Pricing with draft/publish/hide lifecycle, exact minor-unit monthly/yearly prices (or an explicit unpriced state), accessible feature/order editing, owner preview, public pricing cards, `/join?plan=<slug>` preselection, and a fail-closed (`JOIN_INTAKE_ENABLED`) durable join-request intake with rate limiting, idempotency and historical offer snapshots. Owner-only Join Requests includes filters, bounded pagination, search, status and internal notes. Additive migration `0003_w4-plans-join-requests`; hosted activation, Production intake, privacy/retention approval and all W6 launch gates remain external.
- **W3.3 (Page-level SEO & social metadata): merged** via PR #6 (accepted HEAD `dcf1f8d9ede739a29bd48d036df1a1d5cd9f28bf`, merge commit `0020ddacdd54b3c23471b58b17b54fda1c1a0ae1`). No migration.
- **W3.2 (Lightweight CMS, content publishing & mobile admin navigation): merged** via PR #5 (accepted HEAD `fb677dabc82f2c60a6301d862314142805fba0f8`). Owner-only Content & SEO section with predefined page editors, validated drafts, atomic page publication, protected preview, homepage FAQ management, stale-write protection, safe public defaults, and a compact mobile admin drawer. Additive migration `0002_w32-content-cms`. Hosted migration was completed by the external lead; production is deferred to W6. See `docs/ARCHITECTURE.md` and `docs/CURRENT_STATE.md`.
- **W3.1 (Admin Foundation & Secure Owner Authentication): merged** via PR #4 (accepted PR HEAD `494fc037341772e6aec0592c076c748a78f0d9ac`, merge commit `09a63d3db6ef69ffecd238b408a733d7fdc53c07`). Self-hosted Better Auth, single owner, Neon/Drizzle auth schema, hardened sessions, rate limiting, provisioning/recovery CLI, protected Arabic-first admin shell. Production readiness not granted; hosted security verification remains W6.
- **W0 (Project Context & Repository Setup): merged** via PR #1 on `main` (base SHA `24171ba6805becc7a45fab51c6123b4248185080`).
- **W1 (Application Foundation & Brand Design System): merged.** Brand Kit v2.0 verified — archive SHA-256 `7c04840fc335daff52048f27b13ff3ac1e0159a3dc0d9299fbe8bf55b6931ff9`; canonical tokens committed as `src/styles/brand-tokens.css`.
- **W2 (Public Website): merged.** Seven public routes remain the CMS rendering target; layout, brand, CTA and pre-launch noindex policy are preserved.

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
pnpm dev:postgres  # start a disposable local PostgreSQL 18 for DB tests/e2e
```

`DATABASE_URL_DIRECT` is operator-only (migrations, owner provisioning/recovery). It must never be configured in Vercel or exposed to the deployed runtime; the runtime uses the pooled `DATABASE_URL` role. Least-privilege role SQL: `docs/DATABASE_PERMISSIONS.md`.

Early-access join intake is fail-closed behind `JOIN_INTAKE_ENABLED` (`1`/`true` only; missing/invalid keeps it disabled). W4 enables it only on the isolated development Preview for acceptance. `JOIN_RATE_LIMIT_MAX` and `NOKMEL_DISPOSABLE_TEST_ENV` are disposable-test-only and must never weaken a hosted environment.

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

Playwright starts two packaged servers: `3100` (admin fixture; intake enabled only when the admin e2e environment is configured) and `3200` (deliberately intake-disabled coverage). `pnpm build` must run first. Without the admin environment, the admin/intake specs skip and the public disabled-state coverage still runs.

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
src/lib/plans/         # plan model/currencies/validation + owner/public DB service
src/lib/join/          # intake gate, join validation/phone, origin/identity, rate limit, request service
src/content/           # Arabic default content + admin/public operational strings
src/content/cms/       # predefined page/section registry, editable fields, defaults, validation
public/brand/logos/    # Completion Mark SVG variants + PNG fallbacks (from kit, unmodified)
public/brand/icons/    # favicon + app icons
licenses/fonts/        # OFL license notices for the self-hosted fonts
tests/e2e/ + tests/integration/  # Playwright specs + PostgreSQL-backed auth/CMS/plans/join integration specs
```
