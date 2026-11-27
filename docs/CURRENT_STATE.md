# CURRENT_STATE.md — Nokmel Website

Last updated: W2-S interactive showcase removal, 2026-11-26. Keep concise.
Status: **W2-S IMPLEMENTED on `feature/w2s-marketing-design-showcase` (draft PR; no merge, no deployment, no Production claim).**

## Baseline

- **W5 is merged and accepted.** PR #9 `MERGED` on 2026-11-26; accepted HEAD `5fceb8e97036dfc9c2aa6ec33a03921442257295`; merge commit `4f32b94ac6943f61e96f58014672d25eaa37968e` (current `main`). All three jobs on the accepted HEAD passed: `https://github.com/geekammar/nokmel-website/actions/runs/45883572257`.
- The owner-supplied independent W5 acceptance record reports **W5 core acceptance 20/20** and the **authorized QA cleanup completed**. This agent verified the merge and CI independently; the external acceptance document itself was not re-opened from this environment.
- W4.1 remains merged/accepted via PR #8. The authorized W4.1 QA cleanup removed exactly three synthetic requests and preserved plans/CMS/FAQ/auth/session data. FAQ Q6 and the corrected homepage CTA are preserved.

## W2-S implemented scope

- **Design refinement, not a backend rebuild.** The seven public routes remain exactly `/`, `/features`, `/pricing`, `/join`, `/contact`, `/privacy`, `/terms`. CMS publication semantics, published-content loaders, SEO defaults, pricing/offer logic, join validation/idempotency/attribution and the five admin sections are unchanged.
- **Homepage:** shorter visual rhythm with a stronger brand-only hero, editorial problem/capability comparison, combined steps + early-access expectations, compact FAQ and a short closing CTA. The interactive product showcase is not rendered and no replacement GIF, video or mockup was added. The primary join CTA and approved hero positioning remain.
- **Interactive showcase removed:** following the owner's explicit rejection, `src/components/sections/ProductShowcase.tsx`, its unit/e2e tests and all rendered homepage references were removed. Synthetic scene state, fake commerce interaction, autoplay timers, navigation controls and obsolete styles no longer exist. No other public route referenced the showcase. The hero secondary CTA remains `#how-it-works`; no dead `#product-showcase` anchor is emitted.
- **Preserved CMS compatibility:** the existing showcase content fields (title, body, three steps, caption, CTA) and the narrowly scoped `showcase.visible` preference remain in the existing JSONB CMS model. Visibility is hidden by default; legacy payloads without it remain valid and normalize to hidden without a backfill or content reset. Draft/preview/review/publication, revision locking and stale-write rejection are preserved. No stored CMS data was deleted and no migration was added.
- **Honest unavailable state:** the admin editor description and visibility help state that the visible showcase is currently unavailable and that enabling the stored preference does not create a public section or broken anchor. Enabling/publishing the preference does not render an empty section; the public homepage stays showcase-free until a replacement visual is approved and implemented.
- **Future visual direction (not implemented/approved scope):** a lightweight static composition using verified Telegram customer shopping and merchant order-management screenshots, consistent synthetic product/order data, mobile-first. Optimized static WebP/AVIF assets are preferred initially; optional subtle motion can follow visual approval and must respect reduced-motion and provide pause controls. No unsupported capability claims, generic media library or page builder.
- **Capability boundary preserved:** the earlier read-only merchant-app evidence remains the reference for future visuals (`geekammar/nokmel@74e864dacfa0e6598bb01e99402946e27a94216f`). WhatsApp/Meta, free-text AI ordering, online card payment and shipping automation remain excluded unless separately verified.
- **Footer:** compact brand block with a two-column mobile navigation/legal layout, configured public contact/social channels, and the reversible analytics preferences control when analytics is available. The public-facing temporary-wordmark note was removed. No contact information was fabricated.
- **Social sharing candidate:** `public/brand/social/nokmel-social-card-1200x630.png` (registry `social-card-1200x630`, 1200 × 630 PNG). The default SEO/social image and inherited metadata remain unchanged; owner approval for default use remains a W6 decision.
- **Focused corrections:** NKW-W5-001 visibly disables plan publish/hide while the editor is dirty and explains that the draft must be saved first (server-side publication protection unchanged). NKW-W5-002 adds valid provider URL examples, especially `https://instagram.com/nokmel.store`, without weakening validation. NKW-W5-004 remains deferred to W6; NKW-W41-002 remains deferred to physical Android acceptance.
- **No migration:** W2-S adds no migration, changes no migration 0000–0005, adds no table, no public route and no generic page builder.

## Verification (local, 2026-11-26, Node 22, pnpm 10.34.6)

- Unit **283/283**; PostgreSQL integration **192/192** on disposable loopback PostgreSQL 18 (Docker `postgres:18`); Playwright **119/119** against packaged servers with synthetic owner/data and loopback GA4/Telegram stubs. The no-DB public scope passes 49 tests and skips the two database-backed owner fixtures as expected.
- `pnpm lint` 0 errors and 0 warnings, `pnpm typecheck`, `pnpm db:check` and `pnpm build` pass.
- Targeted widths: 320/360/390/430/768/1440 (plus existing larger widths); no horizontal overflow, RTL preserved, hero/CTA/footer and the unavailable-showcase state tested.
- Homepage screenshots at 390/1440 are **4052/2980 px** with no showcase section, no empty container and no broken anchor. The owner visibility control and the preference-enabled state are captured separately; enabling the stored preference leaves the public homepage unchanged until a replacement visual exists.
- **Design decision:** the owner rejects the current interactive showcase design/implementation. It is removed rather than retained. The future direction is a static verified-screenshot composition with optional subtle motion after approval; it is not a launch blocker. No generic media library or page builder is approved.
- Exact remote CI on the final HEAD is checked separately and recorded in the draft PR/handoff.

## Remaining W5-I integration/hosted activation and W6 work

- W5-I (hosted integration activation and hosted evidence): apply migration 0005 with temporary migrator CREATE/revoke, grant runtime DML on `site_settings`, configure scoped Preview variables, GA4 property/stream/service-account and timezone, reduce/verify enhanced measurement, register/verify the join key event, prepare the dedicated website Telegram bot and owner destination, run test-before-enable and verify reversible consent/notification/settings behavior in the activated hosted environment.
- W6 launch gates remain: raw hosted metadata/headers, canonical/noindex, forwarded request identity, exact-token hosted replay and raw 429/Retry-After, hosted auth recovery/pooler behavior, Production isolation, approved final privacy/consent/retention policy and controlled deletion, physical Android acceptance (including NKW-W41-002), NKW-W5-004 protected deployment identity display, and explicit launch approval.
- Hosted Development and Production were not accessed or mutated by W2-S. No DNS, Vercel, indexing, GA4 or Telegram activation was performed. The merchant repository was inspected read-only and not modified.

## Historical one-liners

- **W5:** merged/accepted; database Overview, GA4 adapter/reversible consent, Telegram notifications, typed settings, NKW-W41-001; additive migration 0005 (hosted activation external).
- **W4.1:** merged/accepted; Cairo-scheduled marketing promotion, shared resolver/version, stale-offer recovery, immutable snapshots. Additive migration 0004.
- **W4:** merged; owner plans (marketing data only), public pricing, fail-closed/idempotent join intake, historical offer snapshots and owner request management. Additive migration 0003.
- **W3.3:** merged; page-level SEO/social metadata in the existing CMS draft/publication model. No migration.
- **W3.2:** merged; predefined CMS, protected preview, atomic publication, homepage FAQ, mobile admin navigation. Additive migration 0002.
- **W3.1:** merged; self-hosted Better Auth single owner, sessions/rate limiting/provisioning/recovery, protected admin shell. Additive migrations 0000/0001.
- **W2:** merged; seven RTL-first public routes, brand tokens/fonts, prominent join CTA, pre-launch noindex/robots. **W1/W0:** merged foundation/documentation.
