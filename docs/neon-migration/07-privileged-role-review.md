# Privileged Server Role — Review

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

Record the output in the PR review. If the migration is ever run by a
different role than the one the server uses at runtime, the runtime role
would have **no** policy and zero access (fail closed) — the fix is to re-run
a migration (or add a policy) as/for the correct role, never to disable RLS.

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

Expected: **no**. Neon does not give project roles `BYPASSRLS`, and the
design depends on that: FORCE RLS + a declared policy is only meaningful if
the owner cannot silently bypass it. Verified two ways:

- automatically: the live RLS suite asserts `authenticated`/`anonymous`
  (the member-facing Data API roles) have no `BYPASSRLS`;
- manually (doc 05 §A3): `SELECT rolname FROM pg_roles WHERE rolbypassrls;`
  — the owner/migration role must not appear either. Note: a role with
  `BYPASSRLS` would make `privileged_server_path` redundant but NOT widen
  member access; the member-facing roles are the security boundary.

## 4. Could ordinary member CRUD accidentally run through the privileged role?

Yes — this is the main residual risk, and it is an **application-layer**
one: any server code that opens a Drizzle/`@neondatabase/serverless`
connection with `DATABASE_URL` runs as the privileged role, and RLS will not
scope it to a member. Nothing in this PR does that (no runtime code imports
the driver — test-enforced by `client-bundle-safety.test.ts`), but after
cutover the AI API routes will.

**Rule (binding for the cutover PR):** the privileged connection is never
the ordinary path for member-owned CRUD. Member-facing reads/writes go
through the Data API with the member's JWT, where RLS enforces scope. The
privileged path is reserved for: migrations, the seed, scheduled jobs,
and admin operations (invitation management, member status/role changes).

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

## Summary

The privileged path stays: migrations and controlled jobs require it, and
making it an explicit, auditable policy is strictly better than an implicit
owner bypass. Its boundary is contractual, not mechanical — hence the rule
in §4, the checklist in §5, and the manual verifications in §§1–3.
