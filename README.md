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

- **W3.1 (Admin Foundation & Secure Owner Authentication): implemented** on branch `vibe/w31-owner-auth-ff98b7` (draft PR). Self-hosted Better Auth (`better-auth@1.7.28`), single owner (email+password, public sign-up disabled server-side), Neon PostgreSQL + Drizzle auth schema/migrations, hardened sessions, DB-backed login rate limiting, owner provisioning CLI (`pnpm owner:provision`) and recovery (`pnpm owner:reset-password`), protected Arabic-first `/admin` shell. See `docs/ARCHITECTURE.md` (W3.1 section incl. infrastructure handoff) and `docs/CURRENT_STATE.md`.
- **W0 (Project Context & Repository Setup): merged** via PR #1 on `main` (base SHA `24171ba6805becc7a45fab51c6123b4248185080`).
- **W1 (Application Foundation & Brand Design System): implemented** on branch `vibe/w1-app-foundation-c7fe34` (draft PR). Brand Kit v2.0 verified in-environment — archive SHA-256 `7c04840fc335daff52048f27b13ff3ac1e0159a3dc0d9299fbe8bf55b6931ff9`; canonical tokens from `04_DESIGN_TOKENS/nokmel.css` committed as `src/styles/brand-tokens.css`. See `docs/DESIGN_SYSTEM.md` and `docs/CURRENT_STATE.md`.

## Development

Requirements: Node.js 22 (developed on v22.23.5; `engines: >=20.9.0`) and pnpm 10.34.6 (`packageManager` field + committed `pnpm-lock.yaml`).

```bash
pnpm install --frozen-lockfile
pnpm lint          # ESLint (flat config, next/core-web-vitals + typescript)
pnpm typecheck     # tsc --noEmit (strict)
pnpm test          # vitest unit tests (brand tokens, WCAG contrast, components)
pnpm build         # next build (production)
pnpm test:e2e      # Playwright browser tests at 320/360/390/768/1280/1440px
pnpm verify        # lint + typecheck + test + build
pnpm test:db       # Better Auth integration tests against a disposable PostgreSQL 18
pnpm db:generate   # Drizzle Kit: generate auth-schema migrations (DATABASE_URL_DIRECT)
pnpm db:check      # Drizzle Kit: validate migration metadata
pnpm db:migrate    # Drizzle Kit: apply migrations (DATABASE_URL_DIRECT — never prod without approval)
pnpm owner:provision       # operator-only owner provisioning (interactive or stdin; never a web route)
pnpm owner:reset-password  # operator-only password recovery (rehash + session invalidation)
pnpm dev:postgres  # start a disposable local PostgreSQL 18 for DB tests/e2e
```

Local e2e with the admin suite (disposable DB only — synthetic identities):

```bash
pnpm dev:postgres &
DATABASE_URL=... DATABASE_URL_DIRECT=... OWNER_EMAIL=owner@nokmel-e2e.test \
E2E_OWNER_PASSWORD=... pnpm test:e2e
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
src/lib/               # site config (Zod), brand token parser, WCAG contrast utils, db/auth/owner modules
public/brand/logos/    # Completion Mark SVG variants + PNG fallbacks (from kit, unmodified)
public/brand/icons/    # favicon + app icons
licenses/fonts/        # OFL license notices for the self-hosted fonts
tests/e2e/ + tests/integration/  # Playwright specs + PostgreSQL-backed auth integration specs
```
