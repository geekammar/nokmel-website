# CURRENT_STATE.md — Nokmel Website

Last updated: W4 implementation, 2026-11-26. Keep concise.

## Status: W4 — marketing plans, pricing and early-access join requests implemented on `feature/w4-plans-join-requests` (draft PR; external acceptance pending; no production claim)

- Baseline: merged `main` `0020ddacdd54b3c23471b58b17b54fda1c1a0ae1` (W3.3 PR #6, accepted HEAD `dcf1f8d9ede739a29bd48d036df1a1d5cd9f28bf`). W3.1/W3.2/W3.3 behavior is preserved.
- W4 activates the existing **الباقات والأسعار** and **طلبات الانضمام** admin sections. Settings remains unavailable until W5; no CRM, billing, checkout, subscriptions, merchant accounts, notifications, analytics provider or public request tracking portal was added.
- Production readiness is **not** granted. Production branch/deployment, DNS, credentials, QA sessions, historical deployments, hosted Neon and Vercel settings are untouched. Production intake is disabled; hosted W4 activation and all W6 launch gates remain external.

### W4 implemented scope

- Additive migration `drizzle/0003_w4-plans-join-requests.sql` adds `plans`, `join_requests`, `join_intake_rate_limits` with checks/indexes. No existing migration was modified and no sequences were added.
- Plans are marketing data only. One row keeps separate draft/published values, immutable unique URL-safe slug, name, description, ordered features, optional monthly/yearly exact integer minor-unit prices, explicit supported currency, CTA label, featured flag, display order, `draft | published | hidden` status, revision and timestamps. New plans are drafts; editing a live plan never changes the public offer until explicit publication; hide removes it from public listing/new selection while historical requests keep their server-generated snapshots. Stale writes are rejected by expected-revision checks.
- Price `NULL` means unannounced (“يُعلن لاحقًا”) and is distinct from explicit `0`. Currency is owner-selected from an allowlist with correct minor-unit exponents; negative/invalid/malformed values, unsupported currencies and yearly-only prices are rejected. No discount is calculated and no billing/entitlement logic exists.
- Public `/pricing` combines published CMS/SEO with published visible plans and reusable cards; no empty card section is rendered when no plans exist. A code-controlled notice replaces the stored no-plans warning whenever plans exist. `/join?plan=<slug>` resolves current published plans server-side, ignores unknown/malformed/repeated values, and passes a published revision; changed/hidden plans produce controlled `plan_changed`/`plan_unavailable` flows without silent reassignment.
- `POST /api/join` is the only public intake surface (GET 405, no public read). It is fail-closed behind `JOIN_INTAKE_ENABLED` (only explicit `1`/`true` enables; CMS cannot enable it), enforces JSON content type, a 16 KiB body limit, exact trusted origins, strict Zod fields/limits, phone normalization (Arabic-Indic digits, explicit country or international format, no guessing), idempotent submission tokens and a durable PostgreSQL rate limit (5 attempts/10 minutes default, 429 + Retry-After, HMAC bucket keys, no raw IP). New requests always have server status `new`, null notes, server timestamp/ID and current-offer snapshot. Repeated/concurrent same-token submissions create one record; changed payloads never overwrite.
- Owner-only `/admin/requests` and `/admin/requests/[id]` provide newest-first bounded listing, real status counts, all/new/contacted/closed filters, name/phone search, contact/business/offer/source detail, independent status updates and internal notes with stale-write protection and reopen support. No bulk delete/export/CRM/auto-contact. Pages are dynamic, middleware adds `cache-control: no-store`, and every page/action independently enforces owner identity.
- Join operational copy is code-controlled for enabled/disabled/storage-unavailable states; stored CMS text cannot make the form claim the wrong operational state. Default privacy/pricing/FAQ copy was updated only where prior claims became conditional. W6 must approve the final privacy notice/retention and a targeted owner/operator deletion process before any production collection.
- NKW-W33-001 corrected: publication review labels now distinguish **الموضع داخل المحرر** from **الموضع أمام الزوار**; hidden items never show a visitor position; final visible order/removal positions are preserved. NKW-W33-002 remains expected behavior: discard advances the editing revision, published revision does not change, and stale editors/reviews are invalidated.

### W4 verification (local, 2026-11-26, Node 22)

- Unit: 177/177 (adds plan validation/prices/formatting, join field/phone/gate/origin/rate-limit/error contracts, FAQ editor-vs-visitor position regression).
- PostgreSQL integration: 130/130 on disposable loopback PostgreSQL 18 (adds fresh/upgrade migration preservation, plan lifecycle/publication/hide/stale writes/fallbacks, join persistence/snapshots/idempotency/concurrency/rate-limit windows/identity isolation/route gate/origin/429/ownership fields, pagination/search, runtime-role plan/join/limiter DML and DDL/TRUNCATE refusal; existing auth/CMS/SEO suites preserved).
- Playwright: 98/98 with synthetic owner/data and disposable DB. Covers full owner plan create/edit/preview/publish/hide, public pricing/selection, public direct/planned/duplicate/plan-changed/unavailable join flows, owner request filters/detail/status/notes/reopen, anonymous/non-owner protection, cross-origin rejection, and disabled intake on a dedicated 3200 server. Responsive checks cover 320/360/390/430/768/1440; synthetic screenshots include `w4-plan-editor-draft-390/1440`, `w4-plan-preview-390`, `w4-public-pricing-390/1440`, `w4-join-selected-plan-390/1440`, `w4-join-success-390`, `w4-requests-list-390`, `w4-request-detail-390/1440`, `w4-join-disabled-390` in CI artifacts.
- `pnpm lint` (0 errors; 3 pre-existing warnings), `pnpm typecheck`, `pnpm test`, `pnpm db:check`, `pnpm build`, `pnpm test:db` and `pnpm test:e2e` pass locally on Node 22. Exact remote CI and Preview identity are checked on the final HEAD and recorded in the draft PR/handoff.
- No hosted Neon access, no hosted migration, no Vercel configuration change, no Production action. The W4 Preview requires the existing five variables plus `JOIN_INTAKE_ENABLED=1` for the isolated acceptance fixture; `JOIN_RATE_LIMIT_MAX` must remain unset/test-only.

### W4 hosted activation requirements (external lead)

- Apply `0003_w4-plans-join-requests` with `pnpm db:check` then `DATABASE_URL_DIRECT=<direct development URL> pnpm db:migrate` while the temporary `GRANT CREATE ON DATABASE nokmel_website TO nokmel_migrator` is active; revoke immediately after. Never expose `DATABASE_URL_DIRECT` to Vercel.
- Grant runtime `SELECT, INSERT, UPDATE, DELETE` on `plans`, `join_requests`, `join_intake_rate_limits` only; no TRUNCATE/DDL/schema CREATE and no sequence grants. Exact SQL/verification is in `docs/DATABASE_PERMISSIONS.md` §3b.
- Configure the new branch Preview with its own `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `OWNER_EMAIL`, plus `JOIN_INTAKE_ENABLED=1` for acceptance only. Do not seed real plans or synthetic leads into hosted databases; the owner creates plans explicitly. No bootstrap is required.
- A READY Vercel deployment is not proof of working intake; independent live acceptance must verify plan publication, pricing, join persistence, rate limiting, owner authorization and noindex/canonical behavior.

### Historical W3.3 outcome

Merged via PR #6; owner-only page-level SEO/social metadata on the reused `content_sections` draft/publication model, published-only metadata, approved image registry, combined review, NKW-W32-005 final-order correction, unit 136/136, integration 104/104, Playwright 92/92 at closure. No schema migration.

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
- W4 hosted gates: migration 0003, least-privilege grants, new branch Preview variables plus `JOIN_INTAKE_ENABLED`, independent live acceptance of plan publication/pricing/selection, join persistence/rate limit/429, owner-only reads/status/notes, and disabled/enabled operational copy. A READY deployment is not intake acceptance.
- W6 launch gates: hosted recovery-lock/pooler verification, historical deployment isolation, hosted request-header evidence, hosted cookie/origin/session evidence, deployed noindex/canonical verification, production migration and owner provisioning; approved final privacy notice, retention period and controlled personal-data deletion procedure; explicit commercial launch approval. Physical Android acceptance remains deferred.
- Public copy and legal texts remain working drafts; legal review and headline/tagline approval remain pending. Contact channels are not configured (W5); production join intake is disabled.

## W3.1 historical state (merged and accepted for development)

- Authentication: self-hosted Better Auth 1.7.28, single owner, public sign-up disabled server-side, DB-backed rate limiting, provisioning/recovery CLI, transactional shared credential advisory lock resolving NKW-W31-REC-01.
- Live infrastructure configured externally: Neon project `nokmel-website` (`delicate-cake-38544235`), development branch `br-winter-hat-bdqgatki`, database `nokmel_website`, roles `nokmel_migrator`/`nokmel_runtime`, migrations `0000`/`0001`, QA owner provisioned. Production branch untouched.
- Configured/accepted W3.1 Preview: `dpl_Gs4fzWGwMGcPjkLxcTbECp33HWRn`, immutable URL `https://nokmel-website-96pnuvu12-ammarjaberd-7111.vercel.app`, authorized origin `https://nokmel-website-git-vibe-w31-owner-auth-ff98b7-ammarjaberd-7111.vercel.app`. Physical Android 7/7 PASS (owner-reported); Muse desktop CONDITIONAL ACCEPT for Preview.
- Verification at W3.1 closure: lint/typecheck, unit 101/101, DB integration 50/50, build, Playwright 73/73. W3.2 retains these suites and adds CMS coverage.

## W2 baseline (accepted)

- Seven public routes `/`, `/features`, `/pricing`, `/join`, `/contact`, `/privacy`, `/terms`; RTL-first, mobile-first, prominent `/join` CTA, real public navigation, disabled join preview, honest early-access pricing/contact/legal drafts.
- Pre-launch noindex and robots disallow remain active; canonical URLs target `nokmel.tech`; public indexing requires explicit W6 launch approval (two-step documented action).
- Brand tokens/fonts and approved layout remain unchanged; W3.2 only replaces static page-content imports with the published-content loader and shared page views.
