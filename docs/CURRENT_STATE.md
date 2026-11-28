# CURRENT_STATE.md — Nokmel Website

Last updated: W6 focused security/operational closure, 2026-11-27.

Status: **W2-V merged/accepted. W6 focused closure on
`feature/w6-launch-readiness` (Draft PR #12) from merged `main`
`53157b9e79f93cea2d9cd922072e8a49d2ce393f`. No merge, Production deployment,
hosted mutation, DNS change, indexing/analytics/Telegram activation, credential
rotation or session revocation. Engineering readiness is not Production
approval.**

## Verified baseline and external acceptance

- **W2-V merged via PR #11.** Merge commit `53157b9e79f93cea2d9cd922072e8a49d2ce393f`;
  accepted HEAD `b88704b604ff253b7ac63e4bf5b20e4bf7f24f73`; accepted CI run
  `46042089986`. Muse 14 PASS, 1 PARTIAL (live mobile viewport), 0 FAIL at
  `b31e6e8`; `b88704b` mobile refinement; owner physical Android visual 7/7 on
  2026-11-27; external lead approved final visual.
- **W2-S/W5/W4.1/W4/W3 baselines** remain merged/accepted as previously recorded.
- Hosted Development (external): migrations `0000`–`0005` applied; homepage
  revision 55 with product visual enabled; no pending CMS drafts; no successful
  QA requests; two synthetic plans hidden; GA4/Telegram disabled/unconfigured.

## W6 focused closure (R01–R08)

- **R01 dependencies:** separate production-only and full `pnpm audit` now
  report **no known vulnerabilities**. Zod 3.25.76 → 4.6.7 (single version,
  required_error→error source adjustment); Vitest 3.2.7 → 4.1.12; narrow pnpm
  overrides `next@15.5.29>postcss=8.5.33` and
  `@esbuild-kit/core-utils>esbuild=0.25.12`. Zod advisory mechanism (unbounded
  array issue accumulation) was checked against public join validation (no
  array fields, 16 KiB streaming limit) and Better Auth (already on 4.6.7).
  Exact advisory inventory is in the Drive artifact.
- **R02 recovery-lock boundary:** deterministic test terminates the dedicated
  lock backend during sign-in; the guard commit fails, no response/cookie is
  delivered, no usable old-password session remains after recovery, and orphan
  sessions are removed. Hosted pooler verification remains external.
- **R03 Telegram verification:** enabling automatic delivery now requires a
  recorded successful-test bot identity for the current destination; destination
  changes clear identity and require a new test. A numeric chat ID alone is
  refused server-side. Token/identity rotation is documented as requiring a new
  test because existing storage cannot fingerprint the env token without a
  migration. Telegram remains disabled/unconfigured.
- **R04 indexing:** metadata/robots/sitemap use one runtime policy requiring
  **both** `SITE_INDEXING_ENABLED` and positive `VERCEL_ENV=production`.
  Preview, development, missing/unknown environment metadata always remain
  noindex. Metadata is evaluated per request, not from a module snapshot.
  Production-build HTTP checks confirmed all cases; admin is noindex in every
  case. Hosted indexing remains off.
- **R05 content transfer:** repository utility `pnpm content:transfer` supports
  read-only export, offline strict validation/digest, dry run, explicit
  source/target identity, nonempty-target refusal, transactional import and
  post-import readback. It preserves published `showcase.visible`/SEO values and
  creates no drafts. Tested export→validate→import→readback and rejection paths
  on disposable PostgreSQL. No hosted connection.
- **R06 runbook:** corrected to require the externally approved exact release
  commit at execution time (no historical SHA), secure hidden password input,
  direct operator connections, temporary grant/revoke, distinct Production
  credentials/secrets, the content utility, Vercel access-protection limits and
  separate first-ever vs established-release rollback.
- **R07 content handoff:** NKW-W2S-001 closed by published W2-V revision 55;
  exact proposed CMS wording prepared for NKW-W2S-002 (planned AI/future
  capability in past/planned tense) and NKW-W2S-003 (conditional early-access
  pricing without promised prices/purchase). Nothing published.
- **R08 preservation:** W2-V design, seven public routes, five admin sections,
  CMS/pricing/join semantics, approved social default, release identity,
  disabled integrations and immutable migrations `0000`–`0005` are preserved.
  No new commercial feature or redesign.

## Remaining external gates

- Hosted Development raw metadata/headers, forwarded-identity/429 behavior.
- Auth recovery/pooler concurrency on a disposable hosted branch (never the real
  owner).
- Production Neon isolation/roles/migration/owner/env/content/domain/TLS.
- Legal/privacy/contact/commercial approval; NKW-W2S-002/003 copy approval.
- Optional GA4/Telegram activation/provider verification.
- Physical Android functional acceptance incl. NKW-W41-002.
- Final owner-authorized indexing launch and explicit release approval.
- Merge and any Production deployment remain explicitly out of scope.

## Verification (local, focused-closure HEAD)

- Unit **314/314**; PostgreSQL integration **205/205** on disposable loopback
  PostgreSQL 18; Playwright **121/121** against packaged `next start` with
  disposable DB and loopback GA4/Telegram stubs.
- `pnpm lint`, `pnpm typecheck`, `pnpm db:check`, `pnpm build` pass.
- `pnpm audit --prod` and `pnpm audit`: **no known vulnerabilities**.
- Production-build indexing matrix: flag absent/false, Preview/development/
  missing/unknown env → noindex + disallow + zero sitemap URLs; Production + flag
  → index/allow + seven sitemap URLs; admin noindex/X-Robots-Tag in every case.
- Lab performance (production build, visual visible): mobile LCP ~880–1224 ms,
  CLS ~0.090–0.092; desktop LCP ~888–1252 ms, CLS ~0.019–0.024 (4× CPU,
  1.6 Mbps/150 ms, median of 3). Hidden-visual fallback CLS ~0.133. Lab only;
  no field CWV/INP claim.
- Exact remote CI on the final HEAD and Draft PR recorded in the PR/handoff.

## Historical one-liners

- **W2-V:** merged/accepted product-led homepage visual.
- **W2-S:** merged/accepted design refinement and showcase removal.
- **W5:** merged/accepted Overview, GA4 adapter/consent, Telegram notifications,
  typed settings. Migration 0005.
- **W4.1/W4/W3.3/W3.2/W3.1/W2/W1/W0:** merged baselines.
