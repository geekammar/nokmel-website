# DATABASE_PERMISSIONS.md — least-privilege PostgreSQL roles

Status: reviewed plan for W3.1 hardening. Execute only on the dedicated
`nokmel-website` Neon project (development branch first) with explicit owner
approval. Never run against `Nokmel_prod`, `Nokmel_dev`, or any other project.

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
this plan, and verifies login, sign-in, session access, logout, database-backed
rate limiting, and refusal of `CREATE`/`ALTER`/`DROP`. It is part of
`pnpm test:db` and runs in CI. The plan itself is never executed against hosted
Neon in this workstream.

## 6. Rotation

Rotate role passwords in Neon, update the corresponding Vercel secret
(`DATABASE_URL` for runtime) or operator secret (`DATABASE_URL_DIRECT`), and
redeploy. The migration role password must never be added to the application
runtime environment.
