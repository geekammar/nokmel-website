# ROADMAP.md — Nokmel Website

Workstreams W0–W6. Each workstream ends with an external review gate before the next starts.

| ID | Name | Scope | Exit gate |
|----|------|-------|-----------|
| W0 | Project Context & Repository Setup | Repo inspection, brand kit inspection, project docs (README, AGENTS, PRODUCT_SPEC, ARCHITECTURE, DESIGN_SYSTEM, ROADMAP, CURRENT_STATE), feature branch + draft PR | External review of documentation; no code scaffolded |
| W1 | Foundation & Design System | Next.js/TS/Tailwind scaffold, design tokens from Brand Kit v2.0, RTL/i18n base, CI | Build + lint + typecheck pass; tokens traceable to brand kit files |
| W2 | Public Website | Home (with How It Works + FAQ sections), Features, Pricing, Join/Early Access, Contact, Privacy, Terms; visible CTA everywhere, mobile-first | Pages render RTL-first; CTA visible on mobile; owner review |
| W3 | Admin & Content | Owner-only auth, admin shell, Content & SEO section with predefined components, join-request storage | Auth enforced on all admin routes; content editable |
| W4 | Pricing & Join Requests | Plans & Pricing admin (marketing data only), Join form → Requests list | No billing integration; requests captured with plan/status |
| W5 | Analytics & Settings | Overview metrics (visitors, sources, pricing interest, join requests, conversion), Settings section | Metrics match event data; settings persist |
| W6 | Launch Acceptance | End-to-end acceptance, accessibility pass, performance pass, launch checklist | Owner approval; deployment only with explicit approval |

## Standing rules

- Never push to `main`; feature branch + draft PR per workstream; never merge without owner approval.
- No deployment, DB provisioning, credentials, or DNS changes except at W6 with explicit approval.
- Pricing on the website is marketing data only (see PRODUCT_SPEC §5).
