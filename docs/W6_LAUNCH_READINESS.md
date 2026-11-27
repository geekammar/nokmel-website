# W6_LAUNCH_READINESS.md — production isolation, launch controls and gates

Last updated: 2026-11-27 (W6 engineering delivery). This is an operator/owner
handoff. It does **not** record executed Production work. The coding agent did
not connect to hosted Neon, deploy Production, change DNS, publish CMS content,
enable indexing/analytics/Telegram, rotate credentials, revoke sessions or run
recovery against the hosted owner.

The external Product/Technical Lead owns risk classification, legal/privacy
approval and final release authorization.

## 1. Distinct states (do not conflate)

| State | Meaning | Current W6 status |
|---|---|---|
| Engineering ready | Source review, fixes, tests, build and documentation complete on the exact HEAD. | Target of this delivery; see the PR/CI. |
| Hosted Development accepted | The approved Development Preview/database behavior is independently accepted. | W2-V visual accepted; earlier W3–W5 acceptances recorded. W6 hosted checks below remain external. |
| Production configured | Production Neon/env/domain/owner/migrations/content are prepared but indexing and optional integrations remain off. | **Not done.** |
| Production accepted | Independent Production smoke/security/functional acceptance completed. | **Not done.** |
| Owner-authorized launch | Owner explicitly authorizes indexing/public launch after all gates. | **Not done.** |

## 2. Verified baseline and accepted external record

- Main baseline: `53157b9e79f93cea2d9cd922072e8a49d2ce393f` (PR #11 merge of
  W2-V HEAD `b88704b604ff253b7ac63e4bf5b20e4bf7f24f73`; accepted CI run
  `46042089986`).
- Muse W2-V record at `b31e6e8`: 14 PASS, 1 PARTIAL (unavailable live mobile
  viewport emulation), 0 FAIL; mobile refinement at `b88704b`; owner physical
  Android **visual** acceptance 7/7 on 2026-11-27; external lead approved the
  final visual.
- Hosted Development: homepage published revision 55, product visual enabled,
  no pending CMS drafts; migrations `0000`–`0005` applied; no successful QA
  requests; two synthetic plans remain hidden; GA4/Telegram disabled and
  unconfigured.
- Physical Android visual acceptance is not full Production functional
  acceptance.

## 3. Production isolation requirements

Production must be independent of Development. Do not copy Development
accounts, sessions, join requests, synthetic/QA plans, drafts, private settings
or integration credentials.

**Database**

1. Use the dedicated Production Neon branch/database (for the approved
   `nokmel-website` project: production branch `br-noisy-fire-bdkl5wa4`) or a
   separately approved Production project. Never point runtime/migrations at a
   Development branch.
2. Create dedicated Production role credentials (for example
   `nokmel_prod_migrator` / `nokmel_prod_runtime`) not used by Development. If
   project-level role names are reused, the passwords and grants must still be
   Production-specific and never shared with Development.
3. Runtime uses the **pooled** Production endpoint (`-pooler`) with the runtime
   role. Migrations/provisioning use the **direct** endpoint with the migrator
   role. `DATABASE_URL_DIRECT` is operator-only and must never be configured in
   Vercel.
4. Apply migrations `0000`–`0005` from zero with `pnpm db:check` then
   `pnpm db:migrate` (direct URL). Grant the migrator temporary
   `CREATE ON DATABASE` for the run and revoke immediately afterward. Do not run
   `drizzle push`.
5. Apply the least-privilege runtime grants from `docs/DATABASE_PERMISSIONS.md`
   §3–§3e: DML only on the auth, CMS, plan/join/limiter and settings tables; no
   database/schema `CREATE`, no DDL, no `TRUNCATE`, no ownership, no
   migration-history access. Runtime must not own the database/schema/tables.
6. Do not reuse Development database credentials or data.

**Environment (Vercel Production scope only)**

| Variable | Production requirement |
|---|---|
| `DATABASE_URL` | Pooled Production runtime URL, runtime role, `sslmode=require`; secret. |
| `BETTER_AUTH_SECRET` | New ≥32-character random Production-only secret; never reused from Development/Preview. |
| `BETTER_AUTH_URL` | Exact `https://nokmel.tech` (or the approved canonical Production origin). |
| `TRUSTED_ORIGINS` | Exact Production origin(s) only (for example `https://nokmel.tech`, and `https://www.nokmel.tech` only if DNS/redirects are approved). No wildcards, paths, queries or fragments. |
| `OWNER_EMAIL` | The single Production owner identity. |
| `JOIN_INTAKE_ENABLED` | Leave unset until owner approves Production intake plus privacy/retention. |
| `GA4_*`, `TELEGRAM_*` | Leave unset until separately approved/activated. |
| `SITE_INDEXING_ENABLED` | Leave unset until the final launch step (§6); effective only with verified Vercel Production. |
| `DATABASE_URL_DIRECT` | Never in Vercel. Operator machine only. |

Preview must keep its own exact origin/secret/database configuration. Preview is
never indexable even if `SITE_INDEXING_ENABLED` is mistakenly set there.

## 4. Fresh database and privilege verification (local evidence)

Executed locally against disposable loopback PostgreSQL 18 (never hosted Neon):

- `pnpm test:db` includes `tests/integration/w6-fresh-database.test.ts`, which
  drops `public`/`drizzle`, applies all six migrations from zero and verifies:
  - all 11 approved public tables exist;
  - six migration-history entries;
  - no application sequences;
  - CMS/FAQ/plans/join/settings/limiter tables start empty (code defaults, no
    seed required);
  - owner provisioning succeeds, is idempotent for the same identity and
    refuses a second owner;
  - the credential partial unique index exists.
- `tests/integration/runtime-role.test.ts` verifies a restricted synthetic
  runtime role can perform intended DML but cannot `CREATE`, `ALTER`, `DROP` or
  `TRUNCATE`, and does not own the database/schema.
- Migration immutability: `git diff 53157b9..<W6 HEAD> -- drizzle` is empty; no
  migration was added in W6.
- Local disposable verification is not hosted pooler/grants acceptance.

## 5. Controlled content initialization (Development → Production)

Do **not** clone the Development database. Transfer only approved public
content after Production migrations/owner provisioning and a protected initial
deployment.

**Use the repository-owned utility (`pnpm content:transfer`)**

The utility exports only explicitly selected published CMS/FAQ/SEO rows,
validates them offline against the registry/content/SEO schemas, verifies an
explicit source/target identity and digest, refuses a nonempty target, and
imports transactionally with post-import readback. It never exports accounts,
sessions, credentials, plans, join requests, rate-limit data, settings or
integration configuration.

```bash
# Source URL from a silent prompt/secret store; never argv/history.
read -rsp 'Development source URL: ' CONTENT_TRANSFER_SOURCE_URL; echo
export CONTENT_TRANSFER_SOURCE_URL
pnpm content:transfer export --file /secure/w6-content.json \
  --source-identity <source-host:port/db> \
  --page home --page features --page pricing --page join \
  --page contact --page privacy --page terms --include-faq
unset CONTENT_TRANSFER_SOURCE_URL
```

Record the printed digest. Validate offline:

```bash
pnpm content:transfer validate --file /secure/w6-content.json \
  --expected-digest <sha256>
```

Target import (direct migrator connection; dry run first):

```bash
read -rsp 'Production target URL: ' CONTENT_TRANSFER_TARGET_URL; echo
export CONTENT_TRANSFER_TARGET_URL
pnpm content:transfer import --file /secure/w6-content.json \
  --target-identity <target-host:port/db> \
  --expected-digest <sha256> --dry-run
pnpm content:transfer import --file /secure/w6-content.json \
  --target-identity <target-host:port/db> \
  --expected-digest <sha256>
unset CONTENT_TRANSFER_TARGET_URL
```

The import sets `draft_payload = NULL`, `draft_revision = published_revision`
and copies published values only; FAQ draft values equal their published values
with `draft_deleted = false`. It preserves the published `showcase.visible`
value, explicit SEO/social-image selections, revisions and timestamps, and
aborts on an unexpected target or post-import digest mismatch.

**Verify after import**

- Public pages show the approved revision-55 content and product visual.
- Admin editor shows no pending drafts; publication review reports no changes.
- SEO social images/canonical/noindex still correct.
- `plans`, `join_requests`, `site_settings` remain empty unless intentionally
  configured; auth/session counts contain only the Production owner/session.

**Rollback:** create a Production Neon branch/restore point immediately before
import. The import transaction aborts on any validation error; after commit,
restore the branch/point-in-time snapshot. Do not use unscoped deletes.

## 6. Indexing release control (final launch step only)

Default state: no indexing. `robots.txt` disallows all, `sitemap.xml` is empty,
public metadata is `noindex, nofollow`, and admin/login are always noindex.

The release control requires **both** the runtime-only
`SITE_INDEXING_ENABLED` flag (`1`/`true`) **and** positive
`VERCEL_ENV=production` identification. Preview, development, missing or
unknown environment metadata always remain noindex, even if the flag is set.
Non-Vercel deployments are not supported by this release control; they would
need a separate explicit environment contract. Metadata is evaluated per
request, not from a build-time module snapshot.

**Owner-authorized procedure**

1. Complete Production configuration, content import and all Production
   acceptance gates.
2. Obtain explicit owner launch authorization (record it in the release
   evidence).
3. Set `SITE_INDEXING_ENABLED=1` in the Vercel **Production** environment only,
   and confirm the deployment has positive `VERCEL_ENV=production`. Never set
   the flag for Preview; even a mistaken flag there cannot enable indexing.
4. Redeploy Production from the approved exact commit.
5. Verify:
   - `https://nokmel.tech/robots.txt` contains `Allow: /`,
     `Disallow: /admin/`, `Disallow: /api/` and the `Sitemap:` line;
   - `https://nokmel.tech/sitemap.xml` contains exactly the seven public routes
     on `https://nokmel.tech`;
   - a public route returns `index, follow` and has no `X-Robots-Tag`;
   - `/admin/login` remains `noindex, nofollow` in both meta and
     `X-Robots-Tag`;
   - a Preview deployment of the same commit still returns
     `Disallow: /`/noindex.
6. Only then submit the sitemap in Search Console if the owner chooses.
7. DNS changes are separate and require explicit approval; they are not part of
   this procedure.

**Rollback:** remove `SITE_INDEXING_ENABLED` and redeploy (or promote the prior
Production deployment), then verify `Disallow: /` and noindex. Search-engine
deindexing is not immediate.

## 7. Hosted verification checklists (external; not executed here)

### 7.1 Authentication, sessions and recovery

Do not run recovery against the existing hosted owner, rotate credentials,
revoke hosted sessions or delete accounts.

Use a **temporary disposable Neon branch** (or another approved disposable
database) with a synthetic owner and a temporary Preview configuration:

- [ ] Public sign-up POST to `/api/auth/sign-up/email` is refused and creates no
      user row.
- [ ] Sign-in sets `__Secure-nokmel.session_token` with `HttpOnly`, `Secure`,
      `SameSite=Lax`, `Path=/` (HTTPS Preview/Production).
- [ ] Untrusted `Origin` sign-in/sign-out and unsafe `callbackURL` are rejected.
- [ ] `/admin` without a valid session redirects; a valid session reaches the
      owner shell; a non-owner session (synthetic branch only) does not.
- [ ] Five failed sign-ins per identity/minute then 429 with `X-Retry-After`;
      no permanent lockout after the window.
- [ ] Concurrent sign-in + `owner:reset-password` through the actual Neon
      **pooled** runtime endpoint: recovery waits/finishes; no old-password
      session is usable; no unintended active sessions remain.
- [ ] Confirm owner provisioning/recovery CLI requires the direct endpoint and
      never falls back to `DATABASE_URL`.
- [ ] Remove the temporary branch and synthetic Preview configuration after
      recording evidence.

### 7.2 Request identity and join intake (Development Preview only)

Use synthetic data and a disposable Preview. Do not generate traffic against
public Production.

- [ ] `GET /api/join` → 405 with `Allow: POST`.
- [ ] Untrusted browser `Origin` → 403; missing Origin (non-browser) is allowed
      only with valid security config and remains rate-limited.
- [ ] Oversized body → 413; unsupported media type → 415; invalid fields → 400
      without echoing PII.
- [ ] Same submission token twice → identical minimal `{ok:true,
      status:'received'}` and exactly one row (owner admin + DB review).
- [ ] Spoofed/multi-value `X-Forwarded-For` does not evade the limiter: Vercel
      overwrites the header; requests from the same genuine client share one
      bucket. Record actual raw headers from the external lead's authorized
      access (no public debug endpoint exists).
- [ ] Exceed the limit → 429 with `Retry-After` and a `retryAfterSeconds` body;
      after the window, the same token replays success without a duplicate.
- [ ] Stale/changed offer → 409 `plan_changed`/`plan_unavailable`; hidden plan
      is not selectable; historical snapshot is not rewritten.
- [ ] Missing/invalid secret or origin config → 503 `intake_misconfigured` and
      no row.
- [ ] Remove synthetic QA requests with `pnpm qa:cleanup-w4` exact IDs/marker
      per `docs/DATABASE_PERMISSIONS.md` §3d.

## 8. Production activation runbook (outline; executable detail in the Drive report)

1. Verify infrastructure identity (correct Neon project/branch, Vercel project
   `ammarjaberd`, repository, exact commit).
2. Prepare the Production database branch and dedicated role credentials.
3. Apply migrations `0000`–`0005` from zero; verify schema/history.
4. Apply minimum runtime grants; verify no DDL/TRUNCATE/ownership; revoke the
   temporary migrator database `CREATE`.
5. Provision the Production owner via the operator CLI (direct URL, stdin
   password; never argv).
6. Configure independent Production environment variables (separate auth
   secret, exact origins; intake/integrations/indexing off).
7. Import approved public CMS/FAQ/SEO content through the narrow validated
   procedure in §5; do not import plans/requests/settings/credentials.
8. Deploy the initial Production build with indexing/intake off. Verify the
   actual Vercel access-protection capability before promising a protected
   Production deployment: Deployment Protection commonly covers Preview, while
   Production/custom-domain protection depends on the account plan/feature. If
   supported protection is not available, the public marketing pages remain
   public (noindex is not access control) and admin remains owner-auth
   protected.
9. Configure/verify the domain and TLS only with explicit DNS approval.
10. Run Production smoke and raw HTTP checks; complete the acceptance matrix.
11. Prepare rollback (prior deployment, DB branch/restore point, content
    export backup).
12. Record explicit owner launch approval; only then execute §6 indexing and
    enable intake/integrations if separately approved.

## 9. Rollback readiness

**First-ever Production deployment (no previous READY Production deployment)**

- Stop intake: leave/unset `JOIN_INTAKE_ENABLED` and redeploy.
- Disable indexing: unset `SITE_INDEXING_ENABLED` and redeploy; verify
  `Disallow: /` and noindex.
- Remove public exposure where the approved Vercel plan actually supports
  Production access protection; otherwise treat the marketing pages as public
  until the launch gate. **Noindex is not access control.** Admin remains
  protected by owner authentication.
- Restore the Neon branch/restore point taken before migration/import. Applied
  migrations are additive/immutable; do not manually reverse them.
- If the deployment itself is bad, redeploy the known-good prelaunch baseline
  commit (the W6 base `53157b9...`) or remove the failing alias/domain routing.
  There may be no previous Production deployment to promote; do not claim one.
- Record the safe state: intake off, indexing off, no unapproved content, no
  external integrations.

**Established Production release**

- Vercel: promote the previous READY Production deployment; never force-push.
- Database: restore the pre-change branch/restore point; migrations are
  additive and immutable.
- Content: restore the pre-import snapshot/branch; the admin CMS keeps
  published values when drafts are discarded.
- Indexing: remove the flag/redeploy; verify noindex.
- Intake/integrations: unset the gate/token/measurement env and redeploy; the
  request rows remain readable by the owner; no notification rollback is
  claimed for already-sent messages.
- Document the incident/rollback evidence in the release record.

## 10. Known limitations / remaining external decisions

- Production is not configured, deployed or accepted.
- Hosted forwarded-header, pooler-lock, raw header/metadata, domain/TLS, final
  privacy/retention, physical Android **functional** acceptance (including
  NKW-W41-002 date/time editor) and launch approval remain external.
- GA4/Telegram are disabled and unconfigured; provider delivery/tracking is not
  claimed. Activation checklists are separate (`docs/W5_INTEGRATIONS.md`).
- No field Core Web Vitals or INP measurement is claimed. Lab measurements:
  launch state (product visual visible) mobile LCP ~880–1224 ms/CLS
  ~0.090–0.092, desktop LCP ~888–1252 ms/CLS ~0.019–0.024 under a local production build (Chromium, 4× CPU,
  1.6 Mbps/150 ms, median of 3). The hidden-visual fallback state measured mobile CLS
  ~0.133 (font swap); it is not the approved launch configuration.
- Full nonce-based CSP remains deferred. Production-only and full audits report
  no known vulnerabilities after Zod 4.6.7 / Vitest 4.1.12 upgrades and narrow
  PostCSS/esbuild overrides; exact advisory inventory and rationale are in
  `docs/SECURITY.md` and the Drive artifacts.
- The content-transfer utility is tested against disposable PostgreSQL only;
  hosted export/import remains external and must use the approved release
  commit and explicit target identity.
- Legal entity/address/jurisdiction/tax/contact/privacy-retention wording still
  requires owner/legal approval; nothing was invented.
