# ARCHITECTURE.md — Nokmel Website

Status: **[PROPOSAL]** for the technical stack — report meaningful concerns before changing it.

## Proposed stack [PROPOSAL]

- Next.js + TypeScript
- Tailwind CSS
- Independent Neon PostgreSQL database (separate from the Nokmel platform database)
- Drizzle ORM
- Secure owner-only authentication (single owner account; no public registration, no multiple roles)
- Vercel deployment (future; account `ammarjaberd`)
- GitHub Actions for CI
- Lightweight external analytics

## Principles

- Avoid premature abstractions and unnecessary infrastructure.
- Documentation-only in W0: no scaffolding, no infrastructure provisioning, no database creation, no credentials, no deployment, no DNS changes.

## High-level structure [PROPOSAL]

```
app/
  (public)/        # Home, Features, Pricing, Join, Contact, Privacy, Terms
  (admin)/         # Overview, Content & SEO, Plans & Pricing, Requests, Settings
  api/             # join-request intake, owner-authenticated admin APIs
drizzle/           # schema + migrations (independent Neon DB)
lib/               # db client, auth, analytics, content loaders
content/           # predefined CMS sections (editable via admin, stored in DB)
```

## Data model (marketing-only) [PROPOSAL]

- `content_sections` — predefined homepage/page sections (key, locale, JSON body, visibility)
- `faq_items` — question/answer pairs per locale
- `plans` — marketing plan name, description, price, currency, features, order, visibility, CTA config. **Marketing data only; never authoritative for billing/entitlements.**
- `join_requests` — name, contact, selected plan, status, notes, timestamps
- `site_settings` — website, contact, social, CTA, notification, owner account settings
- `analytics_events` — lightweight first-party event log feeding the Overview section (plus optional external analytics)

## Security and authorization (mandatory) [APPROVED requirement]

- Owner-only authentication for `/admin` and admin APIs; session-based with secure cookies; CSRF protection; rate limiting on join form and login.
- No public account registration. No role system.
- Join requests are public-write (rate-limited) but public-read never.
- Secrets only via environment variables; never committed.

## Pricing boundary [APPROVED]

Website-managed plans are marketing data only. They must not control subscriptions, entitlements, or merchant permissions. Authoritative pricing/entitlements remain with the Nokmel platform until commercial activation. No billing/payment integration in this phase.

## Deployment [PROPOSAL, future]

Vercel project linked to `geekammar/nokmel-website`; CI via GitHub Actions (lint, typecheck, build, tests on PRs). No deployment performed in W0.
