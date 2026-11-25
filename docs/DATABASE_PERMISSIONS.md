# DATABASE_PERMISSIONS.md — least-privilege PostgreSQL roles

Status: reviewed plan for W3.1 hardening. Execute only on the dedicated
`nokmel-website` Neon project (development branch first) with explicit owner
approval. Never run against `Nokmel_prod`, `Nokmel_dev`, or any other project.

Current development state (2026-11-25, external configuration): roles
`nokmel_migrator` and `nokmel_runtime` exist; W3.1 migrations `0000`/`0001` are
applied; the QA owner is provisioned; the runtime role has no database/schema
CREATE; the migrator retains `public`/`drizzle` schema privileges and its
temporary database-level CREATE was revoked after migration. W3.2 adds
`0002_w32-content-cms` (external operator task). No credentials are recorded
here.

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
this plan (including the two CMS tables), and verifies login, sign-in, session
access, logout, database-backed rate limiting, CMS DML, and refusal of
`CREATE`/`ALTER`/`DROP`/`TRUNCATE`. It is part of
`pnpm test:db` and runs in CI. The plan itself is never executed against hosted
Neon in this workstream.

## 6. Rotation

Rotate role passwords in Neon, update the corresponding Vercel secret
(`DATABASE_URL` for runtime) or operator secret (`DATABASE_URL_DIRECT`), and
redeploy. The migration role password must never be added to the application
runtime environment.
