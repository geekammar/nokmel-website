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

- **W3.3 (Page-level SEO & social metadata): implemented** on `feature/w33-seo-management` (draft PR pending independent acceptance). Owner-only Content & SEO tabs for all seven public pages: typed SEO title/description, optional social overrides, approved social-image selection, live search/social previews, draft/review/publish/discard on the existing page revision and atomic publication boundary. Public metadata reads published-only values with approved W2 fallbacks; canonical `nokmel.tech` URLs and pre-launch `noindex` remain. No migration; W3.2 data remains valid, and NKW-W32-005 FAQ final-order review is corrected. Production/indexing remain W6.
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
pnpm build         # next build (production)
pnpm test:e2e      # Playwright browser tests at 320/360/390/768/1280/1440px
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

Integration/e2e databases are refused unless they are loopback, use an approved disposable database name, and explicitly set `sslmode=disable`. Without `TEST_DATABASE_URL` the integration harness starts its own temporary embedded PostgreSQL 18. Never point tests at a hosted Neon database.

Local e2e with the admin suite (disposable DB only — synthetic identities):

```bash
pnpm dev:postgres &
DATABASE_URL=postgresql://nokmel_test:nokmel_test@127.0.0.1:55432/nokmel_test?sslmode=disable \
OWNER_EMAIL=owner@nokmel-e2e.test E2E_OWNER_PASSWORD=... \
RATE_LIMIT_SIGNIN_MAX=50 NOKMEL_DISPOSABLE_TEST_ENV=1 pnpm test:e2e
```

CI (`.github/workflows/ci.yml`) runs the same checks on every PR to `main`, including the Playwright e2e suite.

## Structure

```
src/app/               # App Router: (public)/ W2 site, (auth)/admin/login, (admin)/admin shell, api/auth handler
src/styles/            # brand-tokens.css (canonical Brand Kit v2.0 tokens) + tokens.json/palette.json
src/components/ui/     # Button, TextLink, Card, Input, Textarea, Container, Section
src/components/brand/  # Logo (Completion Mark variants), Wordmark (temporary text)
src/components/layout/ # Header, Footer
src/i18n/              # locale config + ar messages (English-ready, no switcher yet)
src/lib/               # site config, brand/SEO utils, db/auth/owner modules, CMS service
src/content/           # Arabic default content + admin strings
src/content/cms/       # predefined page/section registry, editable fields, defaults, validation
public/brand/logos/    # Completion Mark SVG variants + PNG fallbacks (from kit, unmodified)
public/brand/icons/    # favicon + app icons
licenses/fonts/        # OFL license notices for the self-hosted fonts
tests/e2e/ + tests/integration/  # Playwright specs + PostgreSQL-backed auth/CMS integration specs
```
