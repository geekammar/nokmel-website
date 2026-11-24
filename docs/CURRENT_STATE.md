# CURRENT_STATE.md — Nokmel Website

Last updated: W1 (Application Foundation & Brand Design System), 2026-11-24. Keep concise.

## Status: W1 implemented — draft PR open on branch `vibe/w1-app-foundation-c7fe34`

- W0 is merged on `main` (PR #1; base SHA `24171ba6805becc7a45fab51c6123b4248185080`).
- Brand Kit v2.0 verified in-environment: `Nokmel_Deep_Brand_Kit_v2.0.zip`, SHA-256 `7c04840fc335daff52048f27b13ff3ac1e0159a3dc0d9299fbe8bf55b6931ff9` (matches the reviewer's independent checksum).
- Canonical tokens: `04_DESIGN_TOKENS/nokmel.css` (committed as `src/styles/brand-tokens.css`); the parallel `04_TOKENS_AND_CODE` set is not imported (test-enforced).
- App foundation: Next.js 15.5.29 (App Router) + TypeScript strict + Tailwind CSS 3.4 + ESLint 9 + Zod + pnpm 10.34.6 (lockfile committed). Node.js 22 (engines `>=20.9.0`).
- Design system components: Button, TextLink, Card, Input, Textarea, Container, Section. Public layout: Header (responsive), Footer (dark brand section). Foundation page demonstrates tokens, typography, components; primary CTA `اطلب الانضمام` anchors to an explicitly non-production join preview.
- Arabic-first RTL (`lang="ar" dir="rtl"`), English-ready i18n scaffolding, self-hosted fonts (IBM Plex Sans Arabic, Geist, Alexandria — OFL-1.1, notices in `licenses/fonts/`).
- Verification: `pnpm lint`, `pnpm typecheck`, `pnpm test` (23 unit tests incl. token traceability + WCAG contrast), `pnpm build`, and Playwright e2e (10 tests, 6 viewports 320–1440px, screenshots) all pass locally. CI workflow `.github/workflows/ci.yml` runs the same checks on PRs.
- Accessibility: WCAG contrast of used token pairs asserted in tests; input-boundary adjustment documented in `docs/DESIGN_SYSTEM.md`.

## Blockers / pending approvals

- Final visual approval of the SVG symbol and wordmark assets is still required before production launch; the wordmark rendered in W1 is temporary text (Alexandria/Geist), not the final outlined custom lettering.
- No deployment, Vercel project, DNS, database, or credential changes were made.

## Next step

External review of the W1 draft PR. Do not start W2 before approval.
