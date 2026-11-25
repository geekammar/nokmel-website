Last updated: W3.1 (admin foundation & secure owner authentication), 2026-11-25. Keep concise.

## Status: W3.1 — draft PR on branch `vibe/w31-owner-auth-ff98b7` (awaiting review)

### W3.1 (this phase)
- Admin foundation implemented: self-hosted Better Auth (`better-auth@1.7.28`), email+password, single owner, public sign-up disabled server-side (`disableSignUp`), no social login, no anonymous/guest sessions, no roles.
- Owner-only authorization enforced server-side (`getOwnerSession`/`requireOwner`/`enforceOwnerForMutation` + `OWNER_EMAIL` normalization); missing config fails closed.
- Neon PostgreSQL + Drizzle: auth schema (user, session, account, verification, rate_limit) via Drizzle Kit migration `drizzle/0000_w31-auth-foundation.sql`; migrations never run at build/startup; pooled runtime connection (`DATABASE_URL`) vs direct migration connection (`DATABASE_URL_DIRECT`); TLS with certificate validation for hosted DBs.
- Sessions: 7-day expiry, daily refresh, HTTP-only SameSite=Lax cookies (Secure on HTTPS), server-side revocation enforced.
- Login rate limiting persisted in the `rate_limit` table (≈5 sign-in attempts/min with window expiry; no permanent lockout); Better Auth origin/CSRF checks kept; generic login errors; open-redirect protection.
- Routes: public website unchanged under `src/app/(public)/` (same 7 routes, layout, CTA, SEO, robots); new `/admin/login` (Arabic-first RTL) and protected `/admin` shell (honest structure: Overview available; Content & SEO, Plans & Pricing, Join Requests, Settings shown as unavailable; no fake data).
- Owner provisioning: operator CLI `pnpm owner:provision` (interactive hidden input or stdin; refuses second owner; idempotent; never mounted as HTTP handler) + `pnpm owner:reset-password` recovery (rehash + session invalidation).
- Tests: 24 DB integration tests (disposable PostgreSQL 18 locally via `pnpm dev:postgres` / CI service), auth config fail-closed unit tests, admin e2e suite (runs in CI where browser system deps exist; local browser e2e unavailable in this sandbox — no root for missing shared libraries).
- CI: added `db-integration` (postgres:18 service, `pnpm db:check` + `pnpm test:db`) and `e2e-auth` (postgres:18 + full Playwright) jobs on top of the existing `verify` job.

## Blockers / pending approvals

- W3.1 live acceptance is NOT done and must not be claimed: the external lead must configure the isolated development database (pooled + direct URLs), trusted origins for the preview URL, a unique `BETTER_AUTH_SECRET`, `OWNER_EMAIL`, and provision the owner with the documented CLI before independently verifying the protected preview. No production migration and no production owner creation happen in W3.1.
- Remaining release coverage carried over: physical Android acceptance and deployed SEO metadata verification (unverified from this environment; protected-preview inspection requires authorized Vercel access). A separate visual-polish workstream is planned and was not executed here.
- Do not start W3.2 (CMS) before independent review of W3.1.

### W2 snapshot (accepted baseline)

### PR #3 focused repair (deployed-QA fixes)
- **P0 (NKW-W2-001)**: `/join` returned HTTP 500 in the deployed runtime (`ENOENT ... src/styles/brand-tokens.css`). Root cause: the runtime dependency graph read source CSS via `node:fs` (`readTokens()` in `src/app/layout.tsx`). Fix: removed all runtime `node:fs` reads from application modules — layout now imports build-safe `src/lib/viewport-theme.ts` (static color, test-locked to the canonical CSS token value); token inspection moved to test-only tooling (`src/lib/__tests__/brand-tokens.testing.ts`); production-runtime e2e smoke (`next start`) covers all seven routes and all `/join?plan=` variations with zero 500s.
- **Homepage**: approved section order (hero → conceptual showcase → problems → capabilities → how-it-works → pricing → FAQ → final CTA); skeleton-style illustration replaced by an intentional 3-step conceptual workflow (Telegram message → organized order → single-place follow-up) with a single short conceptual caption; repeated white-card grids replaced by editorial rows / grouped current-vs-planned capability panels / numbered flow; tighter section rhythm.
- **Mobile header**: compact icon hamburger (44px target, `aria-expanded`/`aria-controls`), full-width panel under the sticky header, current-page indication (`aria-current`), close on selection/route-change/Escape/outside-click, focus restored on Escape; CTA single line (`whitespace-nowrap`); e2e asserts geometry at 320/360/390/430px.
- **Font-variable fallback (latent, found during repair)**: the built CSS ordered the canonical literal `--font-ar` after the `next/font` variable, so runtimes without the local font set showed collapsing text; `globals.css` now re-declares the font variables at `:root:root` with the canonical literals kept as middle fallbacks — verified by rendered-box e2e; canonical token file unchanged.

- W1 merged on `main` (PR #2). W2 rebased scope: reuse the W1 foundation unchanged (tokens, fonts, logo geometry, component contracts).
- All seven approved public routes implemented: `/`, `/features`, `/pricing`, `/join`, `/contact`, `/privacy`, `/terms`. No other routes.
- Header/footer: real public navigation (desktop links with current-page state, compact mobile menu), prominent `اطلب الانضمام` CTA → `/join` everywhere, skip link, `id="main-content"` target. No login links (no verified destination). No navigation framework added (`MobileMenu` is the only client component).
- CMS-ready content layer: typed, zod-validated content objects under `src/content/ar/` (home, features, pricing, join, contact, legal) + shared routes schema `src/content/schema.ts`; reusable sections under `src/components/sections/`. No page builder, no CMS/database work.
- W1 visual corrections implemented: centralized pre-launch indexing gate (`PRE_LAUNCH` in `src/lib/seo.ts` + `public/robots.txt` disallow — page-level noindex is NOT a permanent policy); responsive section spacing rhythm (`normal`/`compact`); Input/Textarea id contract now explicit `id` prop or `useId()` (never derived from `name`) with duplicate-name regression tests; dark-section foreground confirmed by computed-contrast e2e; sticky-header offset preserved via `scroll-padding-top`.
- Join page: W2 is a disabled preview (native disabled inputs + disabled submit, no data transmission, no success messages). Per the approved W2 closure decision, all `?plan=` query parameters are ignored and no selected-plan context is shown; no plan catalog exists yet. Submission/storage plus plan-context validation against the future plan catalog arrive in W4.
- Pricing page: honest early-access state only; no invented prices, plan names, entitlements, or discounts; commercial purchasing not enabled; CTA leads to `/join`.
- Contact page: renders only configured channels (empty by default — no invented contact details). Legal pages are clearly labeled drafts, not approved texts.
- Product claims: no testimonials, logos, metrics, or fabricated screenshots. The homepage showcase is an explicitly-labeled conceptual 3-step workflow, not a product screenshot. All capabilities are labelled `direction` / `planned` (`available` reserved, none used).
- SEO: per-page title/description/OpenGraph via `pageMetadata`, canonical URLs on the approved target domain `nokmel.tech` (never the protected deployment domain), semantic single `h1` per page. Site remains non-indexable pre-launch; indexing switch-on requires explicit launch approval (W6) and is a two-step documented action (`PRE_LAUNCH`, robots.txt).
- `engines.node` pinned to `>=22.0.0 <23` to match the approved Node.js 22 CI/runtime.
- Local verification after closure: install/lint/typecheck pass, `pnpm test` 47/47, `pnpm build` (7 routes), `pnpm test:e2e` 48/48 (adds repeated-identical plan variant, no-plan-context and no-reflected-script assertions, distinct header/footer nav landmark labels, robots.txt internal-path hygiene) (routes, all `/join?plan=` variations, production-runtime smoke, header geometry 320–430, menu behaviors, zero-overflow at 320/360/390/430/768/1024/1280/1440/1920, section order, dark AA contrast incl. badge, disabled submission, pre-launch metadata).
- Remote CI: see the W2 draft PR description for the exact run URL and result. Vercel preview of the final HEAD: see the same PR description.

## Blockers / pending approvals

- Deployed-preview acceptance by authorized Vercel access: local packaged-runtime smoke is green (7 routes + 8 plan variations = 200; zero runtime errors), but protected-preview content and Vercel runtime logs could not be inspected from this environment (302 → SSO; no credentials) — external authorized smoke still required.
- Headline/tagline and all marketing copy remain working proposals pending owner approval.
- Legal texts are labeled drafts requiring legal review before adoption.
- No contact details published (not yet determined by the owner).
- Do not start W3 before independent review of W2.
