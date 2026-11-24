# DESIGN_SYSTEM.md — Nokmel Website

## Brand source of truth — VERIFIED

- Accepted reference: **`Nokmel_Deep_Brand_Kit_v2.0.zip`** (Google Drive, supplied by the external reviewer).
- **SHA-256: `7c04840fc335daff52048f27b13ff3ac1e0159a3dc0d9299fbe8bf55b6931ff9`** — calculated locally in the execution environment and independently confirmed by the external reviewer. Exact match.
- The archive was downloaded, integrity-checked (ZIP `testzip` OK, 89 entries), and extracted in the execution environment. Contents were inspected directly; nothing below is guessed.
- Brand Kit v1.0 is not used. The logo geometry is not redrawn, modified, or simplified — the supplied SVG files are used as-is.

## Canonical token-set decision [RESOLVED by external technical lead]

The kit ships two parallel token sets (`04_DESIGN_TOKENS/` and `04_TOKENS_AND_CODE/`). Decision:

- **Canonical implementation source: `04_DESIGN_TOKENS/nokmel.css`** → committed verbatim as `src/styles/brand-tokens.css`.
- Supporting references committed alongside: `src/styles/tokens.json`, `src/styles/palette.json` (copies of `04_DESIGN_TOKENS/tokens.json` / `palette.json`).
- `04_TOKENS_AND_CODE/nokmel.tokens.css` is **not imported anywhere** (enforced by a unit test).

## Approved core tokens (actual values from the canonical file)

Light (`:root`):

| Token | Value |
|---|---|
| `--brand-primary` | `#192B50` |
| `--action-secondary` (Sapphire) | `#526CB5` |
| `--brand-highlight` (Frost) | `#A9BCE5` |
| `--action-primary-bg` / `--action-primary-fg` | `#192B50` / `#FFFFFF` |
| `--color-background` | `#F5F7FB` |
| `--color-surface` | `#FFFFFF` |
| `--color-text-primary` / `--color-text-secondary` | `#1C2940` / `#606D80` |
| `--color-border-subtle` | `#DCE3EE` |
| `--color-border-input` | `#9CAEC9` |
| `--color-focus-ring` | `#526CB5` |
| `--color-success` / `--color-warning` / `--color-error` / `--color-info` | `#16734C` / `#9A6200` / `#B43D42` / `#245DB0` |
| `--corner-card` / `--corner-control` / `--control-min-height` | `16px` / `12px` / `44px` |
| `--font-ar` / `--font-en` | `"IBM Plex Sans Arabic"` / `"Geist"` |

Dark (`[data-theme="dark"]`): background `#111B2D`, surface `#202D44`, text `#F1F4FB`, muted `#B7C6DC`, subtle border `#344665`, input border `#7188AE`, focus ring `#A9BCE5`, primary action = Frost `#A9BCE5` bg with Navy `#192B50` text.

Rules honored in the implementation:

- Primary CTA on light surfaces: Navy bg + white text. On dark surfaces: Frost bg + Navy text (both come from the canonical dark block; no hardcoded values).
- Sapphire is used only for secondary interactions / links / focus ring.
- Frost is never used as small text on white backgrounds.
- Status colors stay independent from brand colors; statuses always carry text + label, never color alone.
- No hardcoded hex colors in components — everything resolves through CSS variables mapped in `tailwind.config.ts`.

## Documented semantic accessibility adjustments (not palette changes)

- **Interactive input/button boundary (light theme):** the canonical `--color-border-input` `#9CAEC9` measures **2.26:1** against white, failing WCAG 1.4.11 (3:1 for component boundaries). Per the approved rule, interactive boundaries use `--color-border-interactive`, bound in `globals.css` to `--color-text-secondary` (`#606D80`, **5.26:1** on white) in light mode. In dark mode `--color-border-interactive` keeps the canonical `--color-border-input` `#7188AE` (**3.84:1** on `#202D44`, passes). The canonical token itself is unchanged in `brand-tokens.css` and remains available for decorative borders. Verified by `src/lib/__tests__/contrast.test.ts`.
- **Derived interaction states (implementation defaults, not brand tokens):** `--action-primary-bg-hover` / `-active` are `color-mix` derivatives of the primary action color, defined in `globals.css`.
- **Container width `72rem`** and vertical section rhythm are implementation defaults (`max-w-container`), not brand tokens.

All other contrast pairs used by the UI pass WCAG AA 4.5:1 for text and 3:1 for focus indicators (asserted in tests: primary/muted text on background and surface, Sapphire links, both CTA combinations, focus rings in both themes, all four status colors on white).

## Assets (committed under `public/brand/`)

- Logos (`public/brand/logos/`): `nokmel-mark-primary-color.svg` (used in header/hero), `nokmel-mark-dark-surface.svg` (dark sections/footer), `nokmel-mark-light-surface.svg`, `nokmel-mark-single-navy.svg`, `nokmel-mark-single-white.svg`, plus transparent PNG fallbacks 512/1024 (1024 used as OpenGraph image). Source: `01_MASTER_VECTOR/` of the kit, unmodified.
- Icons (`public/brand/icons/`): `favicon.ico`, `app-icon-light.svg` (also used as `src/app/icon.svg`), `app-icon-dark.svg`, and PNG sizes 180/192/512 for light and dark. Source: `02_APP_ICONS/`.
- Not committed (per asset policy): the full ZIP, large reference boards, `02_VECTOR_LOGO/` and `03_WORDMARK_LOCKUPS/` editable templates, and duplicate PNG exports.
- Visual check: the rendered header mark was compared against `01_APPROVED_REFERENCES/01_Original_Completion_Mark_User_Reference.png` — geometry and two-tone (navy upper / frost lower) match; nothing was redrawn.

## Typography and fonts

- UI Arabic: **IBM Plex Sans Arabic** (400/500/600/700) — self-hosted via `@fontsource/ibm-plex-sans-arabic@5.3.0`, loaded with `next/font/local`, bound to `--font-ar` in `globals.css`. License **OFL-1.1**, notice at `licenses/fonts/OFL-ibm-plex-sans-arabic.txt`.
- UI English: **Geist** — self-hosted via `@fontsource-variable/geist@5.3.0` (variable, latin + latin-ext), bound to `--font-en`. License **OFL-1.1**, notice at `licenses/fonts/OFL-geist.txt`.
- Temporary wordmark fonts: Arabic **Alexandria** (bold) via `@fontsource-variable/alexandria@5.3.0`, English **Geist** semibold — bound to `--font-wordmark-ar` / `--font-wordmark-en`. License **OFL-1.1**, notice at `licenses/fonts/OFL-alexandria.txt`.
- Fonts are npm-pinned and installed from the committed lockfile, so builds are reproducible and no runtime external font service is used. Verified in e2e that all three families actually load in the browser.

## Component contracts (W1 repair)

- `Button`: native `<button disabled>` cannot activate (native semantics). Link-style buttons (`href`) intentionally do **not** support `disabled` — it is rejected at the type level (`disabled?: never`) and throws at runtime, so a disabled link can never navigate or activate by pointer or keyboard.
- `Input` / `Textarea`: every control gets a stable unique id (`id` prop → `name` → React `useId()` fallback), `<label htmlFor>` always points at it, and validation errors render `role="alert"` with `id="<controlId>-error"` referenced via `aria-describedby`. Caller-provided `aria-describedby` / `aria-invalid` are merged with (never replaced by) the error association.
- Sticky header offset: `html { scroll-padding-top: 5.5rem }` keeps anchor targets (`#join-preview`, section anchors) clear of the sticky header; verified at 320px in e2e.
- Regression coverage: unit tests (`src/components/__tests__/components.test.tsx`) + Playwright e2e (header offset, disabled preview controls, noindex meta).

## Temporary page indexing

The W1 foundation page carries page-level `robots: { index: false, follow: false }` (`src/app/page.tsx`) because it is a temporary design-system demonstration, not the public marketing website. This is **page-scoped only** — the root layout sets no robots restriction, so it does not establish a permanent noindex policy. Public marketing indexing and page-level SEO metadata will be introduced in the public-website phase (W2+).

## Temporary wordmark status [IMPORTANT]

The kit's editable-text wordmark SVGs are templates, not final outlined custom lettering. W1 renders the supplied **symbol** plus a **temporary text wordmark** (`نكمّل` in Alexandria Bold / `Nokmel` in Geist Semibold), marked `data-wordmark="temporary"` in the DOM and documented here. It is **not** represented as the final custom wordmark. The symbol and wordmark assets still require final visual approval before production launch.

## Approved design direction [APPROVED]

- Premium minimal SaaS
- Arabic-first, full RTL support (`<html lang="ar" dir="rtl">`); English-ready architecture via `src/i18n/` (locales config + messages; no switcher exposed until English is functional)
- Mobile-first, logical CSS properties
- Light surfaces with selected dark brand sections (dark sections scope `data-theme="dark"`; no dark-mode switching system in W1)
- Clear, highly visible conversion CTA (primary CTA: اطلب الانضمام)
- Accessible interactions: visible focus ring (3px `--color-focus-ring`), ≥44px control height, keyboard operable, labels tied to inputs
- Nested Latin text/numbers are wrapped with `lang`/`dir` (`Wordmark lang="en"`, token names) so they don't inherit Arabic font/direction
- No unnecessary animations or decorative complexity
