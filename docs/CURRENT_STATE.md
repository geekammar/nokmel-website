# CURRENT_STATE.md — Nokmel Website

Last updated: W2-S implementation, 2026-11-26. Keep concise.
Status: **W2-S IMPLEMENTED on `feature/w2s-marketing-design-showcase` (draft PR; no merge, no deployment, no Production claim).**

## Baseline

- **W5 is merged and accepted.** PR #9 `MERGED` on 2026-11-26; accepted HEAD `5fceb8e97036dfc9c2aa6ec33a03921442257295`; merge commit `4f32b94ac6943f61e96f58014672d25eaa37968e` (current `main`). All three jobs on the accepted HEAD passed: `https://github.com/geekammar/nokmel-website/actions/runs/45883572257`.
- The owner-supplied independent W5 acceptance record reports **W5 core acceptance 20/20** and the **authorized QA cleanup completed**. This agent verified the merge and CI independently; the external acceptance document itself was not re-opened from this environment.
- W4.1 remains merged/accepted via PR #8. The authorized W4.1 QA cleanup removed exactly three synthetic requests and preserved plans/CMS/FAQ/auth/session data. FAQ Q6 and the corrected homepage CTA are preserved.

## W2-S implemented scope

- **Design refinement, not a backend rebuild.** The seven public routes remain exactly `/`, `/features`, `/pricing`, `/join`, `/contact`, `/privacy`, `/terms`. CMS publication semantics, published-content loaders, SEO defaults, pricing/offer logic, join validation/idempotency/attribution and the five admin sections are unchanged.
- **Homepage:** shorter visual rhythm with stronger hero hierarchy, product showcase immediately after the hero, editorial problem/capability comparison instead of stacked cards, combined steps + early-access expectations, compact FAQ and a short closing CTA. Existing CMS fields remain the rendering source; no database content was rewritten.
- **Footer:** compact brand block with a two-column mobile navigation/legal layout, configured public contact/social channels, and the reversible analytics preferences control when analytics is available. The public-facing temporary-wordmark note was removed. No contact information was fabricated.
- **Interactive showcase:** `ProductShowcase` is a lightweight React/CSS sequence with no network requests, no forms, no backend and no commerce mutation. It uses real accessible action buttons inside the synthetic conversation: select the featured product, add the guided two-unit quantity to the cart, start checkout, confirm COD, open merchant orders and accept the order. Previous/next/replay, opt-in autoplay (~12 seconds), pause, visibility pause and reduced-motion disabling remain available; any direct action pauses autoplay. The synthetic totals are fixed and consistent (25 × 2 = 50, delivery 10, total 60) and the same `NW-1042` reference links customer and merchant views. Desktop shows both panels side by side; mobile shows one compact viewport with a customer/merchant switch, a compact phase strip and automatic side transition. The focused rewrite reduced the mobile showcase from 1425/1425/1445 px (initial/checkout/accepted) to 1041/1108/1094 px with identical fixtures and boundaries — about 27%/22%/24% less vertical space.
- **Verified merchant-app evidence (read-only):** `geekammar/nokmel` at `74e864dacfa0e6598bb01e99402946e27a94216f`. Supporting paths: `src/lib/telegram/managed-webhook.ts` (storefront/product buttons, quantity add-to-cart, cart, checkout prompts, COD confirmation), `src/lib/commerce/orders.ts` (cart/quote, phone/address collection, COD order creation, order listing), `src/lib/commerce/order-state.ts` (merchant next-action/state rules), `src/components/dashboard/orders/order-actions.tsx` and `src/app/app/orders/page.tsx` (accept/prepare/handoff/deliver/collect/cancel UI), and `docs/review/cod-order-operations/README.md` (synthetic phone-width evidence).
- **Showcase sequence:** browse products → select product/quantity → add to cart → checkout with delivery details → COD confirmation → order appears in merchant management → merchant accepts the order. Only these verified states/actions are shown. COD remains subject to the merchant-app deployment switch and per-store setting; the website does not claim live production availability.
- **Excluded from the showcase:** WhatsApp/Meta channels, free-text AI order extraction, online card payment, automatic shipping/tracking and any capability not verified in the merchant app. Manual Vodafone Cash transfer is implemented in the merchant app but is outside the approved W2-S sequence and is not presented.
- **Capability boundary:** existing CMS capability statuses remain `direction` or `planned`; no capability was relabelled `available`. Features now separate the current direction from later phases with explicit status labels.
- **Social sharing candidate:** `public/brand/social/nokmel-social-card-1200x630.png` (with `SOCIAL_IMAGES` registry entry `social-card-1200x630`, actual 1200 × 630 PNG). It uses the approved Completion Mark and brand typography, keeps text inside safe crop margins and remains legible at small preview size. The existing default SEO/social image (`mark-transparent-1024`) and inherited metadata behavior are unchanged; no published SEO selection was overwritten.
- **Focused corrections:** NKW-W5-001 visibly disables plan publish/hide while the editor is dirty and explains that the draft must be saved first (server-side publication protection unchanged). NKW-W5-002 adds valid provider URL examples, especially `https://instagram.com/nokmel.store`, without weakening validation. NKW-W5-004 remains deferred to W6; NKW-W41-002 remains deferred to physical Android acceptance.
- **No migration:** W2-S adds no migration, changes no migration 0000–0005, adds no table, no public route and no generic page builder.

## Verification (local, 2026-11-26, Node 22, pnpm 10.34.6)

- Unit **281/281**; PostgreSQL integration **187/187** on disposable loopback PostgreSQL 18 (Docker `postgres:18`); Playwright **124/124** against packaged servers with synthetic owner/data and loopback GA4/Telegram stubs.
- `pnpm lint` 0 errors and 0 warnings, `pnpm typecheck`, `pnpm db:check` and `pnpm build` pass.
- Targeted widths: 320/360/390/430/768/1440 (plus existing 1024/1280/1920 coverage); no horizontal overflow, RTL preserved, showcase transitions and keyboard/autoplay/reduced-motion behavior tested.
- Implementation screenshots at 390 and 1440 include the full homepage and focused showcase states (initial, checkout/merchant and accepted). The homepage at 390 shrank from 5476 to 5092 px and at 1440 from 4034 to 3832 px. These are synthetic browser evidence; no physical Android acceptance is claimed.
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
