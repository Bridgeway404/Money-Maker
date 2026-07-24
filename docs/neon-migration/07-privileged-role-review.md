# Privileged Server Role — Review

> **Owner-level `DATABASE_URL` credentials must not be used for ordinary
> member-owned CRUD.** The Neon owner role carries `BYPASSRLS` (confirmed,
> §3): any query it runs ignores every policy in this repository. Member
> operations go through Neon Auth + Data API + `authenticated` RLS, or
> through the deliberately assumed non-bypass `iop_server` role with
> application-level ownership checks (§5). Neither connection string is ever
> exposed to client code (test-enforced).

## 0. Three-role model (confirmed by validation run 30061768777)

| Role | Attributes (verified) | Purpose | Proves RLS? |
|---|---|---|---|
| `neondb_owner` (Neon connection role) | `rolsuper=false`, **`rolbypassrls=true`**, `rolcreaterole=true` | Migrations, schema/role changes, emergency admin | **Never** — BYPASSRLS ignores all policies |
| `authenticated` / `anonymous` | no BYPASSRLS, no superuser (test-asserted) | Member-facing Data API access; `authenticated` scoped by JWT + active membership, `anonymous` denied on every protected table | Yes — the roles whose isolation results matter |
| `iop_server` (migration 0003) | `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS` | Scheduled jobs and controlled server admin, assumed via `SET ROLE` from the owner connection | Yes — its access is the declared `server_job_path` policy under FORCE RLS |

The RLS migration (`drizzle/migrations/0001_rls_policies.sql`) creates one
`privileged_server_path` policy per table, `FOR ALL … USING (true) WITH CHECK
(true)`, granted `TO current_user` **at migration time**. This document
records what that means operationally and what must be verified.

## 1. Which role receives the policies

Whichever Postgres role executes `npm run db:migrate`. With the Neon/Vercel
integration this is the database's owner role (Neon's default is
`neondb_owner`, but the project may differ). The exact name is visible after
the first migration run:

```sql
SELECT DISTINCT polroles::regrole[] FROM pg_policy
WHERE polname = 'privileged_server_path';
```

**Confirmed by run 30061768777: the connection role is `neondb_owner`.**
Because that role holds BYPASSRLS (§3), the `privileged_server_path`
policies bound to it are effectively inert for it — they remain harmless and
documented, but the *meaningful* declared-policy path is now `iop_server` +
`server_job_path` (migration 0003), which the live suite proves under FORCE
RLS with a non-bypass role.

## 2. Do the pooled and unpooled connection strings use the same role?

Expected: **yes** — the Neon integration's `DATABASE_URL` (pooled) and
`DATABASE_URL_UNPOOLED` differ only in endpoint (pooler vs direct), not in
role. This cannot be verified from the repo (values are never inspected);
Michael confirms it without revealing secrets by running on each connection:

```sql
SELECT current_user;
```

Both must return the same role name (doc 05 §A4). If they ever diverge, the
runtime (pooled) role needs its own declared policy before cutover.

## 3. Does that role have BYPASSRLS?

**Yes — confirmed.** Run 30061768777 recorded `neondb_owner` with
`rolsuper=false`, **`rolbypassrls=true`**, `rolcreaterole=true`. (An earlier
revision of this document expected "no"; that expectation was wrong — this
is how Neon provisions the owner role, and it is not something we change.)
Consequences, all now encoded in code and tests:

- Nothing executed as the owner proves anything about RLS. The owner-path
  live test is explicitly labeled accordingly.
- BYPASSRLS attaches to **current_user**, not session_user: after
  `SET LOCAL ROLE authenticated` / `iop_server`, policies fully apply — the
  live suite proves a prohibited cross-member read stays denied even though
  the session began as the BYPASSRLS owner.
- The security boundary is the member-facing roles plus `iop_server`; the
  live suite asserts none of the three has `BYPASSRLS` or superuser.
- Manual check (doc 05 §A3) still applies: `SELECT rolname FROM pg_roles
  WHERE rolbypassrls;` should list only the owner role — anything else
  needs explanation before cutover.

## 4. Could ordinary member CRUD accidentally run through the privileged role?

Yes — this is the main residual risk, and it is an **application-layer**
one: any server code that opens a Drizzle/`@neondatabase/serverless`
connection with `DATABASE_URL` runs as the privileged role, and RLS will not
scope it to a member. Nothing in this PR does that (no runtime code imports
the driver — test-enforced by `client-bundle-safety.test.ts`), but after
cutover the AI API routes will.

**Rule (binding for the cutover PR):** owner-level `DATABASE_URL`
credentials must not be used for ordinary member-owned CRUD — with
BYPASSRLS confirmed on the owner, such a query would silently ignore every
policy. Member-facing reads/writes go through the Data API with the
member's JWT, where RLS enforces scope. Server jobs and controlled admin
run `SET ROLE iop_server` first (non-bypass, declared `server_job_path`
policy) rather than acting as the raw owner; the raw owner connection is
reserved for migrations, the seed, and emergencies.

## 5. Application-level ownership checks required after cutover

Where a server route MUST write on a member's behalf over the privileged
connection (the four AI routes persist reports/scores/recommendations/chat),
each handler must, in order:

1. authenticate the request (`auth.getSession()`), reject otherwise;
2. resolve the session subject to an **active** member row (same lookup as
   `iop.current_member_id()`); reject invited/disabled/revoked;
3. set `member_id` on every INSERT from that resolved id — never from the
   request body;
4. filter every SELECT/UPDATE/DELETE by that resolved `member_id`;
5. never accept a `member_id`, `owner_member_id`, or `author_member_id`
   from client input.

The cutover PR must add tests for each route asserting a request cannot
read or write another member's rows through the privileged path.

## 6. Test-only role simulation (validation run 30032400037 follow-up)

The first validation run failed with `permission denied to set role
"authenticated"` (SQLSTATE 42501) on every member-path test: `SET ROLE`
requires the session role to be a *member* of the target role (with the SET
option since PostgreSQL 16), and creating a role does not by itself confer a
SET-capable membership — the creating role is left holding ADMIN OPTION on
it. Because it holds ADMIN OPTION, the connection role is authorized to
grant and revoke membership in `authenticated`/`anonymous`, including to
itself; the RLS suite now does exactly that, test-scoped:

- only when `NEON_TARGET_BRANCH=development` and
  `NEON_TARGET_IS_PRODUCTION=false` (otherwise it aborts with a setup error);
- tracking each membership it added and revoking exactly those in teardown;
- never granting `BYPASSRLS`;
- verifying `current_user` actually switched before any assertion runs.

This is a **test-environment** arrangement, not a production model change:
in production the Data API connects *as* `authenticated`/`anonymous` — the
server role never needs to SET ROLE into them. If the diagnostic tests show
the membership assumption is wrong on some Postgres/Neon version, the suite
fails loudly at setup rather than producing misleading RLS verdicts.

## Summary

The privileged path stays: migrations and controlled jobs require it, and
making it an explicit, auditable policy is strictly better than an implicit
owner bypass. Its boundary is contractual, not mechanical — hence the rule
in §4, the checklist in §5, and the manual verifications in §§1–3.
