Last updated: W3.1 final acceptance closure, 2026-11-25. Keep concise.

## Status: W3.1 — final acceptance closure delivered on draft PR #4 (`vibe/w31-owner-auth-ff98b7`)

### W3.1 final acceptance closure (2026-11-25)

- Live infrastructure configured by the external lead: Neon project `nokmel-website` (`delicate-cake-38544235`), development branch `br-winter-hat-bdqgatki`, database `nokmel_website`; roles `nokmel_migrator` and `nokmel_runtime`; two migrations applied (`0000_w31-auth-foundation`, `0001_parallel_skin`); QA owner provisioned. Runtime uses the restricted role and has no database/schema CREATE. The migrator's database-level CREATE was revoked after migration; the pinned migration tool requires a temporary re-grant for any future migration (documented in `docs/DATABASE_PERMISSIONS.md`); it retains `public`/`drizzle` schema privileges.
- Preview runtime variables configured for the existing PR Preview only (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `OWNER_EMAIL`); `DATABASE_URL_DIRECT` is not in Vercel.
- Configured/accepted Preview: `dpl_Gs4fzWGwMGcPjkLxcTbECp33HWRn`, immutable URL `https://nokmel-website-96pnuvu12-ammarjaberd-7111.vercel.app`, authorized origin `https://nokmel-website-git-vibe-w31-owner-auth-ff98b7-ammarjaberd-7111.vercel.app`. The earlier `dpl_FNtx2FMXi8MHAo2NEfz4a5EkG27q` was the same HEAD but built before database/auth configuration; different deployment identity is not a functional defect.
- Acceptance evidence: physical Android functional checks 7/7 PASS (owner-reported); independent Muse desktop acceptance 35 cases (23 PASS, 2 PARTIAL, 2 FAIL, 6 BLOCKED, 2 NOT TESTED), CONDITIONAL ACCEPT for Preview only. Live authenticated Preview retesting is still required after this closure.
- NKW-W31-REC-01 resolved: credential sign-in and owner provisioning/recovery share a database advisory lock (`nokmel.website.owner_credentials`); the sign-in route holds it around the whole Better Auth handler on a dedicated DB connection. Recovery waits for in-flight session creation, then replaces the hash and deletes all sessions in the same transaction. Deterministic PostgreSQL tests include an unlocked control reproducing the original race and a guarded-route proof that no usable old-password session survives.
- NKW-W31-UX-01 resolved: compact eye/eye-off icon (44px target, Arabic accessible name, `aria-pressed`) in an LTR wrapper; Arabic label stays RTL, password content LTR, reserved padding/positioning consistent, value/keyboard/focus/autocomplete preserved.
- NKW-W31-UX-02/03 resolved: Overview no longer duplicates navigation or shows `W3.1`; compact honest empty state, existing navigation availability retained, minimal spacing only; no navigation redesign.
- NKW-W31-S05-01 resolved: login captures the real `X-Retry-After` response header via the Better Auth client response hook and shows an approximate countdown, with a conservative 60-second fallback; submit is blocked during cooldown; server remains authoritative; no permanent lockout.
- Coverage closure: separate browser contexts, server-side HTTP sign-up refusal, cookie attributes, untrusted Origin, unsafe callback URL, request-identity evidence separation, and production-mode noindex/canonical checks for all seven public routes. Physical Android remains owner-reported evidence, not emulated.
- Verification (local Node.js 22.23.5, disposable PostgreSQL 18): lint 0 errors (3 pre-existing warnings), typecheck pass, unit 101/101, DB integration 50/50, production build pass, full Playwright 73/73 (public + admin + login UX + security closure). Final CI run and exact URLs are recorded in the PR #4 description/report; all three existing CI jobs are retained.

## Outstanding live checks (must not be claimed as done)

- Authorized live retest of the configured Preview after this closure (sign-in, recovery behavior, password visibility, simplified Overview, rate-limit UX).
- Hosted runtime verification that the transaction-scoped sign-in/recovery lock behaves correctly through Neon's pooled endpoint (local evidence uses a direct disposable PostgreSQL 18; the lock transaction is designed for PgBouncer transaction pooling and requires live confirmation).
- Hosted Vercel request-header inspection for rate-limit identity (Preview remains behind Vercel SSO; no public debug endpoint is provided).
- Immutable deployment URL/ID record from the Vercel dashboard if required; the PR integration exposes the configured Preview alias and inspector ID.
- If an external proxy is placed in front of Vercel, re-evaluate the `x-forwarded-for` trust decision.

## Blockers / pending approvals

- Do not start W3.2 (CMS) before independent review of this closure. No merge or production deployment has been performed.
- Public copy and legal texts remain working proposals/drafts; pre-launch noindex/robots policy is unchanged.

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
