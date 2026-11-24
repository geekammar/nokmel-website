# DESIGN_SYSTEM.md — Nokmel Website

## Brand source of truth — BLOCKED

The only accepted brand reference is **`Nokmel_Deep_Brand_Kit_v2.0.zip`**.

- **Status: NOT INSPECTED.** The archive was not present in the execution environment during W0 (not in the sandbox filesystem; not found via GitHub code search on 2026-11-24). Per project rules, its contents are **not guessed**: no colors, typography, logos, or design tokens are asserted here until the actual files are inspected.
- Brand Kit v1.0 must not be used.
- Do not recreate the logo, substitute arbitrary fonts, or invent brand tokens. Use only the supplied design tokens and SVG assets from v2.0.

## Approved design direction [APPROVED]

- Premium minimal SaaS
- Arabic-first, full RTL support; English-ready architecture
- Mobile-first
- Clean typography, generous spacing
- Light surfaces with selected dark brand sections
- Clear, highly visible conversion CTAs (primary CTA: Request to Join / اطلب الانضمام — see PRODUCT_SPEC)
- Accessible interactions
- No unnecessary animations or decorative complexity

## Working copy [PROPOSAL — subject to owner approval]

- Marketing headline: متجرك في المحادثة. وبزنسك في مكان واحد.
- Brand tagline: خلي بزنسك يكمل.

## Rules for implementation (W1+)

1. W1 must extract tokens (colors, type scale, spacing, radii, shadows) from Brand Kit v2.0 files into Tailwind/CSS variables — never hand-invented values.
2. Logo and icons: use supplied SVG assets only.
3. RTL is the default direction (`dir="rtl"`, Arabic locale first); English-ready via locale switching.
4. When the brand kit becomes available, this document must be updated from the actual files with evidence (file names + extracted token values).
