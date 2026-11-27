# SECURITY.md — Nokmel Website

Last reviewed: W6 launch readiness, 2026-11-27. Source review covered the
actual implementation on `feature/w6-launch-readiness` from merged `main`
`53157b9e79f93cea2d9cd922072e8a49d2ce393f` (PR #11). This document records
engineering findings and accepted residual risk; it is not a Production
security certification. External/hosted checks remain owner/lead actions.

## 1. Review scope

- All `/admin` pages, protected previews and server actions.
- `/api/auth/[...all]` and `/api/join` route handlers.
- Owner authentication, provisioning/recovery, sessions, cookies, origins and
  CSRF controls.
- Login and join-intake rate limiting, request identity, body limits,
  idempotency and controlled errors.
- Secret handling, public/private data projection, SQL construction, logging,
  response headers and dependency advisories.

## 2. Findings register

Severity reflects the actual launch configuration (public marketing site,
owner-only admin, GA4/Telegram disabled). No Critical or High launch-blocking
defect was confirmed. Fixed items are included so the review trail is explicit.

| ID | Severity | Finding | Evidence / affected source | Impact | Disposition |
|---|---|---|---|---|---|
| W6-S01 | Medium | Baseline security response headers were absent (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, framing CSP). | `next.config.ts` previously configured no `headers()`. | Clickjacking, MIME-sniffing and referrer-leak hardening missing. | **Fixed** in W6: global headers plus a partial CSP (`frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`), `X-Robots-Tag`/`Cache-Control: no-store` for `/admin/*`, and `poweredByHeader: false`. Verified by Playwright. |
| W6-S02 | Low | No script/style-source Content-Security-Policy. | `next.config.ts`; Next.js inline bootstrap and optional GA4 tag. | No CSP mitigation if an injection defect is later introduced. | **Accepted residual** for launch. A nonce-based CSP needs Next/GA4 integration and real-provider testing; it is not a speculative W6 rewrite. Existing XSS surface is low: React escaping, no `dangerouslySetInnerHTML`, strict CMS/SEO schemas and plain-text rendering. |
| W6-S03 | Medium | The pre-launch indexing helper was applied to admin/login metadata too; enabling public indexing at launch would also have marked protected pages indexable. | `src/lib/seo.ts`, admin/login pages. | Search-engine exposure of admin/login URLs after launch (not a data-access bypass). | **Fixed**: `robotsForPath()` always returns `noindex, nofollow` for `/admin`, independent of the launch flag; `/admin/:path*` also receives `X-Robots-Tag: noindex, nofollow`. Unit + Playwright coverage. |
| W6-S04 | Medium | A Telegram destination saved while an owner test was in flight could be recorded as verified even though the test message was sent to the previous destination. | `src/lib/settings/service.ts` (`recordTelegramBotIdentity`), `src/lib/notifications/service.ts` (`sendOwnerTestNotification`). | The owner could trust an unverified new destination; notifications might go to the wrong (owner-entered) chat. Notification content excludes customer PII. | **Fixed**: destination is re-read after `getMe` and before sending; identity recording is a compare-and-set on the tested chat ID. A concurrent change returns `configuration_changed`, shows an explicit message and records no verification. PostgreSQL integration test covers both race windows. |
| W6-S05 | Low | Test-before-enable is documented and prompted in the UI, but the server only requires a numeric destination before enabling automatic notifications. | `src/lib/settings/model.ts`, `src/lib/settings/service.ts`, `SettingsForms.tsx`. | An owner can enable delivery to an untested destination; failures are observable but not silent data exposure. Owner-only setting. | **Accepted residual**; operational checklist requires a successful test first. Enforcing a verification token would change accepted W5 semantics and is deferred. |
| W6-S06 | Low / Informational | Owner-credential lock connection loss during sign-in. The advisory lock uses a dedicated connection while Better Auth writes through the runtime pool. | `src/lib/owner-credential-lock.ts`, `docs/ARCHITECTURE.md` W3.1. | If the lock connection dies mid-handler, the lock is released while the handler may still create a session row. The route's commit then fails, so the response (and `Set-Cookie`) is never delivered; recovery deletes owner sessions. No usable old-password session is delivered; an orphan session row is possible. | **Accepted residual**. The deterministic local race tests cover the intended guarded path; Neon pooler behavior remains a hosted verification gate. Do not claim hosted pooler concurrency acceptance from disposable local PostgreSQL. |
| W6-S07 | Low | `/api/join` accepts a request with no `Origin` when security configuration is valid. | `src/lib/join/request-context.ts`, `src/app/api/join/route.ts`. | Non-browser clients can submit directly; this is not browser CSRF. The request is still HMAC rate-limited and validated. | **Accepted trade-off**, documented for W4 and unchanged. Browser origins are matched exactly; untrusted/cross-site origins are rejected. |
| W6-S08 | Low | Multi-value, malformed or missing `X-Forwarded-For` resolves to one shared rate-limit bucket. | `src/lib/join/request-context.ts`, `src/lib/auth.ts`, integration tests. | An attacker can exhaust the shared bucket (availability), but cannot spoof another client's identity or trust the leftmost value. | **Accepted residual**; Vercel overwrites `X-Forwarded-For`. Hosted forwarded-header behavior is an explicit external checklist item. |
| W6-S09 | Medium (aggregate) | Dependency advisories: 2 critical (Tinypool via Vitest), 3 high (Next-bundled PostCSS build-time; Zod runtime), 6 moderate (PostCSS/dev tooling). | `pnpm-lock.yaml`; `pnpm audit` on the W6 HEAD. | Tinypool/RCE is confined to the local/CI test runner; PostCSS findings are build-time with trusted repository CSS; Zod memory-exhaustion requires oversized constrained collections, mitigated by the 16 KiB join body limit, strict max lengths and owner-only admin actions. No confirmed runtime exploit path. | **Accepted for launch, documented**. Avoided a major Zod 4 / Vitest 4+ upgrade in W6; revisit under a dedicated dependency-upgrade task with full regression. |
| W6-S10 | Informational | Next.js default server-action body limit (1 MB) is used for owner-only mutations; no custom limit is set. | Server actions in `src/app/(admin)`. | Owner-authenticated only; all payloads are schema-validated with size limits. | No change. |

## 3. Verified controls (implementation evidence)

- **Owner-only authorization:** every admin page, protected preview and
  server action independently calls `requireOwner()`/`getOwnerSession()`.
  Middleware is only an optimistic cookie-presence redirect and is not the
  security boundary. `src/lib/owner.ts`, `src/app/(admin)`, `src/middleware.ts`.
- **Public sign-up:** disabled server-side (`disableSignUp: true`); direct
  registration creates nothing. Verified by PostgreSQL integration and
  Playwright tests.
- **Single owner:** provisioning refuses a second credential user, inconsistent
  account links, duplicate credentials or unusable hashes; a partial unique
  index is defense in depth. `src/lib/admin-provisioning.ts`, migration 0001.
- **Sessions/cookies:** 7-day server-side sessions, daily refresh, HTTP-only,
  `SameSite=Lax`, `Secure` and `__Secure-` prefix on HTTPS. Verified by
  integration tests.
- **CSRF/origins:** Better Auth origin and callback validation plus Next.js
  server-action origin checks; exact `BETTER_AUTH_URL`/`TRUSTED_ORIGINS`, no
  wildcards or `BETTER_AUTH_TRUSTED_ORIGINS`. `src/lib/auth-origins.ts`.
- **Login rate limiting:** database-backed, 5 sign-in attempts/minute/identity,
  generic 429 with `X-Retry-After`, no permanent lockout. Tests cover
  independent identities, spoofed chains, expiry and hosted-env override
  refusal.
- **Recovery:** password rehash and deletion of all owner sessions in one
  locked transaction; deterministic race coverage including an unlocked
  control. `tests/integration/recovery-race.test.ts`.
- **Join intake:** fail-closed gate, exact origin policy, 16 KiB streaming body
  limit, durable HMAC-keyed rate limit, 429 + `Retry-After`, strict Zod
  validation, exact-token idempotency, published-plan re-resolution, historical
  snapshots and generic success responses with no stored data.
- **Public/private separation:** public settings use explicit column
  projections and re-validation; CMS public reads select published columns only;
  drafts/notes/request rows/tokens/chat IDs are never public. Admin responses
  are dynamic/no-store.
- **Secrets/logging:** no `NEXT_PUBLIC_*` secrets; database, auth, GA4, Telegram
  and migration credentials are server/operator environment values only. Logs
  contain fixed operation/reason classes, not PII, SQL or tokens.
- **SQL safety:** Drizzle parameterization and bound `sql` template values for
  advisory locks, rate limits and aggregates; no user input is interpolated into
  raw SQL.
- **Error handling:** auth failures return generic 500/503 bodies; join errors
  are controlled codes with no storage details; admin actions map errors to
  fixed Arabic messages.

## 4. Residual external verification (not claims)

- Hosted Vercel forwarded-header identity and genuine 429/`Retry-After`
  behavior on the authorized Development Preview.
- Password recovery/owner-credential locking through the actual Neon pooled
  endpoint.
- Raw hosted metadata/headers on Development and Production.
- Production Neon isolation, role grants and migration from zero (local
  disposable verification completed; hosted execution external).
- GA4/Telegram provider behavior if enabled later; neither is enabled now.
- Physical Android functional acceptance and final owner launch authorization.

See `docs/W6_LAUNCH_READINESS.md` for the exact external checklists and
`docs/DATABASE_PERMISSIONS.md` for role SQL.
