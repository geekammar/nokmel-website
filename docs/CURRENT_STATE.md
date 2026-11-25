# CURRENT_STATE.md — Nokmel Website

Last updated: W3.3 page-level SEO implementation, 2026-11-25. Keep concise.

## Status: W3.3 — page-level SEO and social metadata implemented on `feature/w33-seo-management` (draft PR pending; no production claim)

- W3.1 (PR #4) and W3.2 (PR #5) are merged and accepted for continued development. W3.2 merge baseline `main`: `5c976db56331ba2077b4a32c1e05a580e9c5689a` (accepted HEAD `fb677dabc82f2c60a6301d862314142805fba0f8`).
- W3.3 adds owner-only page-level SEO/social metadata editing to the existing Content & SEO section for all seven public pages. No plans/pricing admin, join submission/storage (W4), analytics/settings (W5), indexing activation or launch work was implemented.
- Production readiness is **not** granted. Production branch, Production deployment, DNS, credentials, QA account/password/sessions, historical deployments and existing environment variables are untouched. Production activation and all W6 gates remain outstanding; physical Android acceptance is deferred.

### W3.3 implemented scope

- SEO stored as a predefined typed `content_sections` row (`section_key='seo'`, id `<page>:seo:ar`) with the same draft/published JSONB, page revision, advisory lock and owner-only actions as W3.2. **No migration, seed or new database grant is required**; existing W3.2 rows without SEO remain valid. Content composition skips the SEO row.
- Fields: required title (hard limit 200) and meta description (500), optional social title/description and approved image id. Strict Zod schemas reject unknown fields, arbitrary URLs/unsafe ids; whitespace-only optional values normalize to unset. Editorial length guidance is non-blocking. Fallbacks: missing published override → approved W2 defaults; missing social title/description → effective SEO values; missing image → approved default.
- Saving SEO preserves content/FAQ drafts; saving content/FAQ preserves SEO drafts. Page revision remains one page-level counter including the SEO row. Publication validates the complete page and atomically applies content + SEO + homepage FAQ; discard clears all saved drafts; stale save/review protection is unchanged. Publication review shows section, FAQ and SEO before/after changes plus inherited-social notes.
- Public routes (`/`, `/features`, `/pricing`, `/join`, `/contact`, `/privacy`, `/terms`) generate metadata from published-only SEO via one request-scoped published bundle (published sections/SEO + homepage FAQ in a read-only repeatable-read snapshot). Open Graph/Twitter values use the effective social fields; canonical `nokmel.tech` URLs, `noindex, nofollow`, admin/preview non-indexability and `robots.txt Disallow: /` are unchanged. Drafts are never selected on public paths; failures fall back to approved defaults.
- Approved social images use an explicit registry of existing PNG brand assets (transparent marks 1024/512, light/dark app icons 512) with real dimensions/alt text; no upload/media library/external fetch/arbitrary URL. No new artwork was invented.
- NKW-W32-005 corrected in publication review: added FAQ items show one-based intended positions, removals show published positions, hidden items are separated, and the final visible public order is displayed when additions/removals/visibility/reordering affect it. Computed from existing persisted state; no FAQ schema change.

### W3.3 verification (local, 2026-11-25)

- Unit: 136/136 (adds SEO schema/defaults/metadata/asset and FAQ final-order review tests).
- PostgreSQL integration: 104/104 on disposable loopback PostgreSQL 18 (87 W3.2 + 17 SEO: defaults, W3.2 compatibility, draft/publish, inheritance, content/SEO/FAQ coexistence, atomic publication, stale save/review, discard, invalid-data/DB fallbacks, published-only privilege probe, publication interleaving).
- Playwright: 92/92 with synthetic owner + disposable DB (86 existing + 6 W3.3 workflows; includes full SEO draft/reload/review/publish head verification, combined stale review, all-route default metadata, NKW-W32-005 final order at 390px, 320–1440 responsive SEO editor). Screenshots: `w33-seo-editor-390/1440`, `w33-faq-final-order-review-390` under CI artifacts.
- `pnpm lint` (0 errors; 3 pre-existing warnings), `pnpm typecheck`, `pnpm build` and `pnpm db:check` pass locally on Node 22. Exact remote CI and Preview identity are recorded in the draft PR/handoff and must be checked on the exact final HEAD.
- No schema migration: `drizzle/0000`–`0002` untouched; no hosted Neon access, no Vercel configuration, no production action. W3.3 branch Preview requires its own `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `OWNER_EMAIL`.

## W3.2 historical state (merged and accepted for continued development)

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

### W3.2 final acceptance closure (2026-11-25)

- Independent Muse acceptance returned CONDITIONAL ACCEPT for the configured Preview only: 52 cases, 48 PASS, 0 FAIL, 3 BLOCKED, 1 NOT TESTED; desktop CMS workflow and FAQ 10/10 passed, all seven editors passed, stale save/discard rejected, stale publish not completed, mobile viewport coverage blocked by Muse tooling.
- NKW-W32-001 confirmed publication-UX issue: page-level publication intentionally includes homepage FAQ, but the old two-step confirmation did not show pending FAQ/draft changes beyond the current editor baseline. The publication flow now generates an owner-only server-side review from the persisted draft versus effective published/default content in one consistent snapshot, shows changed section fields and FAQ add/remove/edit/visibility/order changes, and binds confirmation to the reviewed saved-draft revision. Stale confirmation is rejected by the existing advisory lock + revision check with no public change.
- Content-source investigation: the repository has a single homepage FAQ default source (`src/content/ar/home.ts`) and a single `faq_items` store; public/editor/preview all consume the composed content (FaqSection receives passed items). Join fields have one code-controlled source and are not CMS-editable. The five long hosted FAQ answers do not appear anywhere in git history, so they originated from hosted CMS data rather than code defaults. Empty-database and published-override parity tests pass; changing only the tagline preserves published FAQ exactly. The exact historical hosted draft/build state at the first Muse publication cannot be reconstructed from the repository; no duplicate-source/fallback bug was reproduced. The reproducible code-level mechanism is pre-existing draft FAQ changes being included in full-page publication, which the review now exposes.
- Editor status now distinguishes the current editing-state revision from the last published revision/timestamp; a higher editing revision does not imply a new public publication. Revisions are not renumbered or reset.
- Verification: unit 113/113; PostgreSQL integration 87/87 (adds effective-default parity, published FAQ/section preservation, persisted-draft review, first-publication/default comparison, no-change review, stale review, join structure); Playwright 86/86 (adds publication review cancel/stale-confirmation browser workflow and review layout at 320/390/430/768/1440). Final CI is checked on the exact final HEAD.
- External report: hosted Neon development has migrations 0000/0001/0002, CMS tables/runtime grants configured, temporary migrator CREATE revoked, W3.2 Preview variables configured, QA owner/credentials unchanged. The external lead reports no remaining section drafts, homepage published revision 11/current editing revision 13, eight published home sections and six visible published FAQ items. These are external observations, not coding-agent hosted access.
- Remaining: independent hosted retest after this closure, official mobile acceptance (Playwright is supplementary; no physical Android claim), W3.1 hosted closure checks and W6 launch gates. Production remains unconfigured/protected and not claimed ready.

### Verification (local)

- Unit tests: 113/113 passing (101 existing + 12 CMS registry/rendering/fallback).
- PostgreSQL integration: 87/87 passing on disposable PostgreSQL 18 (auth 50 + CMS 37: migration upgrade preserving auth data, draft/privacy, atomic publication, failed-publication rollback, discard, stale write/publication/discard, concurrent writers, FAQ lifecycle, consistent-snapshot interleaving for public/editor/preview, published-only column projection, publication review/revision binding, default/published parity, fallback safety, runtime-role DML/DDL refusal).
- Playwright: 86/86 passing with synthetic owner + disposable DB (existing public/auth/login suites + W3.2 navigation, homepage draft/preview/publish/discard, FAQ, per-page editing, 320–1440 responsiveness, field validation, anonymous/non-owner protection).
- `pnpm db:check`, lint (0 errors; 3 pre-existing warnings), typecheck and production build pass. Exact remote CI URL and Preview identity are recorded in the draft PR/handoff; they must be checked on the exact final HEAD.

### W3.2 infrastructure handoff (external operator; not performed here)

- W3.2 migration 0002 is reported applied on hosted development Neon by the external lead; CMS runtime grants configured and temporary migrator database-level CREATE revoked. QA owner/credentials/sessions unchanged. If a future migration is required, the temporary grant/revoke procedure in `docs/DATABASE_PERMISSIONS.md` still applies; never expose `DATABASE_URL_DIRECT` to Vercel.
- W3.2 branch Preview variables are reported configured by the external lead. Authorized branch origin: `https://nokmel-website-git-feature-w32-content-fa5a4c-ammarjaberd-7111.vercel.app`; configured acceptance deployment `dpl_DwwbRVL5Lse1VnaWU5eKRyYkC28C`. A READY deployment alone is not CMS acceptance.
- Do not rotate QA credentials, revoke QA sessions, reset the QA account, delete deployments, modify Production, or run hosted password recovery during W3.2.

### Outstanding live checks (must not be claimed as done)

- W3.3 branch-specific Vercel Preview variables and authorized Preview origin (external operator); independent hosted retest of SEO draft/publish, actual head metadata on all seven routes, canonical/noindex preservation, combined stale review, and NKW-W32-005 final order. W3.2 Preview settings are not assumed to inherit.
- Independent hosted retest of this closure on the configured W3.2 Preview: publication review, published FAQ/unchanged-section preservation, stale publish rejection, mobile review layout.
- Official mobile acceptance for the review UI (Playwright evidence is supplementary; no physical Android claim). Hosted mobile viewport coverage was blocked by Muse tooling.
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
