# CURRENT_STATE.md — Nokmel Website

Last updated: W3.2 focused published-content consistency closure, 2026-11-25. Keep concise.

## Status: W3.2 — lightweight CMS implemented on `feature/w32-content-management` (draft PR, not merged; no production claim)

- W3.1 (PR #4) is merged and accepted for continued development. `main` baseline: `09a63d3db6ef69ffecd238b408a733d7fdc53c07` (accepted PR HEAD `494fc037341772e6aec0592c076c748a78f0d9ac`).
- W3.2 adds the owner-only Content & SEO section for the seven existing public pages plus homepage FAQ. No SEO metadata editing (W3.3), plans (W4), join-request submission/storage (W4), analytics, contact-channel configuration or settings (W5) were implemented.
- Production readiness is **not** granted. Production branch, Production deployment, DNS, credentials, QA account/password/sessions, historical deployments and existing environment variables are untouched. Production activation remains W6.

### W3.2 implemented scope

- Predefined content registry and typed validation for all approved pages/sections (`src/content/cms/registry.ts`). Editable copy only; CTA destinations, capability statuses/groups, join-form structure, contact channels, legal draft banner, section counts and route paths remain code-controlled. No image field exists in the current website, so no image selector/uploads/media library were added.
- Server-side CMS service with separate draft/published JSONB payloads, page-level atomic publication, discard, stale-write revision checks, page-scoped PostgreSQL advisory locks, and stable FAQ identity/order/visibility.
- Owner-authorized editor at `/admin/content` and `/admin/content/[pageKey]`; protected preview at `/admin/content/[pageKey]/preview` using the same public page views. Anonymous and non-owner access is rejected server-side; every server action re-checks the owner session.
- Public pages render published content only and fall back to approved defaults when `DATABASE_URL` is absent, CMS tables are not migrated, no published record exists, stored data is invalid, or the database is temporarily unavailable. Drafts are never exposed publicly. Public routes keep paths, header/footer, layout and pre-launch noindex/robots behavior.
- Public pages are dynamic: at most one section query plus one FAQ query per request, no cross-request content cache. A publication is visible on the next public request without a deployment; failure fallbacks are not cached indefinitely.
- Compact mobile admin navigation: closed-by-default disclosure panel, 44px controls, active section, Escape/focus restoration, outside-click and navigation close; desktop sidebar preserved. Overview remains a simple honest empty state. Future sections remain non-interactive with concise labels.
- Additive migration `drizzle/0002_w32-content-cms.sql` (`content_sections`, `faq_items`, indexes/checks). It upgrades a W3.1 schema with existing synthetic auth records unchanged; no sequences, no changes to old migrations.

### W3.2 focused consistency closure (2026-11-25)

- Public homepage, owner editor and protected preview now perform their related section+FAQ reads in one short read-only PostgreSQL `REPEATABLE READ` transaction. A publication/draft save committing between the two statements cannot produce mixed content or mixed revision/FAQ state. No write/advisory lock, session state, long transaction or cache service is used.
- Public reads use published-only projections: sections select only `section_key`/`published_payload`; FAQ selects only published question/answer/order/visibility, ordered by published order. Draft payloads/revisions/answers/visibility/order are never selected by public paths. Full draft rows remain restricted to editor/preview/mutations.
- Existing fallback/invalid-data behavior is unchanged. No schema change was needed; `0002_w32-content-cms` is unchanged and no new migration was added.
- Deterministic integration tests commit a publication or draft save between the two logical reads via a test-only synchronization seam (no sleeps), and a temporary column-privilege role proves public reads work without access to draft columns.

### Verification (local)

- Unit tests: 113/113 passing (101 existing + 12 CMS registry/rendering/fallback).
- PostgreSQL integration: 78/78 passing on disposable PostgreSQL 18 (auth 50 + CMS 28: migration upgrade preserving auth data, draft/privacy, atomic publication, failed-publication rollback, discard, stale write/publication/discard, concurrent writers, FAQ lifecycle, consistent-snapshot interleaving for public/editor/preview, published-only column projection, fallback safety, runtime-role DML/DDL refusal).
- Playwright: 84/84 passing with synthetic owner + disposable DB (existing public/auth/login suites + W3.2 navigation, homepage draft/preview/publish/discard, FAQ, per-page editing, 320–1440 responsiveness, field validation, anonymous/non-owner protection).
- `pnpm db:check`, lint (0 errors; 3 pre-existing warnings), typecheck and production build pass. Exact remote CI URL and Preview identity are recorded in the draft PR/handoff; they must be checked on the exact final HEAD.

### W3.2 infrastructure handoff (external operator; not performed here)

- W3.2 migration has **not** been applied to hosted Neon. Required: `pnpm db:check`, temporary `GRANT CREATE ON DATABASE nokmel_website TO nokmel_migrator`, `DATABASE_URL_DIRECT=<direct migrator URL> pnpm db:migrate`, verification, then immediate `REVOKE CREATE ON DATABASE ... FROM nokmel_migrator`, followed by runtime grants in `docs/DATABASE_PERMISSIONS.md`. Never expose `DATABASE_URL_DIRECT` to Vercel; never use the pooled URL for migrations.
- Existing Vercel variables are scoped to the W3.1 preview branch. The new W3.2 branch Preview requires its own/explicit `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS` (exact alias) and `OWNER_EMAIL` configuration before live acceptance. A READY deployment alone is not CMS acceptance.
- Do not rotate QA credentials, revoke QA sessions, reset the QA account, delete deployments, modify Production, or run hosted password recovery during W3.2.

### Outstanding live checks (must not be claimed as done)

- Apply and verify the W3.2 migration on the hosted development database, then apply least-privilege CMS grants.
- Configure and independently accept the W3.2 Preview branch (authentication + persistence + public publication).
- Authorized live retest of W3.1 closure items retained from the prior state (sign-in/recovery lock through Neon's pooled endpoint, hosted request headers, password visibility, Overview, rate-limit UX).
- W6 launch gates: hosted recovery-lock/pooler verification, historical deployment isolation, hosted request-header evidence, hosted cookie/origin/session evidence, deployed noindex/canonical verification, production migration and owner provisioning.
- Public copy and legal texts remain working drafts; legal review and headline/tagline approval remain pending. No contact channels or join submission were enabled.

## W3.1 historical state (merged and accepted for development)

- Authentication: self-hosted Better Auth 1.7.28, single owner, public sign-up disabled server-side, DB-backed rate limiting, provisioning/recovery CLI, transactional shared credential advisory lock resolving NKW-W31-REC-01.
- Live infrastructure configured externally: Neon project `nokmel-website` (`delicate-cake-38544235`), development branch `br-winter-hat-bdqgatki`, database `nokmel_website`, roles `nokmel_migrator`/`nokmel_runtime`, migrations `0000`/`0001`, QA owner provisioned. Production branch untouched.
- Configured/accepted W3.1 Preview: `dpl_Gs4fzWGwMGcPjkLxcTbECp33HWRn`, immutable URL `https://nokmel-website-96pnuvu12-ammarjaberd-7111.vercel.app`, authorized origin `https://nokmel-website-git-vibe-w31-owner-auth-ff98b7-ammarjaberd-7111.vercel.app`. Physical Android 7/7 PASS (owner-reported); Muse desktop CONDITIONAL ACCEPT for Preview.
- Verification at W3.1 closure: lint/typecheck, unit 101/101, DB integration 50/50, build, Playwright 73/73. W3.2 retains these suites and adds CMS coverage.

## W2 baseline (accepted)

- Seven public routes `/`, `/features`, `/pricing`, `/join`, `/contact`, `/privacy`, `/terms`; RTL-first, mobile-first, prominent `/join` CTA, real public navigation, disabled join preview, honest early-access pricing/contact/legal drafts.
- Pre-launch noindex and robots disallow remain active; canonical URLs target `nokmel.tech`; public indexing requires explicit W6 launch approval (two-step documented action).
- Brand tokens/fonts and approved layout remain unchanged; W3.2 only replaces static page-content imports with the published-content loader and shared page views.
