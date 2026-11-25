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

W3.2 status (2026-11-25): implemented on `feature/w32-content-management`
(draft PR). Additive migration `0002_w32-content-cms`; hosted migration and
branch-specific Preview configuration are external operator tasks. Independent
review/live acceptance and production activation remain outstanding. SEO
metadata editing is W3.3; plans/join-request storage W4; analytics/settings W5;
launch W6.

## Standing rules

- Never push to `main`; feature branch + draft PR per workstream; never merge without owner approval.
- Infrastructure policy: infrastructure changes may occur only within the approved phase scope and with explicit owner authorization. Development and testing resources may be provisioned when required by their phase. Production deployment, production credentials, and DNS changes require explicit approval. No infrastructure provisioning in W0.
- Pricing on the website is marketing data only (see PRODUCT_SPEC §5).
