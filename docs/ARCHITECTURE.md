# ARCHITECTURE.md — Nokmel Website

Status: technical direction **[APPROVED]** by the external technical lead (2026-11-24).

## Approved stack [APPROVED]

- Next.js App Router + TypeScript
- Tailwind CSS
- Independent Neon PostgreSQL database (separate from the Nokmel platform database)
- Drizzle ORM
- Zod validation
- Secure owner-only authentication (single owner account; no public registration, no multiple roles). The exact authentication library remains **[OPEN]** until the auth implementation phase.
- Lightweight custom CMS using predefined sections (no generic page builder)
- External analytics provider for website traffic and conversion events. The exact provider remains **[OPEN]** until the analytics implementation phase.
- Vercel deployment (account `ammarjaberd`)
- GitHub Actions for CI

## Principles

- Avoid premature abstractions and unnecessary infrastructure.
- Documentation-only in W0: no scaffolding, no infrastructure provisioning, no database creation, no credentials, no deployment, no DNS changes.

## High-level structure

```
app/
  (public)/        # Home, Features, Pricing, Join, Contact, Privacy, Terms
  (admin)/         # Overview, Content & SEO, Plans & Pricing, Requests, Settings
  api/             # join-request intake, owner-authenticated admin APIs
drizzle/           # schema + migrations (independent Neon DB)
lib/               # db client, auth, content loaders
content/           # predefined CMS sections (editable via admin, stored in DB)
```

## Data model

This website's own database stores site content, marketing plans, join requests, and settings only:

- `content_sections` — predefined homepage/page sections (key, locale, JSON body, visibility)
- `faq_items` — question/answer pairs per locale
- `plans` — marketing plan name, description, monthly price and optional yearly price, currency, features, order, visibility, CTA config. **Marketing data only; never authoritative for billing/entitlements.**
- `join_requests` — name, contact, selected plan, status (`new` / `contacted` / `closed`), notes, timestamps
- `site_settings` — website, contact, social, CTA, notification settings
- `owner_account` — owner authentication data, stored separately from general website settings

**Analytics:** website traffic and conversion events (including join-request conversion metrics) come from the external analytics provider. Do not design or implement a custom analytics pipeline; there is no first-party analytics_events table.

## Security and authorization (mandatory) [APPROVED requirement]

- Owner-only authentication for `/admin` and admin APIs; session-based with secure cookies; CSRF protection; rate limiting on join form and login.
- No public account registration. No role system.
- Join requests are public-write (rate-limited) but public-read never.
- Secrets only via environment variables; never committed.

## Pricing boundary [APPROVED]

Website-managed plans are marketing data only. They must not control subscriptions, entitlements, or merchant permissions. Authoritative pricing/entitlements remain with the Nokmel platform until commercial activation. No billing/payment integration in this phase.

## Deployment [APPROVED, future]

Vercel project under account `ammarjaberd`, linked to `geekammar/nokmel-website`; CI via GitHub Actions (lint, typecheck, build, tests on PRs). No deployment performed in W0; production deployment requires explicit approval.
