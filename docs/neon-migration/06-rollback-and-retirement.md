# Rollback Procedure & Supabase Retirement Checklist

## Rollback (at any point before Supabase retirement)

The migration is designed so Supabase remains a working fallback until the
final retirement step:

1. **Before the app cutover PR merges** (current state): nothing to roll
   back — the app still runs entirely on Supabase; this PR only adds schema,
   tooling, and docs that the runtime does not import.
2. **After the cutover PR merges, before retirement:** revert the cutover PR
   (`git revert` of its merge commit) and redeploy. Supabase env vars must
   still be present in Vercel (do not delete them until retirement), and the
   Supabase project must still be live. Sessions issued by Neon Auth are
   lost on rollback (members sign in again with Supabase credentials); data
   written to Neon during the overlap window must be re-entered or ported
   back by hand — keep the overlap window short and low-traffic.
3. **Database rollback:** never roll back by editing the production branch in
   place. Neon branches are the mechanism — restore from the pre-migration
   branch point (Neon console → Branches → restore/branch from timestamp).

## Supabase retirement checklist (ONLY after all are green)

- [ ] Cutover PR merged and deployed to production
- [ ] All eight members signed up via invitation and verified their data
- [ ] Two-account RLS checks re-run against production (doc 05 §12)
- [ ] Data migration decision executed (Option A confirmed empty-start, or
      Option B validation counts signed off)
- [ ] 30-day observation window with no Supabase-related incident
- [ ] Supabase env vars removed from Vercel (names:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] `supabase/schema.sql` moved to `archive/supabase-legacy/` with a
      non-executable marker (per plan §10 — only after schema parity review)
- [ ] Supabase project paused first (reversible), then deleted only after a
      final export is stored somewhere Michael controls

## Known limitations at this stage

- Neon Auth SDK is beta (0.4.2-beta) and requires Next ≥ 16 — the entire app
  cutover is gated on Phase 1.5 (doc 02).
- Nothing in this PR runs against a live database; the RLS suite and the
  migration dry run execute only when `NEON_TEST_DATABASE_URL` /
  `DATABASE_URL_UNPOOLED` are provided in a safe environment (doc 05 §A2).
- All market and option data remains **mock, sample, user-entered, or
  unverified** — unchanged by this migration, still labeled throughout the
  UI, and now also enforced at the database layer (`option_contracts`
  requires `is_mock = true`; `recommendations.data_reliability` has no
  "live" value).
