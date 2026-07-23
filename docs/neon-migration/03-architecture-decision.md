# Architecture Decision — Auth, Data Access, and RLS

## Decision 1 — Authenticated access model

**Chosen: Neon Data API (PostgREST) + Neon Auth JWTs + Postgres RLS for all
member-scoped application access.** Server-only privileged operations use
Drizzle ORM over `@neondatabase/serverless`.

Explicitly **not** enabled alongside it: Neon's separate RLS/JWKS integration
("Neon RLS", the JWKS-provider mode). Exactly one authenticated-RLS mechanism
is configured on the database branch — the Data API's Neon Auth provider. The
Data API provisioning installs the JWT session machinery and the
`auth.user_id()` SQL function that all policies in `drizzle/` reference.
Enabling both modes on one branch is prohibited by this design; doc 05 tells
Michael to select **Neon Auth** as the Data API's authentication provider and
to leave the standalone RLS/JWKS feature off.

### Member-scoped path (RLS-enforced)

Browser/client components → `neon-js` Data API client authenticated with the
member's Neon Auth JWT → PostgREST → Postgres, where RLS independently
enforces:

- ownership (own watchlist/portfolio/onboarding/analyses/reports/config),
- channel access (IOP General for all active members; private channels for
  their owner only),
- recommendation visibility (general = all active members; member-scoped =
  owner only),
- active-member status (`invited`/`disabled`/`revoked` members match no
  policy and receive zero rows).

### Server-only privileged path (owner role)

Drizzle over `@neondatabase/serverless` is used **only** for:

- schema migrations (via `DATABASE_URL_UNPOOLED`, guarded by
  `scripts/migrate.mjs`),
- scheduled recommendation jobs (future),
- controlled administrative operations,
- server processes that cannot carry a member JWT.

Rule enforced in review + tests: the privileged connection is never the
ordinary path for member-owned CRUD. Where a route handler must write on a
member's behalf (the AI routes), it authenticates the member first and scopes
every statement by the session member id — and the same tables still carry
RLS so the Data API path cannot be widened by accident.

### RLS enforcement roles

- `authenticated` / `anonymous` (created by Data API provisioning) — fully
  subject to RLS; `anonymous` gets no grants on any IOP table.
- The database owner role (used by migrations and the privileged Drizzle
  path) — tables are created with `FORCE ROW LEVEL SECURITY`, and the
  migration creates one **explicit, auditable** `privileged_server_path`
  policy per table for the migration role, so owner access is a declared
  policy rather than an implicit RLS bypass. Verifying that no role carries
  `BYPASSRLS` is a manual step (doc 05): `select rolname from pg_roles where rolbypassrls;`

## Decision 2 — Private-channel administration: **strict privacy model**

A private channel is readable and writable **only by its owner**. Admins
(Mike) manage invitations, member status, and General-channel membership, but
**cannot read private-channel threads or messages** — there is no
administrative read path in the policies, and no disclosed-access membership
rows are created. Rationale: eight known members, no moderation/compliance
duty, and the disclosed-access model can be added later by an explicit,
reviewed policy + membership migration if a concrete operational need appears.
This choice is enforced by policy tests ("admin cannot read another member's
private rows").

## Decision 3 — Members table replaces Supabase `profiles` + allowlist

One `members` table is both the profile record and the invitation allowlist:
a row is created by an admin with `status='invited'` and no `auth_user_id`;
completing signup (only possible for an invited, unexpired email) sets
`auth_user_id`, `accepted_at`, and `status='active'`. This replaces Supabase's
`profiles` table and its `on_auth_user_created` trigger. Roles: `admin`,
`member`. Mike becomes the initial admin by flipping his row's role **after**
he signs up with an approved email — no account is pre-created and no email
addresses are seeded.

## Decision 4 — Blocked-cutover sequencing

Because Neon Auth requires Next ≥ 16 (doc 02), this PR lands the
schema/RLS/tooling foundation only; Supabase remains the runtime auth and the
app is untouched. Cutover order after Phase 1.5:

1. Phase 1.5 Next.js major upgrade merges (already planned).
2. Auth module (`createNeonAuth` / `createAuthClient` + invite gate) replaces
   `src/lib/supabase/*`, `middleware.ts` → `proxy.ts`.
3. Client components move to the Data API client; server routes move to
   Drizzle; Supabase packages and env vars removed.
4. `supabase/schema.sql` moves to `archive/` (it stays in place, marked
   legacy, until then — per plan §10 it may only move after parity + review).
