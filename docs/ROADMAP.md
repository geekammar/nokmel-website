# ROADMAP.md — Nokmel Website

Workstreams W0–W6. Each workstream ends with an external review gate before the next starts.

| ID | Name | Scope | Exit gate |
|----|------|-------|-----------|
| W0 | Project Context & Repository Setup | Repo inspection, brand kit inspection, project docs (README, AGENTS, PRODUCT_SPEC, ARCHITECTURE, DESIGN_SYSTEM, ROADMAP, CURRENT_STATE), feature branch + draft PR | External review of documentation; no code scaffolded |
| W1 | Foundation & Design System | Next.js/TS/Tailwind scaffold, design tokens from Brand Kit v2.0, RTL/i18n base, CI | Build + lint + typecheck pass; tokens traceable to brand kit files |
| W2 | Public Website | Home (with How It Works + FAQ sections), Features, Pricing, Join/Early Access, Contact, Privacy, Terms; visible CTA everywhere, mobile-first | Pages render RTL-first; CTA visible on mobile; owner review |
| W3.1 | Admin Foundation & Secure Owner Authentication | Self-hosted Better Auth (email+password, single owner, sign-up disabled server-side), Neon/Drizzle auth schema + migrations, owner provisioning CLI + recovery, admin shell + login, session security, DB-backed login rate limiting, owner-only server-side authorization | Auth integration + security + W2 regression tests green in CI; infrastructure handoff complete; external review |
| W3.2 | CMS & Content Management | Content & SEO section with predefined components, draft/publish, protected preview, homepage FAQ, mobile admin navigation; SEO metadata editing deferred to W3.3 | Content editable by the owner only; public publication without deployment; drafts never public |
| W3.3 | SEO Management | SEO metadata editing in the admin | SEO managed in admin; public metadata stays pre-launch noindex until launch approval |
| W3 | Admin & Content | Split into W3.1 (admin foundation & authentication — see above), W3.2 (CMS/content management) and W3.3 (SEO management). Join-request storage/submission is NOT in W3 — it belongs to W4 | Auth enforced on all admin routes; content editable |
| W4 | Pricing & Join Requests | Plans & Pricing admin (marketing data only), public join form **submission + join-request storage/management** (moved here from earlier W3 wording) | No billing integration; requests captured with plan/status |
| W5 | Analytics & Settings | Overview metrics (visitors, sources, pricing interest, join requests, conversion), Settings section | Metrics match event data; settings persist |
| W6 | Launch Acceptance | End-to-end acceptance, accessibility pass, performance pass, launch checklist | Owner approval; deployment only with explicit approval |

W3.1 status (2026-11-25): merged via PR #4; accepted for continued
development. Hosted W3.1 closure checks that remain are listed in
`CURRENT_STATE.md` and W6 launch gates; production readiness is not granted.

W3.2 status (2026-11-25): merged via PR #5 (accepted HEAD
`fb677dabc82f2c60a6301d862314142805fba0f8`, merge commit
`5c976db56331ba2077b4a32c1e05a580e9c5689a`) and accepted for continued
development. Additive migration `0002_w32-content-cms` is applied on hosted
development by the external lead.

W3.3 status (2026-11-25): implementation complete on
`feature/w33-seo-management` (draft PR pending independent acceptance). Adds
owner-only page-level SEO/social metadata editing for the seven existing routes
on the reused `content_sections` draft/publication model, with published-only
public metadata generation, approved social-image registry, combined publication
review, and the NKW-W32-005 FAQ final-order correction. No schema migration;
existing W3.2 records remain valid. Hosted Preview branch configuration and
independent/live acceptance remain external; production and indexing stay at W6.
Plans/join-request storage W4; analytics/settings W5; launch W6.

## Standing rules

- Never push to `main`; feature branch + draft PR per workstream; never merge without owner approval.
- Infrastructure policy: infrastructure changes may occur only within the approved phase scope and with explicit owner authorization. Development and testing resources may be provisioned when required by their phase. Production deployment, production credentials, and DNS changes require explicit approval. No infrastructure provisioning in W0.
- Pricing on the website is marketing data only (see PRODUCT_SPEC §5).
