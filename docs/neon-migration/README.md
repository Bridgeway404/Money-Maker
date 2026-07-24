# Neon Migration — IOP Investing Tool

Controlled migration of the IOP Investing Tool (In Omnia Paratus) from
Supabase to Neon Postgres + Neon Auth + Neon Data API (with Postgres RLS) +
Drizzle ORM. Production cutover is **not** part of this work; nothing here
touches the production Neon branch or the running Supabase-backed app.

| Doc | Contents |
|---|---|
| [01-supabase-audit.md](01-supabase-audit.md) | File-by-file inventory of every Supabase dependency, replacement approach, risk, tests |
| [02-research-and-compatibility.md](02-research-and-compatibility.md) | Verified package versions; **the Next ≥ 16 blocker on `@neondatabase/auth` and the stop-and-report decision**; verified auth patterns and env-var names |
| [03-architecture-decision.md](03-architecture-decision.md) | Data API + RLS vs. privileged Drizzle split; strict private-channel privacy model; members-as-allowlist design |
| [04-data-migration-options.md](04-data-migration-options.md) | Option A (fresh start, recommended) vs. Option B (controlled migration, documented only) |
| [05-manual-steps.md](05-manual-steps.md) | Michael's dashboard steps, staged: now / before preview / before production / not yet |
| [06-rollback-and-retirement.md](06-rollback-and-retirement.md) | Rollback procedure, Supabase retirement checklist, known limitations |
| [07-privileged-role-review.md](07-privileged-role-review.md) | Which role holds `privileged_server_path`, BYPASSRLS verification, why it must never become the member CRUD path |

Implementation lives in:

- `drizzle/` — schema, SQL migrations (including default-deny RLS), tests
- `scripts/migrate.mjs` — guarded migration runner (refuses production)
- `scripts/seed-mock.mjs` — mock-data-only seed (option contracts + IOP General channel)
