# CURRENT_STATE.md — Nokmel Website

Last updated: W2 (public marketing website), 2026-11-24. Keep concise.

## Status: W2 implemented — draft PR on branch `vibe/w2-public-website-cf85c7` (awaiting review)

- W1 merged on `main` (PR #2). W2 rebased scope: reuse the W1 foundation unchanged (tokens, fonts, logo geometry, component contracts).
- All seven approved public routes implemented: `/`, `/features`, `/pricing`, `/join`, `/contact`, `/privacy`, `/terms`. No other routes.
- Header/footer: real public navigation (desktop + accessible mobile `<details>` disclosure, no JS), prominent `اطلب الانضمام` CTA → `/join` everywhere, skip link, `id="main-content"` target. No login links (no verified destination).
- CMS-ready content layer: typed, zod-validated content objects under `src/content/ar/` (home, features, pricing, join, contact, legal) + shared routes schema `src/content/schema.ts`; reusable sections under `src/components/sections/`. No page builder, no CMS/database work.
- W1 visual corrections implemented: centralized pre-launch indexing gate (`PRE_LAUNCH` in `src/lib/seo.ts` + `public/robots.txt` disallow — page-level noindex is NOT a permanent policy); responsive section spacing rhythm (`normal`/`compact`); Input/Textarea id contract now explicit `id` prop or `useId()` (never derived from `name`) with duplicate-name regression tests; dark-section foreground confirmed by computed-contrast e2e; sticky-header offset preserved via `scroll-padding-top`.
- Join page: W2 is a disabled preview (native disabled inputs + disabled submit, no data transmission, no success messages); optional future plan context via `?plan=<slug>` (validated). Submission/storage arrives in W4.
- Pricing page: honest early-access state only; no invented prices, plan names, entitlements, or discounts; commercial purchasing not enabled; CTA leads to `/join`.
- Contact page: renders only configured channels (empty by default — no invented contact details). Legal pages are clearly labeled drafts, not approved texts.
- Product claims: no testimonials, logos, metrics, or fabricated screenshots. The homepage showcasing uses a skeleton-based conceptual illustration explicitly labeled as representing product direction, not a finished UI. All capabilities are labelled `direction` / `planned` (`available` reserved, none used).
- SEO: per-page title/description/OpenGraph via `pageMetadata`, canonical URLs on the approved target domain `nokmel.tech` (never the protected deployment domain), semantic single `h1` per page. Site remains non-indexable pre-launch; indexing switch-on requires explicit launch approval (W6) and is a two-step documented action (`PRE_LAUNCH`, robots.txt).
- `engines.node` pinned to `>=22.0.0 <23` to match the approved Node.js 22 CI/runtime.
- Local verification: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (44/44), `pnpm build` (7 routes), `pnpm test:e2e` (27/27; viewports 320/360/390/768/1280/1440 + full-page screenshots of all routes on mobile and desktop).
- Remote CI: see the W2 draft PR description for the exact run URL and result. Vercel preview of the final HEAD: see the same PR description.

## Blockers / pending approvals

- Headline/tagline and all marketing copy remain working proposals pending owner approval.
- Legal texts are labeled drafts requiring legal review before adoption.
- No contact details published (not yet determined by the owner).
- Do not start W3 before independent review of W2.
