# DATABASE_PERMISSIONS.md — least-privilege PostgreSQL roles

Status: reviewed plan for W3.1 hardening. Execute only on the dedicated
`nokmel-website` Neon project (development branch first) with explicit owner
approval. Never run against `Nokmel_prod`, `Nokmel_dev`, or any other project.

Current development state (2026-11-27, external record): roles
`nokmel_migrator` and `nokmel_runtime` exist; migrations `0000`–`0005` are
applied on hosted Development, including W3.2 CMS, W4 plan/join intake, W4.1
promotions and W5 `site_settings`/notification columns; the runtime role has no
database/schema CREATE; the migrator retains `public`/`drizzle` schema
privileges and its temporary database-level CREATE is revoked after each
migration. The runtime `site_settings` grant and revoke-after-migration sequence
are recorded in §3e. The coding agent never connected to hosted Neon and no
credentials are recorded here.

Migrations `0000`–`0005` are immutable history: W6 did not modify them and added
no migration. Production must use an independent database branch and dedicated
Production credentials; see `docs/W6_LAUNCH_READINESS.md` §3.

## Roles

| Role | Used by | Must NOT be able to |
|---|---|---|
| `nokmel_migrator` | `pnpm db:migrate` (via `DATABASE_URL_DIRECT`), `pnpm owner:provision`, `pnpm owner:reset-password` | be used by the deployed application; create roles/databases; superuser |
| `nokmel_runtime` | deployed application runtime only (`DATABASE_URL`) | own the database/schema/tables; run DDL; `TRUNCATE`/`DROP`; migrate; provision the owner |

`DATABASE_URL_DIRECT` is an operator-machine secret. It must never be configured
in Vercel or exposed to the deployed runtime.

PostgreSQL version: 18 (Neon). The runtime role does **not** need `CREATE` on
the database or schema and does not need `TEMP`.

## 1. Create roles (run as the Neon project owner, direct connection)

Generate strong random passwords outside SQL and store them as secrets; never
commit them. Example (replace placeholders locally, do not commit real values):

```sql
CREATE ROLE nokmel_migrator LOGIN PASSWORD '<GENERATE_AND_STORE_IN_SECRET_MANAGER>';
CREATE ROLE nokmel_runtime  LOGIN PASSWORD '<GENERATE_AND_STORE_IN_SECRET_MANAGER>';

ALTER ROLE nokmel_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE nokmel_runtime  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
```

## 2. Database and schema privileges (accounting for PUBLIC defaults)

```sql
-- Remove inherited PUBLIC access first.
REVOKE ALL ON DATABASE nokmel_website FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- Explicit access only.
GRANT CONNECT ON DATABASE nokmel_website TO nokmel_migrator, nokmel_runtime;
GRANT USAGE, CREATE ON SCHEMA public TO nokmel_migrator;
GRANT USAGE ON SCHEMA public TO nokmel_runtime;
```

- `nokmel_runtime` gets **no** `CREATE` on the database or `public` schema.
- `nokmel_migrator` gets `CREATE` only because it owns migrations. It is never
  used by a deployed application instance.
- The schema remains owned by the project/database owner (`pg_database_owner`
  on PostgreSQL 15+). `nokmel_runtime` must not own it. If the project owner
  also transfers schema ownership, never transfer it to `nokmel_runtime`.

## 2a. Dedicated Drizzle migration schema

Drizzle Kit / the Drizzle PostgreSQL migrator keeps its bookkeeping table in the
`drizzle` schema (`drizzle.__drizzle_migrations`). Prepare it once as the
project/database owner **before** removing database-level `CREATE` from the
migration role:

```sql
CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION nokmel_migrator;
GRANT USAGE, CREATE ON SCHEMA drizzle TO nokmel_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE nokmel_migrator IN SCHEMA drizzle
  REVOKE ALL ON TABLES FROM PUBLIC;
```

The runtime role must have **no** privileges on the `drizzle` schema.

### Temporary database-level CREATE requirement (verified with PostgreSQL 18)

The pinned migration tool issues `CREATE SCHEMA IF NOT EXISTS "drizzle"` on
every `migrate` run. PostgreSQL 18 still checks database-level `CREATE` for that
statement even when the schema already exists (verified: `42501 permission
denied for database` with only schema-level grants). Therefore:

```sql
-- Before applying a new migration, as the project owner:
GRANT CREATE ON DATABASE nokmel_website TO nokmel_migrator;
-- ... run the reviewed migration as nokmel_migrator ...
REVOKE CREATE ON DATABASE nokmel_website FROM nokmel_migrator;
```

- Temporary database-level `CREATE` is required **for each migration run** with
  the current tool, despite the pre-created `drizzle` schema.
- **Revoke it immediately after the migration.** It is not needed for normal
  runtime traffic, owner provisioning, password recovery, or day-to-day
  operation.
- The current development branch has this grant revoked after the two W3.1
  migrations; the W3.2 `0002_w32-content-cms` migration requires the temporary
  grant/re-grant and revoke sequence above. Run `pnpm db:check` first, then the
  reviewed `pnpm db:migrate` with `DATABASE_URL_DIRECT` pointing at the direct
  development endpoint (never the pooled runtime URL, never in Vercel), then
  revoke immediately.
- Provisioning/recovery uses DML + advisory locks only and works with the grant
  revoked.

## 3. Table privileges required by Better Auth

Run this after migrations exist (or grant again after any migration that adds
an auth table). The runtime gets DML only on the five Better Auth tables:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public."user",
  public."session",
  public."account",
  public."verification",
  public."rate_limit"
TO nokmel_runtime;
```

No `TRUNCATE`, `REFERENCES`, `TRIGGER`, ownership, or DDL privileges are granted.
The schema has no application sequences (text primary keys), so no sequence
grants are required.

`nokmel_migrator` must own the auth tables so future migrations can `ALTER`
them. On a fresh branch, create the roles first and run `pnpm db:migrate` as
`nokmel_migrator` (it owns the created objects). If the tables already exist
under the project owner, transfer ownership once as the owner:

```sql
ALTER TABLE public."user"        OWNER TO nokmel_migrator;
ALTER TABLE public."session"     OWNER TO nokmel_migrator;
ALTER TABLE public."account"     OWNER TO nokmel_migrator;
ALTER TABLE public."verification" OWNER TO nokmel_migrator;
ALTER TABLE public."rate_limit"  OWNER TO nokmel_migrator;
```

`nokmel_migrator` needs DML for owner provisioning/password recovery. Object
ownership already implies full DML on those tables; an explicit grant is
harmless if ownership came from a previous owner:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public."user", public."session", public."account",
  public."verification", public."rate_limit"
TO nokmel_migrator;
```

## 3a. W3.2 CMS table privileges

After `0002_w32-content-cms` is applied, grant only the DML the CMS uses. The
runtime reads published content on public requests and performs owner-authorized
draft/publication writes:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.content_sections,
  public.faq_items
TO nokmel_runtime;
```

No `TRUNCATE`, `REFERENCES`, `TRIGGER`, ownership, or DDL grants are added. Both
tables use text primary keys; **no sequences exist** for the CMS, so no sequence
privileges are required. `nokmel_migrator` owns tables created by its migration
run (so future `ALTER`s remain possible); do not transfer ownership to the
runtime role.

The public loader uses a published-only column projection but still runs with
the same table-level runtime DML grants above; no column-level or additional
hosted grants are required. The focused consistency integration test creates a
temporary synthetic role with only published-column privileges to prove public
queries never select draft columns; that probe role is disposable test tooling
and not part of hosted provisioning.

W3.3 reuses the same tables without a migration: page SEO is stored as an
additional predefined `content_sections` row (`section_key='seo'`, id
`<page>:seo:<locale>`) under the same existing table-level runtime DML grants.
No new table, sequence, column grant or migration is required, and existing
W3.2 rows without an SEO row remain valid. Public reads continue to use the
published-only column projection (`section_key`/`published_payload`); the
published-only privilege probe also covers the SEO record.

Public-site fallback before the migration: if the CMS tables are absent, public
pages render the approved content defaults; the admin editor reports that CMS
tables are not migrated and refuses writes. No explicit seed/initialization is
required — defaults live in code and rows are created only by the first owner
draft save.

Verification after migration (no secrets printed):

```sql
SELECT has_table_privilege('nokmel_runtime', 'public.content_sections', 'SELECT') AS cms_select, -- true
       has_table_privilege('nokmel_runtime', 'public.content_sections', 'TRUNCATE') AS cms_truncate, -- false
       has_table_privilege('nokmel_runtime', 'public.faq_items', 'SELECT') AS faq_select, -- true
       has_table_privilege('nokmel_runtime', 'public.faq_items', 'DELETE') AS faq_delete; -- true
```

## 3b. W4 plans, join requests and intake rate-limit privileges

Hosted Development activation of `0003_w4-plans-join-requests` is reported
complete by the external lead. For a fresh environment, grant only the DML the
W4 features use. The runtime reads published plans on public requests, performs
owner-authorized plan draft/publication/hide writes, creates public join
requests, updates them from owner-authorized pages/actions, and maintains the
dedicated intake limiter bucket:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.plans,
  public.join_requests,
  public.join_intake_rate_limits
TO nokmel_runtime;
```

No `TRUNCATE`, `REFERENCES`, `TRIGGER`, ownership, or DDL grants are added. All
three tables use text primary keys generated by the application; **no
sequences exist**, so no sequence privileges are required. `nokmel_migrator`
owns tables created by its migration run; do not transfer ownership to the
runtime role. Foreign key checks on `join_requests.plan_id -> plans.id` work
with the table-level DML grants above (no extra grant required).

Migration 0003 is additive and does not alter existing auth/CMS/SEO/FAQ tables
or privileges. The pinned migration tool still requires the temporary
database-level `CREATE` grant documented in §2a **for each migration run**:

```sql
-- as the project owner, before migration 0003:
GRANT CREATE ON DATABASE nokmel_website TO nokmel_migrator;
-- run the reviewed migration as nokmel_migrator (direct connection only):
--   pnpm db:check
--   DATABASE_URL_DIRECT=<direct development URL> pnpm db:migrate
-- immediately afterward:
REVOKE CREATE ON DATABASE nokmel_website FROM nokmel_migrator;
```

Verification (no secrets printed):

```sql
SELECT has_table_privilege('nokmel_runtime', 'public.plans', 'SELECT') AS plans_select, -- true
       has_table_privilege('nokmel_runtime', 'public.plans', 'TRUNCATE') AS plans_truncate, -- false
       has_table_privilege('nokmel_runtime', 'public.join_requests', 'INSERT') AS requests_insert, -- true
       has_table_privilege('nokmel_runtime', 'public.join_requests', 'TRUNCATE') AS requests_truncate, -- false
       has_table_privilege('nokmel_runtime', 'public.join_intake_rate_limits', 'UPDATE') AS limiter_update, -- true
       has_table_privilege('nokmel_runtime', 'public.join_intake_rate_limits', 'TRUNCATE') AS limiter_truncate; -- false
```

The W4 runtime probe in `tests/integration/runtime-role.test.ts` performs
intended plan/join/limiter DML with a restricted synthetic role and confirms
DDL/TRUNCATE refusal. The coding agent never connects to hosted Neon; hosted
migration, grants and validation are performed by the external lead.

## 3c. W4.1 promotion columns (no new runtime grant expected)

Migration `0004_w41-scheduled-promotional-pricing` only adds nullable columns
and JSON-object checks to the existing W4 tables:

- `plans.draft_promotion` (JSONB, nullable)
- `plans.published_promotion` (JSONB, nullable)
- `join_requests.offer_snapshot` (JSONB, nullable)

Because the runtime already has table-level `SELECT, INSERT, UPDATE, DELETE` on
`public.plans` and `public.join_requests`, these new columns are covered by the
existing grants. No new table, sequence, column grant, `TRUNCATE`, `REFERENCES`,
`TRIGGER`, ownership or DDL grant is introduced. `nokmel_runtime` must still not
receive database/schema CREATE, migration-history access or TRUNCATE.

Apply the additive migration with the same temporary database-level CREATE
procedure as prior migrations:

```sql
-- as the project owner, before migration 0004:
GRANT CREATE ON DATABASE nokmel_website TO nokmel_migrator;
-- run the reviewed migration as nokmel_migrator (direct connection only):
--   pnpm db:check
--   DATABASE_URL_DIRECT=<direct development URL> pnpm db:migrate
-- immediately afterward:
REVOKE CREATE ON DATABASE nokmel_website FROM nokmel_migrator;
```

Verification (no secrets printed):

```sql
SELECT column_name, is_nullable, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (
     (table_name = 'plans' AND column_name IN ('draft_promotion', 'published_promotion')) OR
     (table_name = 'join_requests' AND column_name = 'offer_snapshot')
   )
 ORDER BY table_name, column_name;

SELECT has_table_privilege('nokmel_runtime', 'public.plans', 'UPDATE') AS plans_update, -- true
       has_table_privilege('nokmel_runtime', 'public.join_requests', 'UPDATE') AS requests_update, -- true
       has_table_privilege('nokmel_runtime', 'public.plans', 'TRUNCATE') AS plans_truncate, -- false
       has_table_privilege('nokmel_runtime', 'public.join_requests', 'TRUNCATE') AS requests_truncate; -- false
```

The disposable-PostgreSQL runtime probe now also writes/reads `draft_promotion`
and `offer_snapshot` with the restricted synthetic role, proving the existing
table-level DML is sufficient and DDL/TRUNCATE remain refused. Existing W4 rows
must remain unchanged and readable; `draft_promotion`/`published_promotion`/
`offer_snapshot` stay `NULL` for them. Hosted execution is external; the coding
agent never connects to hosted Neon.

## 3d. W4 QA join-request cleanup (operator-only, no hosted execution here)

W4 does not add an admin deletion feature or any new grant for cleanup. After
independent hosted acceptance, synthetic QA requests must be removed by an
explicit owner-authorized operator action using the direct operator connection
(`DATABASE_URL_DIRECT`, never the pooled runtime URL and never from this coding
agent).

The reviewed helper is `scripts/cleanup-w4-qa-requests.ts`
(`pnpm qa:cleanup-w4`). It:

- requires one or more exact, independently recorded `--request-id` values;
- requires the synthetic name prefix via `--marker` (recommended `QA-W4-`);
- defaults to a transactional dry-run that locks/validates rows and prints only
  the matched count/IDs, then rolls back;
- requires `--confirm` for deletion;
- aborts if any ID is missing, duplicated, unexpected, or its name/marker does
  not match;
- deletes only `WHERE id = ANY($exact_ids)` in one transaction and verifies the
  deleted count; it never deletes all requests and never uses `TRUNCATE`;
- does not touch plans, auth/accounts/sessions, CMS, SEO, or unrelated requests.

```bash
# 1) dry-run; review the printed count and exact IDs
DATABASE_URL_DIRECT=<direct development URL> pnpm qa:cleanup-w4 \
  --marker "QA-W4-" --request-id <recorded-id> [--request-id <recorded-id>...]

# 2) only after owner authorization, repeat the exact command with --confirm
DATABASE_URL_DIRECT=<direct development URL> pnpm qa:cleanup-w4 \
  --marker "QA-W4-" --request-id <recorded-id> [--request-id <recorded-id>...] --confirm
```

Test plans are normally hidden through the owner UI after acceptance; no
test-plan deletion procedure is included, and the `join_requests.plan_id`
foreign-key restriction is not weakened. If a plan must ever be removed through
a separate owner-approved operator procedure, it must first have zero remaining
references, including historical snapshots, and must never use `TRUNCATE` or an
unscoped delete. The final production retention and personal-data deletion
policy still requires owner approval before launch.

## 3e. W5 website settings and notification state

Migration `0005_w5-settings-notifications` is additive:

- creates `public.site_settings` (one typed row, public/private columns, checks);
- adds nullable `notification_state`, `notification_attempted_at`,
  `notification_delivered_at` and `notification_error_code` to
  `public.join_requests`, plus two checks.

There is **no** first-party analytics table. Telegram bot tokens and GA4
credentials remain server environment secrets and are never stored in the
database.

After the migration, grant only the DML the application uses:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.site_settings
TO nokmel_runtime;
```

The existing table-level `SELECT, INSERT, UPDATE, DELETE` on
`public.join_requests` from §3b already covers the new notification columns; no
column-level grant is needed. No `TRUNCATE`, `REFERENCES`, `TRIGGER`,
ownership, schema/database `CREATE`, sequence (none exist) or migration-history
privilege is granted to the runtime. `nokmel_migrator` owns the new table from
its migration run; do not transfer ownership to the runtime role.

Apply the migration with the same temporary database-level CREATE procedure as
prior migrations:

```sql
-- as the project owner, before migration 0005:
GRANT CREATE ON DATABASE nokmel_website TO nokmel_migrator;
-- run the reviewed migration as nokmel_migrator (direct connection only):
--   pnpm db:check
--   DATABASE_URL_DIRECT=<direct development URL> pnpm db:migrate
-- immediately afterward:
REVOKE CREATE ON DATABASE nokmel_website FROM nokmel_migrator;
```

Do not run this against Production without explicit W6 launch approval. The
coding agent did not apply 0005 to hosted Neon; the external record reports it
is applied on hosted Development.

Verification (no secrets printed):

```sql
SELECT has_table_privilege('nokmel_runtime', 'public.site_settings', 'SELECT') AS settings_select, -- true
       has_table_privilege('nokmel_runtime', 'public.site_settings', 'INSERT') AS settings_insert, -- true
       has_table_privilege('nokmel_runtime', 'public.site_settings', 'UPDATE') AS settings_update, -- true
       has_table_privilege('nokmel_runtime', 'public.site_settings', 'DELETE') AS settings_delete, -- true
       has_table_privilege('nokmel_runtime', 'public.site_settings', 'TRUNCATE') AS settings_truncate, -- false
       has_table_privilege('nokmel_runtime', 'public.join_requests', 'UPDATE') AS requests_update, -- true
       has_table_privilege('nokmel_runtime', 'public.join_requests', 'TRUNCATE') AS requests_truncate; -- false

SELECT column_name, is_nullable, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'join_requests'
   AND column_name LIKE 'notification_%'
 ORDER BY column_name;
```

Only one `site_settings` row with `id = 'default'` is allowed by a check
constraint. Public reads use an explicit column projection; private chat IDs
and integration flags are never selected by public loaders. The disposable
runtime probe in `tests/integration/runtime-role.test.ts` performs intended
`site_settings`/notification-column DML with a restricted synthetic role and
confirms DDL/`TRUNCATE` refusal. The W5 migration-upgrade test proves a
populated W4.1 database keeps all existing data and that settings start empty
(no row) with integrations disabled.

The focused W5-R01–R06 reliability/privacy closure adds **no schema or grant
change**. Notification completion is fenced using the existing
`notification_attempted_at` claim timestamp and `notification_state =
'sending'`; no attempt-id column is required. The same `site_settings`
runtime grant and existing `join_requests` table DML remain sufficient.

## 4. Default privileges for future objects

Migration-created objects must not inherit PUBLIC access, and the runtime must
not automatically gain access to future CMS/pricing/join-request tables. Grant
per migration explicitly after review.

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE nokmel_migrator IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE nokmel_migrator IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE nokmel_migrator IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;
```

## 5. Verification (no secrets printed)

```sql
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles WHERE rolname IN ('nokmel_migrator', 'nokmel_runtime');

SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

SELECT has_schema_privilege('nokmel_runtime', 'public', 'USAGE')  AS runtime_schema_usage,   -- true
       has_schema_privilege('nokmel_runtime', 'public', 'CREATE') AS runtime_schema_create,  -- false
       has_database_privilege('nokmel_runtime', 'nokmel_website', 'CREATE') AS runtime_db_create, -- false
       has_table_privilege('nokmel_runtime', 'public."user"', 'SELECT') AS runtime_user_select,   -- true
       has_table_privilege('nokmel_runtime', 'public."user"', 'TRUNCATE') AS runtime_user_truncate; -- false
```

Automated evidence: `tests/integration/runtime-role.test.ts` creates a
restricted synthetic role on a **disposable loopback PostgreSQL 18**, applies
this plan (including the CMS, plan/join/limiter and W5 `site_settings` tables),
and verifies login, sign-in, session access, logout, database-backed rate
limiting, CMS/plan/join/settings DML, notification-column updates, and refusal
of `CREATE`/`ALTER`/`DROP`/`TRUNCATE`. It is part of `pnpm test:db` and runs in
CI. The plan itself is never executed against hosted Neon in this workstream.

## 6. Rotation

Rotate role passwords in Neon, update the corresponding Vercel secret
(`DATABASE_URL` for runtime) or operator secret (`DATABASE_URL_DIRECT`), and
redeploy. The migration role password must never be added to the application
runtime environment.
