# Supabase → Neon Data Migration Decision

## Assessment of existing Supabase data

What the Supabase project contains cannot be read from this workspace (no
Supabase credentials here, and production data must not be exported without
explicit approval). From the repository's history the strong expectation is:

- `option_contracts`: the 21 seeded mock contracts (labeled `is_mock`),
- possibly a handful of test accounts and prototype-era rows
  (`research_reports` written before Phase 1 may contain AI-invented
  news/scores — already flagged for cleanup in Phase 1.5),
- no real member community data: the IOP channel/recommendation model never
  existed in Supabase.

## Recommendation: **Option A — fresh Neon start**

Unless Michael confirms there is real data worth keeping, start clean:

- Create the new schema on Neon via `drizzle/` migrations.
- Seed **only** the mock option contracts (`npm run db:seed`) — every row
  carries `is_mock = true` and the table has a CHECK constraint refusing
  non-mock rows until a real options provider exists.
- Seed the single `IOP General` channel (no members attached).
- Create **no users, no invitations** (invitations require Michael to enter
  the eight real email addresses himself — never fabricated).
- All watchlists, portfolios, channels, threads, and reports begin empty.

Verification before adopting Option A: Michael checks the Supabase dashboard
(Table Editor row counts on `watchlist_items`, `portfolio_holdings`,
`research_reports`, `stock_analyses`) — if anything there matters, switch to
Option B.

## Option B — controlled migration (documented, NOT performed in this task)

1. **Export** (Supabase dashboard → Database → Backups, or
   `pg_dump --data-only --schema=public` against the Supabase connection
   string) — requires explicit approval first.
2. **Dependency order for import:** `members` (derived — see step 3) →
   `option_contracts` → `onboarding_answers` → `watchlist_items` →
   `portfolio_holdings` → `stock_analyses` → `research_reports` →
   `leaps_recommendations` → `chat_messages` → `scoring_config`.
3. **Auth user-ID mapping:** Supabase `auth.users.id` (uuid) does not survive
   into Neon Auth. Build a mapping table
   `(supabase_user_id, email_normalized)` from `auth.users`; after each
   member accepts their Neon invitation, resolve
   `email_normalized → members.id` and rewrite every imported `user_id`
   column to the new `member_id`. Rows whose email matches no invited member
   are quarantined, not imported.
4. **Email reconciliation:** normalize (`lower(trim(email))`) on both sides;
   any duplicate normalized email in the export must be resolved manually
   before import (unique constraint will reject it).
5. **Validation:** per-table row counts export vs. import; per-member row
   counts for ownership spot checks (`select member_id, count(*) …`);
   referential integrity check (`… left join members m on … where m.id is null`).
6. **Duplicate handling:** natural-key upserts where they exist
   (`onboarding_answers`/`scoring_config`: one per member); otherwise import
   into a staging schema and de-duplicate before promoting.
7. **Rollback plan:** import into a dedicated Neon branch first; promote by
   re-pointing the app only after validation; the pre-import branch state and
   the untouched Supabase project are the rollback targets.
8. **Read-only overlap:** freeze Supabase writes (pause the app or revoke
   write grants) for the export→validate window so no rows are stranded;
   keep Supabase read-only but intact until the retirement checklist
   (doc 06) is complete.
