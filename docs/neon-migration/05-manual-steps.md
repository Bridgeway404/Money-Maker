# Manual Steps for Michael

Claude cannot reach the Neon or Vercel dashboards from the workspace, and
several provisioning actions are console-only. Steps are grouped by when they
are needed. **Never paste secret values into chat, commits, or logs.**

## A. Required now (unblocks nothing yet, but safe and useful)

1. **Confirm the integration variables** — Vercel → `iop-investing-tool` →
   Settings → Environment Variables: verify `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` exist (names only). Note which environments
   (Production / Preview / Development) they're set for.
2. **Create a `development` branch in Neon** — Neon console → project →
   Branches → New branch (from `production`, schema-only is fine). This is
   the target for the first real migration run and the database-backed RLS
   tests (`NEON_TEST_DATABASE_URL`). Do not run anything against
   `production`.
3. **Check who can bypass RLS** — Neon SQL editor, on the dev branch:
   `select rolname from pg_roles where rolbypassrls;` — record the result in
   the PR review. Expect none of the app-facing roles.
4. **Decide the data-migration option** (doc 04): check Supabase table row
   counts; approve Option A (fresh start) or request Option B.

## B. Required before preview testing (after the Phase 1.5 Next 16 upgrade)

5. **Enable Neon Auth** — Neon console → project → **Auth** → enable.
   Copy the auth base URL (format
   `https://ep-….neonauth.….neon.build/<db>/auth`). This is
   `NEON_AUTH_BASE_URL` (server) and `NEXT_PUBLIC_NEON_AUTH_URL` (browser).
   Disable public sign-ups if the dashboard offers the toggle — signup must
   be invite-only.
6. **Generate `NEON_AUTH_COOKIE_SECRET`** — locally:
   `openssl rand -base64 48` (≥ 32 chars required). Add to Vercel as a
   server-only variable for Production + Preview. It must stay stable across
   deployments — rotating it invalidates every session.
7. **Enable the Data API** — Neon console → branch → **Data API** → enable.
   Copy the URL (`https://ep-….apirest.….neon.build/<db>/rest/v1`) →
   `NEON_DATA_API_URL` / `NEXT_PUBLIC_NEON_DATA_API_URL`.
8. **Select Neon Auth as the Data API authentication provider** when
   prompted during enablement. Do **not** also configure the separate
   "Neon RLS" JWKS integration on this branch (doc 03, Decision 1).
9. **Confirm RLS is active** — after running `npm run db:migrate` against the
   dev branch: `select relname, relrowsecurity, relforcerowsecurity from
   pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';`
   — every IOP table must show `t, t`.
10. **Confirm preview-branch behavior** — Vercel → open a preview deployment
    of the migration PR → Neon console should show a matching preview branch;
    verify the preview deployment's `DATABASE_URL` points at that branch (by
    branch name in the host, not by revealing the value).
11. **Add the missing variables to Vercel** (Preview first):
    `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`,
    `NEXT_PUBLIC_NEON_AUTH_URL`, `NEXT_PUBLIC_NEON_DATA_API_URL`. Redeploy
    the preview.
12. **Invite two test accounts** (emails Michael controls — not the members'
    real addresses yet), complete signup for both, and run the two-account
    checks: each sees only their own watchlist/portfolio/private channel;
    both see IOP General and general recommendations; a disabled test account
    loses all access.

## C. Required before production cutover (LAST — after preview sign-off)

13. Run `npm run db:migrate` against **production** — this is the only step
    that touches the production branch. It requires the explicit override
    (`ALLOW_PRODUCTION_MIGRATION=I_UNDERSTAND_THIS_IS_PRODUCTION`); the guard
    refuses otherwise.
14. Enable Neon Auth + Data API on the production branch (repeat 5–9 there),
    add Production env vars, deploy, and re-run the two-account checks.
15. Send the eight real invitations (Mike, DeLon, Jaren, Demari, Kevin,
    Jhawan, Reuben, Lawrence) — Michael enters the real email addresses in
    the admin UI; then set Mike's row to `role='admin'`.

## D. Must NOT be performed yet

- ❌ Any command against the production Neon branch (incl. `db:migrate`).
- ❌ Disconnecting or deleting the Supabase project — only after the
  retirement checklist in doc 06 is fully green.
- ❌ Creating real member accounts or seeding real email addresses.
- ❌ Marking the migration PR ready / merging / deploying it.
- ❌ Enabling the standalone Neon RLS (JWKS) integration.
