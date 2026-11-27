# CURRENT_STATE.md — Nokmel Website

Last updated: W6 launch-readiness engineering delivery, 2026-11-27.

Status: **W2-V merged/accepted. W6 engineering delivery on
`feature/w6-launch-readiness` from `main` `53157b9e79f93cea2d9cd922072e8a49d2ce393f`.
No merge, no Production deployment, no hosted mutation, no indexing/analytics/
Telegram activation. Engineering readiness is not Production approval.**

## Verified baseline and external acceptance

- **W2-V merged via PR #11.** Merge commit `53157b9e79f93cea2d9cd922072e8a49d2ce393f`;
  accepted W2-V HEAD `b88704b604ff253b7ac63e4bf5b20e4bf7f24f73`; accepted CI run
  `46042089986`. Muse recorded 14 PASS, 1 PARTIAL (unavailable live mobile
  viewport emulation), 0 FAIL at `b31e6e8`; the mobile visual-balance refinement
  at `b88704b` was then accepted. Owner physical Android **visual** acceptance:
  7/7 on 2026-11-27. External lead approved the final visual implementation.
- **W2-S merged/accepted** via PR #10 (merge `f1aeb5c04ee6660d149d492bf2bb5c2d7f3704d7`,
  accepted HEAD `dd71987cce35e3cf1981e42f87b638e3bcdbbdc3`).
- **W5 merged/accepted** via PR #9 (accepted HEAD `5fceb8e97036dfc9c2aa6ec33a03921442257295`,
  merge `4f32b94ac6943f61e96f58014672d25eaa37968e`; independent acceptance 20/20).
  W4.1/W4/W3 baselines remain merged.
- Hosted Development (external record): migrations `0000`–`0005` applied;
  homepage published revision 55 with product visual enabled; no pending CMS
  drafts; no successful QA requests; two synthetic plans remain hidden; GA4 and
  Telegram disabled/unconfigured.

## W6 implemented scope

- **Security review (W6-B01):** source review of admin pages/actions, auth/join
  APIs, sessions/cookies, origins/CSRF, rate limits, validation, body limits,
  error responses, secrets, public/private projections, SQL safety, response
  headers and dependency advisories. Fixed evidence-backed findings: baseline
  security headers/partial CSP, launch-safe admin metadata, and the Telegram
  destination-verification race. Remaining accepted risks are recorded in
  `docs/SECURITY.md`; no Critical/High launch-blocking defect was confirmed.
- **Auth/recovery (W6-B02):** public sign-up remains server-disabled; one owner;
  server-side owner authorization on every admin page/action/preview; hardened
  session cookies; database-backed login limit; transaction-scoped recovery
  lock and session invalidation. Hosted pooler concurrency/recovery remains an
  external disposable-branch checklist; recovery was not run against the hosted
  owner.
- **Identity/join intake (W6-B03):** exact origin policy, Vercel-overwritten
  forwarded identity, durable HMAC rate limit, 429/`Retry-After`, streaming
  16 KiB body limit, exact-token replay, stale/hidden plan rejection, historical
  snapshots and fail-closed behavior reviewed; added route tests for streaming
  limits and spoofed forwarded chains. Hosted raw-HTTP checks remain external.
- **Release identity (W6-B04):** protected Settings now shows read-only app
  version, Git commit SHA, runtime environment and deployment identifier from
  trusted build/runtime metadata, with honest unavailable states. NKW-W5-004
  closed.
- **Production isolation (W6-B05):** fresh disposable PostgreSQL from migration
  zero verified (11 tables, six migrations, no sequences, no seed, owner
  provisioning compatible); runtime least-privilege verified. Production
  requirements and controlled content transfer documented in
  `docs/W6_LAUNCH_READINESS.md`. No hosted database touched; no migration added.
- **Approved social asset (W6-A01):** `social-card-1200x630`
  (`public/brand/social/nokmel-social-card-1200x630.png`, 1200×630) is the
  code-controlled default social image. Explicit published CMS SEO image
  selections still override it. No hosted SEO publication.
- **SEO/launch controls (W6-B06):** runtime-only `SITE_INDEXING_ENABLED` release
  flag; default noindex; Preview/development always noindex; `/admin` always
  noindex (`meta` + `X-Robots-Tag`); dynamic `robots.txt`/`sitemap.xml` from one
  gate; seven canonical routes on `nokmel.tech`. Indexing is off.
- **Content preparation (W6-A02):** no invented legal/contact/commercial claims.
  Approved headline/tagline remain in code defaults; hosted revision-55 content
  preserved. CMS/legal/contact handoff is recorded in the W6 Drive report.
- **External integrations (W6-B07):** GA4 remains disabled/unconfigured;
  consent/allowlist/sanitization/admin exclusion reviewed. Telegram remains
  disabled/unconfigured; the destination-change-during-test race is fixed with
  re-check + compare-and-set verification. Provider delivery/tracking not
  claimed.
- **Performance/accessibility (W6-B08):** keyboard/focus, mobile menu, FAQ,
  labels/errors, RTL, overflow and reduced motion checked. Production-build lab
  measurements with the approved visual visible: mobile LCP ~828–904 ms, CLS
  ~0.090–0.094; desktop LCP ~820–868 ms, CLS ~0.019–0.024 (local production build, Chromium, 4× CPU,
  1.6 Mbps/150 ms, median of 3). Hidden-visual fallback measured mobile CLS ~0.133 (font swap);
  launch state is the visible configuration. No field CWV/INP claim.

## Verification (local, exact W6 HEAD)

- Unit **310/310**; PostgreSQL integration **198/198** on disposable loopback
  PostgreSQL 18; Playwright **121/121** against packaged `next start` servers
  with a disposable database and loopback GA4/Telegram stubs.
- `pnpm lint`, `pnpm typecheck`, `pnpm db:check` and `pnpm build` pass; First
  Load JS 104 kB (home). Product assets ~16.3 kB. `pnpm audit`: 11 advisories
  (2 critical dev-tool Tinypool, 3 high build-time PostCSS/Zod runtime, 6
  moderate); rationale/limitations in `docs/SECURITY.md`.
- Exact remote CI on the final HEAD and the Draft PR are recorded in the
  PR/handoff. Physical Android functional acceptance is not claimed.

## Remaining external gates

- Hosted Development raw HTTP/metadata/header evidence, genuine forwarded-header
  and 429/`Retry-After` behavior (Development Preview only).
- Auth recovery/pooler concurrency on a disposable hosted branch (never the
  existing owner).
- Production Neon isolation, roles/grants, migration from zero, owner
  provisioning, independent env, narrow content import, domain/TLS.
- Final privacy/consent/retention and legal/contact/social content approval.
- Optional GA4/Telegram activation and provider verification, if approved later.
- Physical Android functional acceptance, including the deferred NKW-W41-002
  date/time editor issue.
- Final owner-authorized indexing launch and explicit release approval.
- Merge and any Production deployment are explicitly outside this delivery.

## Historical one-liners

- **W2-V:** merged/accepted; static product-led homepage visual, CMS visibility,
  market-fixture guard, mobile balance and verified merchant composition.
- **W2-S:** merged/accepted; design refinement and removal of the rejected
  interactive showcase.
- **W5:** merged/accepted; database Overview, GA4 adapter/reversible consent,
  Telegram notifications, typed settings. Migration 0005.
- **W4.1:** merged/accepted; Cairo-scheduled promotion, shared resolver/version,
  immutable snapshots. Migration 0004.
- **W4:** merged; marketing plans, public pricing, fail-closed/idempotent join
  intake, owner requests. Migration 0003.
- **W3.3/W3.2/W3.1/W2/W1/W0:** merged; SEO, CMS, owner auth, seven RTL routes,
  brand tokens and documentation foundation.
