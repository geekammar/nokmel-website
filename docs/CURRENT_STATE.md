# CURRENT_STATE.md — Nokmel Website

Last updated: W4.1 implementation, 2026-11-26. Keep concise.

## Status: W4.1 — IMPLEMENTED on `feature/w41-scheduled-promotional-pricing` (draft PR; local verification; hosted activation/acceptance external; no production claim)

- Baseline: merged `main` `ce82fda57565b4bbea3d31fea21e7c2eac54159b` (W4 PR #7, accepted HEAD `f24b86ee9602f113c1fdacf5ae82683f5cece50d`). W4 remains accepted for continued development; W3/CMS/FAQ/SEO behavior is preserved.
- W4.1 adds one optional scheduled promotional discount per marketing plan. It is marketing data only and creates no purchase, payment, subscription, entitlement, merchant permission, coupon, promotion stack or campaign.
- Storage: additive `drizzle/0004_w41-scheduled-promotional-pricing.sql` adds nullable `plans.draft_promotion`, `plans.published_promotion` and `join_requests.offer_snapshot` JSONB plus object checks. Existing plans migrate to no promotion with unchanged prices/revisions/visibility; existing W4 requests keep their legacy single-price meaning.
- Promotion configuration: enabled, label, percentage (integer basis points) or fixed amount, monthly/yearly/both target, Cairo start/end instants, manual enable/disable/removal. Percentage and fixed arithmetic use exact minor units and BigInt intermediates with deterministic half-up rounding. `PLAN_LIMITS.priceMinor` now matches the PostgreSQL signed integer maximum `2,147,483,647`; no value is accepted that the database cannot represent.
- Scheduling: owner input is Africa/Cairo (explicit label); nonexistent/ambiguous DST wall times are rejected; stored instants are UTC. Active only when enabled and `startsAt <= now < endsAt`. No cron/background worker; plan rows are never rewritten by time passing. Publishing after the scheduled end remains expired; republishing a hidden plan does not extend it.
- Draft/public separation: owner edits/disable/removal never change the public offer before explicit publication. Changing prices/currency/periods revalidates the promotion and rejects invalid combinations.
- Shared resolver/version: `src/lib/plans/promotion.ts` is authoritative for public pricing, `/join`, submission validation and snapshots. It exposes per-period original/effective/savings values, derived state and a bounded deterministic `effectiveOfferVersion` that is stable within an interval and changes at activation/expiration or relevant publication changes. Public loaders resolve with one captured server `asOf`; drafts are never exposed.
- Public UI: discounted periods show semantic strikethrough original, effective price, truthful savings amount/percentage (floored), promotion label and simple Cairo expiry. Monthly-only/yearly-only offers never imply the other period; no countdown/fake urgency. `/pricing` remains dynamic; an open page may show the old offer until refresh, but submission uses server time and never accepts a stale version.
- Join form: selected-plan summary, dropdown and recovery consistently use the effective offer and send `offerVersion`; contact fields, optional plan selection, direct join, source/UTM handling and requested-plan notice are preserved. `plan_changed` updates the option/summary/label/savings/expiry/version together.
- Server validation: planned submission resolves the committed token first (idempotent replay), then reads the published plan row `FOR SHARE`, resolves the current offer once and compares `offerVersion`. Stale activation/expiration or publication returns the existing controlled `plan_changed` flow; hidden/unavailable plans remain rejected. A concurrent publication waits for the join transaction, so snapshots cannot mix offer states.
- Historical snapshot: new planned requests store a versioned object with plan ID/slug/name, currency, published revision, original/effective monthly/yearly prices, promotion state/version, capture instant and active promotion label/type/target/values/schedule/per-period savings. Legacy columns remain populated for compatibility (effective displayed monthly, else yearly). No-plan requests have no snapshot. Legacy rows are not backfilled or reconstructed.
- Owner UX: compact **العروض والخصومات** inside the existing plan editor; no new primary admin section/route. Owner preview shows current state and an explicitly labelled simulation for a future scheduled promotion; expired/disabled offers are not simulated as active; preview CTA stays disabled. Request detail distinguishes full W4.1 snapshots, legacy single-price rows and no-plan rows.
- Local verification (Node 22, disposable loopback PostgreSQL 18): unit **210/210**, PostgreSQL integration **160/160**, Playwright **101/101**; lint 0 errors (3 pre-existing warnings), typecheck, `db:check`, build pass. Exact remote CI is checked on the final HEAD and recorded in the PR/handoff.
- W4.1 requires no new runtime table/column grant beyond the existing `plans`/`join_requests` table DML. Hosted migration 0004 still requires the documented temporary migrator database-level CREATE grant, revoked immediately after. The new branch Preview needs scoped `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, `OWNER_EMAIL` and intake acceptance configuration from the external lead. The coding agent performed no hosted Neon access, hosted data mutation, Vercel setting change or Production action.

### NKW-W4-006 owner CMS correction handoff (external)

The published homepage final CTA description still contains:
`سجّل اهتمامك بالانضمام المبكر، وسنتواصل معك عند تفعيل استلام الطلبات لترتيب خطوتك التالية.`
Approved replacement:
`سجّل اهتمامك بالانضمام المبكر، وسنراجع طلبك للتواصل معك بشأن الخطوة التالية.`
Owner workflow for the external lead/Muse during hosted W4.1 acceptance:
1. Open `المحتوى والـSEO` → homepage editor.
2. Ensure no unrelated draft changes exist.
3. Modify only the final CTA description field.
4. Save the draft.
5. Inspect the publication review; confirm only the authorized correction is listed.
6. Publish only that correction.
7. Verify the public homepage text.
8. Preserve the corrected Q6 FAQ answer unchanged.
No hosted CMS row was mutated by the coding agent and no content-rewrite migration was added.

### W4.1 remaining independent acceptance

- Hosted migration 0004 + grant/revoke and scoped Preview configuration (external lead).
- Independent owner/visitor acceptance of the promotion workflow, preview, activation/expiration recovery and historical snapshot presentation.
- NKW-W4-006 owner CMS correction above.
- Raw hosted HTTP metadata/canonical/noindex, forwarded-header evidence, exact-token replay/429 raw headers, recovery-lock/pooler verification, Production isolation, final privacy/retention approval, physical Android acceptance and explicit commercial launch approval remain W6 gates.
- W5 has not started.

## Historical W4 status: CONDITIONAL ACCEPT for Preview; final product-consistency closure on `feature/w4-plans-join-requests` (merged)

- Baseline: merged `main` `0020ddacdd54b3c23471b58b17b54fda1c1a0ae1` (W3.3 PR #6, accepted HEAD `dcf1f8d9ede739a29bd48d036df1a1d5cd9f28bf`). W3.1/W3.2/W3.3 behavior is preserved.
- W4 activates the existing **الباقات والأسعار** and **طلبات الانضمام** admin sections. Settings remains unavailable until W5; no CRM, billing, checkout, subscriptions, merchant accounts, notifications, analytics provider or public request tracking portal was added.
- Hosted Development activation is complete externally; Muse returned CONDITIONAL ACCEPT for Preview only: 22 cases (17 PASS, 4 PARTIAL, 1 BLOCKED, 0 FAIL). The external lead verified authorized alias `https://nokmel-website-git-feature-w4-plans-joi-6473a3-ammarjaberd-7111.vercel.app` resolves to configured deployment `dpl_5Qz8bZ3SUCFoFjQ7rbB5VYcR5crc`, READY, exact expected HEAD. The coding agent did not access hosted Neon, mutate hosted records or change Vercel settings. Production readiness is **not** granted; Production intake and all W6 gates remain external.

### W4 implemented scope

- Additive migration `drizzle/0003_w4-plans-join-requests.sql` adds `plans`, `join_requests`, `join_intake_rate_limits` with checks/indexes. No existing migration was modified and no sequences were added.
- Plans are marketing data only. One row keeps separate draft/published values, immutable unique URL-safe slug, name, description, ordered features, optional monthly/yearly exact integer minor-unit prices, explicit supported currency, CTA label, featured flag, display order, `draft | published | hidden` status, revision and timestamps. New plans are drafts; editing a live plan never changes the public offer until explicit publication; hide removes it from public listing/new selection while historical requests keep their server-generated snapshots. Stale writes are rejected by expected-revision checks.
- Price `NULL` means unannounced (“يُعلن لاحقًا”) and is distinct from explicit `0`. Currency is owner-selected from an allowlist with correct minor-unit exponents; negative/invalid/malformed values, unsupported currencies and yearly-only prices are rejected. No discount is calculated and no billing/entitlement logic exists.
- Public `/pricing` combines published CMS/SEO with published visible plans and reusable cards; no empty card section is rendered when no plans exist. A code-controlled notice replaces the stored no-plans warning whenever plans exist. `/join?plan=<slug>` resolves current published plans server-side, ignores unknown/malformed/repeated values, and passes a published revision; changed/hidden plans produce controlled `plan_changed`/`plan_unavailable` flows without silent reassignment.
- Acquisition `source` is independent of plan selection: only an explicit valid `source=pricing` records pricing; `/join?plan=` without source records `direct`. Unknown/malformed/repeated sources fall back to direct. Changed/hidden-offer recovery preserves the original source. A requested-but-unresolvable plan shows a concise neutral notice without reflecting the raw query or selecting another plan.
- Client recovery keeps one effective plan-option list: `plan_changed` replaces the option/summary/prices/revision while preserving explicit confirmation; `plan_unavailable` removes that option while preserving other options, entered fields, token and continue-without-plan. Owner request detail labels the captured historical period and documents the intentional single-price snapshot limitation.
- `POST /api/join` is the only public intake surface (GET 405, no public read). It is fail-closed behind `JOIN_INTAKE_ENABLED` (only explicit `1`/`true` enables; CMS cannot enable it), enforces JSON content type, a 16 KiB body limit, exact trusted origins, strict Zod fields/limits, phone normalization (Arabic-Indic digits, explicit country or international format, no guessing), idempotent submission tokens and a durable PostgreSQL rate limit (5 attempts/10 minutes default, 429 + Retry-After, HMAC bucket keys, no raw IP). New requests always have server status `new`, null notes, server timestamp/ID and current-offer snapshot. Repeated/concurrent same-token submissions create one record; changed payloads never overwrite.
- Owner-only `/admin/requests` and `/admin/requests/[id]` provide newest-first bounded listing, real status counts, all/new/contacted/closed filters, name/phone search, contact/business/offer/source detail, independent status updates and internal notes with stale-write protection and reopen support. No bulk delete/export/CRM/auto-contact. Pages are dynamic, middleware adds `cache-control: no-store`, and every page/action independently enforces owner identity.
- Join operational copy is code-controlled for enabled/disabled/storage-unavailable states; stored CMS text cannot make the form claim the wrong operational state. Default privacy/pricing/FAQ copy was updated only where prior claims became conditional. W6 must approve the final privacy notice/retention and a targeted owner/operator deletion process before any production collection.
- NKW-W33-001 corrected: publication review labels now distinguish **الموضع داخل المحرر** from **الموضع أمام الزوار**; hidden items never show a visitor position; final visible order/removal positions are preserved. NKW-W33-002 remains expected behavior: discard advances the editing revision, published revision does not change, and stale editors/reviews are invalidated.

### W4 verification (local, 2026-11-26, Node 22)

- Unit: 181/181 (adds plan validation/prices/formatting, join field/phone/gate/origin/rate-limit/error contracts, fail-closed intake security configuration, malformed forwarded-header handling, FAQ editor-vs-visitor position regression).
- PostgreSQL integration: 140/140 on disposable loopback PostgreSQL 18 (adds source-independent persistence, plan lifecycle/publication/hide/stale writes/fallbacks, join snapshots/idempotent replay, concurrent same-token coordination, rate-limit windows/identity isolation/route gate/origin/429, config fail-closed/no-insert, stale published FAQ non-rewrite, exact-ID QA cleanup transaction/abort, pagination/search, runtime-role DML and DDL/TRUNCATE refusal; existing auth/CMS/SEO suites preserved).
- Playwright: 99/99 with synthetic owner/data and disposable DB. Adds direct-plan-URL/repeated/malformed source attribution, changed-plan option/summary synchronization with switch-away/back, hidden-plan option removal with other options retained, field preservation, requested-plan notice, owner snapshot labels, plus all prior owner/public/join/authorization/disabled-intake suites. Responsive checks cover 320/360/390/430/768/1440; screenshots include W4 plan/join/request states under CI artifacts.
- `pnpm lint` (0 errors; 3 pre-existing warnings), `pnpm typecheck`, `pnpm test`, `pnpm db:check`, `pnpm build`, `pnpm test:db` and `pnpm test:e2e` pass locally on Node 22. Exact remote CI and Preview identity are checked on the final HEAD and recorded in the draft PR/handoff.
- The coding agent made no hosted Neon access, hosted data mutation, Vercel setting change or Production action. Hosted migration 0003/grants/Preview configuration were completed externally. `JOIN_RATE_LIMIT_MAX`/`NOKMEL_DISPOSABLE_TEST_ENV` remain test-only.

### W4 focused reliability/configuration closure (2026-11-26)

- **W4-R01 idempotent replay:** request creation now takes a token-scoped PostgreSQL advisory lock and resolves an existing committed submission token before current-offer validation. A lost-response retry after republish/hide returns the same minimal success without a new row, without rewriting the original snapshot, and without exposing request data. Same-token concurrent callers serialize; the first committed valid submission wins. A genuine first token that races an offer change can still be rejected as stale/hidden (correct). Public success is uniform `{ ok: true, status: 'received' }`; the public `duplicate` flag was removed. Duplicate retries remain rate-limited.
- **W4-R02 fail-closed security configuration:** enabled intake requires a valid 32+ character `BETTER_AUTH_SECRET` and valid exact `BETTER_AUTH_URL`/`TRUSTED_ORIGINS`. Missing/invalid configuration returns controlled 503 `intake_misconfigured` before rate limiting/persistence, even without an `Origin` header; no request is inserted. The hardcoded HMAC fallback was removed. Origin checks still fail closed when unconfigured; missing `Origin` is accepted only with valid configuration. Forwarded identity now treats any comma/empty segment as ambiguous instead of filtering entries.
- **W4-R03 QA cleanup:** operator-only `scripts/cleanup-w4-qa-requests.ts` (`pnpm qa:cleanup-w4`) uses exact recorded IDs + synthetic marker, transactional dry-run/confirm, locks and validates all rows, aborts on missing/unexpected IDs or marker mismatch, and deletes only exact IDs. No admin deletion feature, no bulk/TRUNCATE, no plan deletion/FK weakening; test plans are hidden. Final production retention/deletion policy still requires owner approval.
- Focused verification: unit 181/181, PostgreSQL integration 140/140, Playwright 99/99. Exact CI is checked on the final HEAD and recorded in the PR/handoff. No migration or runtime-grant change; hosted migration 0003 remains applied externally.

### W4 final product-consistency closure (2026-11-26)

- **NKW-W4-001 source attribution:** plan preselection no longer implies `pricing`. No explicit source → `direct`; explicit valid `source=pricing` stays pricing; unknown/malformed/repeated source → direct. Plan changes/removal/recovery do not modify the original source. Source remains a bounded acquisition hint, not proof of navigation history.
- **NKW-W4-002 operational copy:** default FAQ answer now uses neutral wording valid in enabled/disabled states. The stale hosted FAQ answer remains an owner-published CMS value and must be corrected through the CMS workflow; no automatic CMS rewrite/delete/ID change or migration was added. A focused integration test proves rendering does not mutate a stale published answer. Exact owner procedure: open Content & SEO → homepage, locate `هل نموذج طلب الانضمام يعمل الآن؟`, replace only the answer with `يمكنك معرفة حالة استقبال طلبات الانضمام من صفحة «اطلب الانضمام». عندما يكون النموذج متاحًا، يمكنك إرسال طلبك دون دفع أو التزام بشراء اشتراك.`, save draft, verify publication review lists only the intended answer correction, confirm publication, verify public answer/current join state.
- **NKW-W4-003 snapshot limitation:** schema unchanged in W4. Owner detail labels the captured historical period (monthly/yearly) and states the legacy snapshot contains one displayed price only; yearly is not captured when monthly is stored and must not be derived from current plans. No-plan requests show not-applicable/no-plan note instead of an unannounced price implication. W4.1 stores a full versioned snapshot for newly accepted requests while preserving this legacy interpretation.
- **NKW-W4-004 recovery UI:** form now maintains one effective plan-option collection. `plan_changed` replaces the option/summary/prices/revision and preserves pending confirmation; switching away/back cannot resurrect stale values. `plan_unavailable` removes that option, clears selection, preserves other options/fields/token and allows continue-without-plan. Browser regressions cover both.
- **NKW-W4-005 notice:** requested-but-unresolved plan shows a concise neutral notice, no raw query reflection, no unrelated selection, and intake-disabled behavior remains unchanged.
- Remaining focused live retest: source attribution, owner FAQ correction, snapshot labels, recovery UI and requested-plan notice. Raw HTTP metadata, exact-token replay/429 raw headers, hosted forwarded-header evidence, physical Android acceptance and final privacy/retention approval remain separate/W6 gates.

### W4 hosted activation status (external)

- Hosted Development migration `0003_w4-plans-join-requests`, least-privilege DML grants and branch Preview intake configuration were completed by the external lead. The next automatic Preview deployment should reuse the branch environment.
- The authorized branch alias/deployment identity was externally verified. A READY deployment is not itself functional acceptance.
- Four synthetic QA requests and two hidden synthetic plans remain in hosted Development, with exact IDs verified externally. Do not correct historical test-source values; use the operator dry-run/confirm cleanup only after authorization.
- Do not seed real plans/leads; owner must create plans explicitly. Do not set test-only rate-limit variables in deployments.

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
- W4 focused live retest: NKW-W4-001 source attribution, NKW-W4-002 owner FAQ correction, NKW-W4-003 snapshot labels, NKW-W4-004 recovery options, NKW-W4-005 requested-plan notice. Raw hosted HTTP metadata, exact-token replay/429 raw-header evidence, hosted forwarded-header/security evidence remain separate limitations. Hosted activation is complete; READY alone is not functional acceptance.
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
