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
| W4.1 | Scheduled Promotional Pricing | One optional scheduled marketing discount per plan (percentage/fixed, monthly/yearly/both), draft/published lifecycle, owner preview, shared effective-offer resolver/version, stale-offer recovery, expanded historical offer snapshot | No billing effect; real PostgreSQL + browser coverage; hosted activation/acceptance external |
| W5 | Analytics & Settings | Business Overview from authoritative join requests plus optional Google Analytics 4 aggregates; owner Telegram notifications; typed website settings; NKW-W41-001 correction | Database metrics match accepted requests; unavailable analytics is honest; settings persist with owner-only privacy boundaries |
| W6 | Launch Acceptance | End-to-end acceptance, accessibility pass, performance pass, launch checklist | Owner approval; deployment only with explicit approval |

W3.1 status (2026-11-25): merged via PR #4; accepted for continued
development. Hosted W3.1 closure checks that remain are listed in
`CURRENT_STATE.md` and W6 launch gates; production readiness is not granted.

W3.2 status (2026-11-25): merged via PR #5 (accepted HEAD
`fb677dabc82f2c60a6301d862314142805fba0f8`, merge commit
`5c976db56331ba2077b4a32c1e05a580e9c5689a`) and accepted for continued
development. Additive migration `0002_w32-content-cms` is applied on hosted
development by the external lead.

W3.3 status (2026-11-25): merged via PR #6 and accepted for continued
development (accepted HEAD `dcf1f8d9ede739a29bd48d036df1a1d5cd9f28bf`, merge
commit `0020ddacdd54b3c23471b58b17b54fda1c1a0ae1`). No schema migration.

W4 status (2026-11-26): **CONDITIONAL ACCEPT for Preview** after hosted
Development activation and independent live acceptance (22 cases: 17 PASS,
4 PARTIAL, 1 BLOCKED, 0 FAIL). Authorized alias resolves to configured
deployment `dpl_5Qz8bZ3SUCFoFjQ7rbB5VYcR5crc`, READY, exact expected HEAD.
Migration `0003_w4-plans-join-requests` is applied on hosted Development. The
final product-consistency closure addresses NKW-W4-001 source attribution,
NKW-W4-002 owner FAQ correction, NKW-W4-003 snapshot limitation wording,
NKW-W4-004 recovery-option synchronization and NKW-W4-005 requested-plan notice
with no migration/grant change. Focused hosted retest, raw hosted metadata,
forwarded-header/security evidence, physical Android acceptance, final
privacy/retention approval and explicit launch approval remain external.
NKW-W33-001 labels corrected; NKW-W33-002 revision behavior preserved.
Analytics/settings remain W5; launch W6.

W4.1 status (2026-11-26): **merged and accepted for continued development**
via PR #8 (accepted HEAD
`7d33ab734cc84cb51f17d67aa972390559c71e86`, merge commit
`d50f7d555859b5f0ee4dc5b7075127f9e02eafde`). Additive migration
`0004_w41-scheduled-promotional-pricing` added draft/published promotion JSONB
and an immutable historical offer snapshot. Final local verification was unit
210/210, PostgreSQL 160/160 and Playwright 101/101; all three remote CI jobs
passed. Independent live acceptance: 18 PASS, 0 FAIL, 0 PARTIAL, 0 BLOCKED.
The authorized QA cleanup removed exactly three synthetic requests and
table-content hashes confirmed plans/CMS/FAQ/auth/sessions unchanged.
NKW-W4-006 is closed and FAQ Q6 preserved. Hosted Production activation and W6
launch gates remain external.

W5 status (2026-11-26): implemented on
`feature/w5-analytics-notifications-settings` from merged W4.1 `main`
(`d50f7d555859b5f0ee4dc5b7075127f9e02eafde`). Additive migration
`0005_w5-settings-notifications` adds typed `site_settings` and durable
per-request notification state, with no analytics-events table. The database
Overview, GA4 adapter/consent gate, optional owner Telegram notifications,
owner-only settings and the NKW-W41-001 correction are implemented. Local
unit 267/267, PostgreSQL 180/180 and Playwright 111/111 pass; exact CI is
checked on the final HEAD. Hosted migration 0005, runtime grant, Preview
configuration, GA4/Telegram external activation and independent acceptance
remain external. NKW-W41-002 stays deferred to physical Android evaluation in
W6. Production readiness is not claimed.

## Standing rules

- Never push to `main`; feature branch + draft PR per workstream; never merge without owner approval.
- Infrastructure policy: infrastructure changes may occur only within the approved phase scope and with explicit owner authorization. Development and testing resources may be provisioned when required by their phase. Production deployment, production credentials, and DNS changes require explicit approval. No infrastructure provisioning in W0.
- Pricing on the website is marketing data only (see PRODUCT_SPEC §5).
