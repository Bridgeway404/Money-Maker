# Drizzle Schema & Migrations (Neon)

Database foundation for the IOP Investing Tool on Neon Postgres. The running
app does **not** use any of this yet — it still runs on Supabase until the
Phase 1.5 Next.js upgrade unblocks the Neon Auth cutover
(see `docs/neon-migration/02-research-and-compatibility.md`).

## Layout

| Path | Purpose |
|---|---|
| `schema.ts` | Drizzle schema: IOP community tables (members, channels, threads, messages, recommendations) + app tables ported from `supabase/schema.sql` (`user_id` → `member_id`) |
| `migrations/0000_iop_initial_schema.sql` | Generated DDL (enums, tables, FKs, CHECKs, indexes) |
| `migrations/0001_rls_policies.sql` | Hand-written RLS: ENABLE + FORCE on every table, default-deny, `iop.*` helper functions, explicit `privileged_server_path` policy, grants |
| `seed/mock-option-contracts.json` | The 21 mock contracts (mirrors `src/lib/utils/mock-data.ts`; consistency is test-enforced) |
| `__tests__/` | Static RLS coverage, seed consistency, and env-gated database-backed RLS tests |

## Commands

```bash
npm run db:generate   # regenerate SQL from schema.ts (offline)
npm run db:check      # drizzle-kit consistency check (offline)
npm run db:migrate    # guarded migration (see below)
npm run db:seed       # guarded mock-only seed
```

## Environment contract

- `DATABASE_URL` — pooled; runtime server code only. Never in browser code.
- `DATABASE_URL_UNPOOLED` — direct; migrations/seeds/tooling only.
- Neither is ever printed, logged, or committed.

`db:migrate` and `db:seed` additionally require `NEON_TARGET_BRANCH` (the Neon
branch name the connection string points at) and refuse branches named
`main`/`master`/`production`/`prod` — or `NEON_TARGET_IS_PRODUCTION=true` —
unless `ALLOW_PRODUCTION_MIGRATION=I_UNDERSTAND_THIS_IS_PRODUCTION` is set.
The override is reserved for the approved production cutover
(`docs/neon-migration/05-manual-steps.md` §C) and was not used during
development.

## RLS model (summary)

- Every table: `ENABLE` + `FORCE ROW LEVEL SECURITY`, default deny.
- `authenticated` (Neon Data API role): scoped by `iop.current_member_id()`,
  which resolves the Neon Auth JWT subject to an **active** member row.
  Invited/disabled/revoked members match no policy.
- `anonymous`: no grants at all.
- Private channels are owner-only — admins have **no** read path (strict
  privacy model, doc 03 Decision 2).
- `option_contracts` is read-only shared data and its CHECK constraint
  requires `is_mock = true` until a real options provider exists.
- The migration/owner role's access is a declared `privileged_server_path`
  policy per table, not an implicit bypass. Confirm no role has `BYPASSRLS`
  via doc 05 §A3.

## Database-backed tests

`__tests__/rls.db.test.ts` runs only when `NEON_TEST_DATABASE_URL` is set
(point it at a disposable Neon development branch, never production). Without
that variable the suite is skipped, so CI stays green with no database.
