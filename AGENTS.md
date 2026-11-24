# AGENTS.md — Nokmel Website

Operating rules for any agent working in this repository.

## Decision authority

The external technical lead and product owner control product decisions, architecture, scope, acceptance, and release approval. Implementation agents must not independently expand scope.

## Repository boundaries

- This repository is the Nokmel **marketing website** only.
- Never access or modify the Nokmel commerce platform repository.
- Never push directly to `main`; work happens on feature branches and draft pull requests.
- Never merge a pull request; never deploy, provision infrastructure, create databases, create production credentials, or modify DNS as part of routine work.

## Scope discipline

- Implement only the approved scope in `docs/PRODUCT_SPEC.md`.
- Explicitly out of scope: live demo, demo management, media library dashboard, security & activity dashboard, advanced CRM, blog, help center, marketing automation, advanced analytics, multiple admin roles, public account registration, automated subscriptions/billing, microservices, generic page builder.
- Pricing shown on the website is marketing data only. It must not control subscriptions, commerce entitlements, or merchant permissions. Authoritative pricing/entitlements belong to the Nokmel platform.

## Brand rules

- The only accepted brand reference is `Nokmel_Deep_Brand_Kit_v2.0.zip`. Use its design tokens and SVG assets as the source of truth.
- Do not use Brand Kit v1.0. Do not recreate the logo, substitute arbitrary fonts, or invent brand tokens.
- If the brand kit is unavailable in the execution environment, report the blocker explicitly. Do not guess its contents.

## Context efficiency rules (permanent)

- Read only the documentation required for the current task.
- Do not indiscriminately scan historical reports.
- Keep `docs/CURRENT_STATE.md` concise and current.
- Do not duplicate historical execution reports in repository files; execution reports live in the pull request description and are archived externally (Google Drive) by the reviewer.
- Do not read generated assets, binary files, build outputs, or dependency directories unless explicitly required.
- Prefer targeted file searches and incremental context loading.
- Never claim completion without verifiable evidence.

## Evidence rules

- Do not add fabricated evidence or claim unperformed tests.
- Distinguish approved decisions from proposals, unresolved questions, and unverified information in all documentation.
