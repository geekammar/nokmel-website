# CURRENT_STATE.md — Nokmel Website

Last updated: W1 focused repair (PR #2 review feedback), 2026-11-24. Keep concise.

## Status: W1 implemented + focused repair — draft PR #2 on branch `vibe/w1-app-foundation-c7fe34`

- W0 merged on `main` (PR #1; base SHA `24171ba6805becc7a45fab51c6123b4248185080`).
- Brand Kit v2.0 verified in-environment: `Nokmel_Deep_Brand_Kit_v2.0.zip`, SHA-256 `7c04840fc335daff52048f27b13ff3ac1e0159a3dc0d9299fbe8bf55b6931ff9` (matches reviewer's checksum). Canonical tokens: `04_DESIGN_TOKENS/nokmel.css` → `src/styles/brand-tokens.css`; parallel token set not imported (test-enforced). Brand tokens, logo geometry, typography, and the documented input-boundary accessibility adjustment are unchanged.
- App foundation: Next.js 15.5.29 (App Router) + TS strict + Tailwind 3.4 + ESLint 9 + Zod + pnpm 10.34.6 (lockfile committed); Node 22 (engines `>=20.9.0`).
- Components: Button, TextLink, Card, Input, Textarea, Container, Section; Header/Footer; Arabic-first RTL foundation page with non-production join-preview CTA `اطلب الانضمام`. The temporary foundation page is page-scoped `noindex`; public SEO arrives with the public-website phase.
- W1 repair items: CI init order fixed (`pnpm/action-setup` before `setup-node` pnpm caching; actions on supported v6 majors; frozen lockfile kept, no step weakened); Button/Input/Textarea contracts hardened with regression tests (disabled link-buttons rejected at type+runtime level, stable unique control ids, error aria-association merged with caller attributes); sticky-header anchor offset via `scroll-padding-top`; page-level noindex metadata.
- Local verification: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (27/27), `pnpm build`, `pnpm test:e2e` (13/13; viewports 320/360/390/768/1280/1440px + screenshots) — all pass.
- Remote CI: see PR #2 description for the exact run URL and conclusion.

## Blockers / pending approvals

- Final visual approval of the SVG symbol and wordmark assets is still required before production launch; the wordmark rendered in W1 is temporary text (Alexandria/Geist), not the final outlined custom lettering.
- No deployment, Vercel project, DNS, database, or credential changes were made.

## Next step

External review of draft PR #2. Do not start W2 before approval.
