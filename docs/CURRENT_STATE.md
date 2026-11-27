# CURRENT_STATE.md — Nokmel Website

Last updated: W2-V product-led visual design, 2026-11-27. Keep concise.
Status: **W2-V IMPLEMENTED on `feature/w2v-product-led-visual-design` (draft PR; no merge, no deployment, no Production claim).** Awaiting external visual and technical review.

## Baseline

- **W2-S is merged and accepted.** PR #10 merge commit `f1aeb5c04ee6660d149d492bf2bb5c2d7f3704d7`; accepted W2-S HEAD `dd71987cce35e3cf1981e42f87b638e3bcdbbdc3`; independent acceptance recorded externally. Current `main` is that merge commit.
- **W5 remains merged/accepted** via PR #9 (accepted HEAD `5fceb8e97036dfc9c2aa6ec33a03921442257295`, merge commit `4f32b94ac6943f61e96f58014672d25eaa37968e`). W4.1/W4/W3 remain merged baselines.
- Seven public routes, five admin sections, CMS draft/preview/review/publish, pricing/join semantics, SEO defaults/app registry, social-sharing candidate, auth/settings/notifications/analytics boundaries and pre-launch noindex are unchanged.

## W2-V implemented scope

- **Homepage sequence:** header → product hero (copy + optional visual) → four CMS-backed benefits → three-step how-it-works → calm early-access callout → existing FAQ → preserved final CTA → existing footer. The old problems column is no longer rendered; persisted `problems`/`capabilities` CMS content remains stored and compatible. Planned capabilities remain primarily on `/features`.
- **Hero:** approved copy defaults now use "متجرك في المحادثة. وإدارة طلباتك في مكان واحد.", the approved supporting copy, primary `/join` and secondary `/features` labels, and the early-access note. Existing published CMS content was not overwritten; owner publication is required for hosted copy changes. Desktop ≥1024px is RTL two-column (copy right, visual left, ~46/54); mobile is centered and keeps the visual below the copy block.
- **Static visual:** `src/components/marketing/product-hero/` and `src/components/marketing/product-visual/`. Two light phone frames: simplified Telegram bot conversation (product, price, quantity, COD, decorative add-to-cart, order confirmation/reference) and a compact merchant order preview (Nokmel mark, title, new state, shared reference, thumbnail/name/quantity, same total, COD, one accept action). Captions separate customer/merchant roles; a disclosure states illustrative data. No client JS, state machine, autoplay, slideshow, video, external request, commerce import, real order or customer data. All visual-internal controls are noninteractive spans.
- **Demo/market boundary:** one default market `EG` / `ar-EG` / `EGP`; one shared demo source (`هودي أساسي`, quantity 1, unit 65000 minor, delivery 0, total 65000, `NW-1042`); one Intl formatter supporting ISO minor units (including EGP and three-digit examples). No currency symbols hardcoded in visual components, no plan-currency replacement, no GeoIP/tracking/selector/conversion. Future explicit market resolution and per-market plan availability are documented as deferred.
- **CMS visibility:** reuses only `home.showcase.visible`. Hidden (default/legacy) renders no visual, no product asset and no empty column; hero copy remains centered. Visible published content renders the composition inside the hero. Draft stays private; preview/review/publication and stale-write protection unchanged. Admin guidance now describes the implemented static visual and preserved legacy showcase copy fields. No hosted CMS publication or mutation.
- **Motion/performance:** CSS-only entry motion (visual ≤8px/350ms, merchant card ≤6px/400ms staggered, one-time arrow), disabled under `prefers-reduced-motion`. No infinite animations, timers or libraries. Local AVIF/WebP product illustration (480×480 intrinsic); combined new image assets ~12.3KB. No external fonts/images/runtime.
- **Merchant evidence (read-only):** `geekammar/nokmel@49b7dadfe10cae1403179bf9e2de7afdcacf6db9`, with prior `74e864dacfa0e6598bb01e99402946e27a94216f` retained. Evidence: Telegram catalog/managed webhook (product selection, quantity/cart, phone/address), commerce orders (`addToCart`, `confirmCodOrder`, references/status, merchant accept/prepare), order-state transitions and COD copy/schema. The composition advertises only COD ordering and merchant acceptance. Manual Vodafone Cash transfers from the newer SHA are not advertised. WhatsApp/Meta, free-text AI ordering, online card payment and shipping automation remain excluded/unverified.
- **No migration:** no table, route, admin section, generic page builder, media library or commerce mutation. No Vercel/DNS/Production/GA4/Telegram action. No merge.

## Verification (local, 2026-11-27, Node 22.23.5, pnpm 10.34.6)

- Unit **294/294**; PostgreSQL integration **192/192** on disposable loopback PostgreSQL 18; Playwright **119/119** against packaged `next start` servers with a disposable database and loopback GA4/Telegram stubs. `pnpm lint`, `pnpm typecheck`, `pnpm db:check` and `pnpm build` pass.
- Responsive evidence at 320/360/390/430/768/1024/1440 with the visual published: no horizontal overflow; hero controls ≥44px; no fake focusable controls. Hidden behavior, draft isolation, preview, publication, reduced motion, shared demo values and preserved FAQ/CTA/navigation are covered.
- Lab performance (production build, local Chromium, 4× CPU + 1.6Mbps/150ms emulation, median of 3): homepage visible 390px LCP ~1.16s / CLS 0.060 / 473KB, 1440px LCP ~1.15s / CLS 0.002 / 475KB; hidden/default 390px LCP ~1.11s / CLS 0.069 / 464KB, 1440px LCP ~1.10s / CLS 0.026 / 465KB; pre-W2-V baseline 390px LCP ~0.83s / CLS 0.016 / 460KB, 1440px LCP ~0.77s / CLS 0.007 / 462KB. These are lab measurements, not field Core Web Vitals; INP is not claimed (no dedicated client JS was added).
- Screenshots: 320/430 hero, 390 full + focused visual, 768 tablet, 1440 hero + full, hidden homepage and owner visibility control. Browser evidence only; no physical Android acceptance claimed.
- Exact remote CI on the final HEAD and the Draft PR link are recorded in the PR/handoff.

## Remaining external gates

- External lead visual and technical review of W2-V; owner approval before Muse dispatch.
- Hosted CMS activation: owner updates/publishes approved hero and capability copy if persisted content differs, enables and publishes `showcase.visible`, verifies the hosted page. No hosted mutation was performed.
- W6 launch gates remain unchanged: hosted metadata/headers, canonical/noindex, forwarded identity, exact-token hosted replay/429 headers, auth recovery/pooler behavior, Production isolation, privacy/consent/retention approval, physical Android acceptance (including deferred NKW items), final performance/accessibility acceptance and explicit launch approval.

## Historical one-liners

- **W2-S:** merged via PR #10; W2-S design refinements and hidden-by-default legacy showcase compatibility.
- **W5:** merged/accepted; database Overview, GA4 adapter/reversible consent, Telegram notifications, typed settings. Additive migration 0005 (hosted activation external).
- **W4.1:** merged/accepted; Cairo-scheduled promotion, shared resolver/version, stale-offer recovery, immutable snapshots. Additive migration 0004.
- **W4:** merged; owner plans (marketing data only), public pricing, fail-closed/idempotent join intake, historical offer snapshots, owner requests. Additive migration 0003.
- **W3.3/W3.2/W3.1/W2/W1/W0:** merged; SEO, CMS, owner auth, seven RTL routes, brand tokens and documentation foundation.
