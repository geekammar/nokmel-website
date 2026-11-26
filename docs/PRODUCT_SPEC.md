# PRODUCT_SPEC.md — Nokmel Website

Status legend: **[APPROVED]** = decided by technical lead / product owner. **[PROPOSAL]** = proposed, needs approval. **[OPEN]** = unresolved question. **[UNVERIFIED]** = stated but not yet verified.

## 1. Product objective [APPROVED]

Build a simple, professional, mobile-first SaaS marketing website with a lightweight owner-only administration dashboard. Primary business objective: convert interested merchants into early-access applicants and, later, paying subscribers. Start simple, design for change, scale only when necessary.

## 2. Repository and environment [APPROVED]

- Repository: `geekammar/nokmel-website` (id 1470006851), default branch `main`. **[VERIFIED 2026-11-24]** — delivered via branch `vibe/w0-project-context-65bf39` and draft PR #1.
- Target domain: `nokmel.tech`
- Future hosting: Vercel, account `ammarjaberd`
- Separate marketing website; the Nokmel commerce platform repository must not be accessed or modified.

## 3. Public website scope [APPROVED]

Pages:
1. Home / Landing Page (includes How It Works and FAQ as homepage sections, not separate pages)
2. Features
3. Pricing
4. Join / Early Access
5. Contact
6. Privacy Policy
7. Terms of Service

- Primary CTA: **Request to Join (اطلب الانضمام)** — highly visible throughout, especially on mobile.
- No demo or demo page.

## 4. Admin scope [APPROVED]

Exactly five primary sections:
1. **Overview** — essential visitor analytics, traffic sources, pricing-page interest, join requests, conversion metrics.
2. **Content & SEO** — editable page content, images, predefined sections, FAQ, and page-level editable SEO metadata (titles, descriptions, social sharing metadata per page).
3. **Plans & Pricing** — owner-managed marketing plans: immutable URL-safe slug, name, short description, ordered features, optional monthly and yearly prices in an explicit supported currency (or an honest unannounced-price state), display order, draft/publish/hide visibility, optional featured flag and editable early-access CTA. New plans are unpublished by default; editing a live plan never changes the public offer before explicit publication.
4. **Requests** — owner-only join-request list/detail: name, normalized phone, optional email/business activity, optional selected plan, server-generated historical offer snapshot, acquisition source, status (`new` / `contacted` / `closed`), optional internal notes, filters, bounded pagination, search. Public submissions are write-only and always start as `new`.
5. **Settings** — website, contact, social, CTA, notification, and owner account settings. Owner authentication data is stored separately from general website settings.

Lightweight CMS with predefined components only. No generic website builder.

## 5. Pricing boundary [APPROVED]

- Website-managed plan offers are marketing data only during early access. Published marketing plans may be displayed on `/pricing` and selected from `/join?plan=<slug>`; this is lead intake, not merchant registration, checkout or a commercial subscription.
- A plan price may be absent (`NULL`, displayed as announced later) or explicitly zero; prices are exact integer minor units and are never used for billing or entitlement calculations.
- Early-access join intake is controlled by a fail-closed server environment gate (`JOIN_INTAKE_ENABLED`). W4 enables it only for the authorized isolated development Preview; Production intake and the approved privacy/retention policy remain W6 launch prerequisites.
- They must not control actual subscriptions, commerce entitlements, or merchant permissions.
- Before commercial subscription activation, authoritative pricing and entitlement ownership belong to the Nokmel platform.
- No billing or payment processing in this phase. No invented or approved commercial prices.
- Commercial purchasing must not be enabled until the authoritative platform pricing and subscription flow are ready.

## 6. Brand identity [APPROVED reference / VERIFIED artifact]

- Only accepted reference: `Nokmel_Deep_Brand_Kit_v2.0.zip`. **[VERIFIED 2026-11-24 in the execution environment — archive SHA-256 `7c04840fc335daff52048f27b13ff3ac1e0159a3dc0d9299fbe8bf55b6931ff9`, independently confirmed by the external reviewer; see DESIGN_SYSTEM.md]**
- Do not use Brand Kit v1.0; do not recreate the logo, substitute fonts, or invent tokens.
- Working marketing headline (subject to owner approval) [PROPOSAL]: متجرك في المحادثة. وبزنسك في مكان واحد.
- Working brand tagline [PROPOSAL]: خلي بزنسك يكمل.

## 7. Design direction [APPROVED]

Premium minimal SaaS; Arabic-first with full RTL; English-ready architecture; mobile-first; clean typography and generous spacing; light surfaces with selected dark brand sections; clear, highly visible conversion CTAs; accessible interactions; no unnecessary animations or decorative complexity.

## 8. Explicitly out of scope [APPROVED]

Live demo, demo management, media library dashboard, security & activity dashboard, advanced CRM, blog, help center, marketing automation, advanced analytics, multiple admin roles, public account registration, automated subscriptions and billing, microservices, generic page builder. Security and authorization remain mandatory even without a dedicated security dashboard.

## 9. Acceptance gates per workstream

- W0: docs present, branch + draft PR exist, scope/boundaries documented. Gate: external review of docs.
- W1: foundation builds; design tokens derived from Brand Kit v2.0 only.
- W2: all approved public pages render RTL-first, mobile-first, with visible CTA.
- W3: owner-only admin auth works; content/SEO editable via predefined components.
- W4: plans editable as marketing data only; join requests captured and listed. Implemented on `feature/w4-plans-join-requests` with additive migration `0003_w4-plans-join-requests`; hosted activation and independent acceptance remain external. No billing/payment/entitlement code.
- W5: overview analytics and settings functional.
- W6: launch acceptance by owner; no deployment without explicit approval.

## 10. Open questions [OPEN]

- ~~Delivery of `Nokmel_Deep_Brand_Kit_v2.0.zip`~~ — **RESOLVED 2026-11-24**: supplied and verified (SHA-256 match); W1 prerequisite met.
- Final approval of headline/tagline copy.
- Choice of authentication library (decided at the auth implementation phase) and external analytics provider (decided at the analytics phase).
