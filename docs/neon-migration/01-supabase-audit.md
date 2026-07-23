# Supabase Dependency Audit — IOP Investing Tool

Audited at `main` = `958324c` (post Phase 1, post branch rename). This inventory
was produced **before** any migration implementation, as required. Every file
that touches Supabase is listed with its purpose, the planned replacement,
migration risk, and the test coverage the replacement requires.

**Replacement approach legend**

- **AUTH** — Neon Auth (`@neondatabase/auth`, `createNeonAuth()` server config +
  `createAuthClient()` browser client). ⚠️ Blocked on Next ≥ 16 — see
  `02-research-and-compatibility.md`.
- **DATA-API** — Neon Data API (PostgREST) with the member's Neon Auth JWT;
  Postgres RLS enforces access. For member-scoped CRUD from client components.
  ⚠️ Blocked with AUTH (JWTs come from Neon Auth).
- **DRIZZLE** — Drizzle ORM over `@neondatabase/serverless` from server code
  (route handlers / server components), with authentication and explicit
  ownership checks in the handler. Not blocked.
- **DDL** — replaced by the new Drizzle schema + SQL migrations in `drizzle/`.

## Package dependencies

| Dependency | Where | Replacement |
|---|---|---|
| `@supabase/supabase-js` ^2.45.4 | `package.json` | Removed at cutover; replaced by `@neondatabase/auth` + `@neondatabase/neon-js` (member-scoped) and `drizzle-orm` + `@neondatabase/serverless` (privileged) |
| `@supabase/ssr` ^0.5.1 | `package.json` | Removed at cutover; Neon Auth cookie/session handling via `createNeonAuth({ cookies })` |

## Environment variables

| Variable | Where referenced | Replacement |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/{client,server}.ts`, `middleware.ts`, `.env.example`, README | `NEON_AUTH_BASE_URL` (server) / `NEXT_PUBLIC_NEON_AUTH_URL` (browser) + `NEON_DATA_API_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same files | No equivalent needed — Data API authenticates with the member's Neon Auth JWT; no publishable key |

## File-by-file inventory

### Core plumbing

| # | File | Current purpose | Replacement | Risk | Tests required |
|---|---|---|---|---|---|
| 1 | `src/lib/supabase/client.ts` | Browser Supabase client factory (`createBrowserClient`) | New `src/lib/auth/client.ts` (`createAuthClient` + `SupabaseAuthAdapter` for minimal call-site churn) and `src/lib/db/data-api.ts` (neon-js Data API client) | **High** — every client component flows through this | Client-bundle secret test; session-persistence tests |
| 2 | `src/lib/supabase/server.ts` | Server client factory (`createServerClient` + Next cookie adapter) | New `src/lib/auth/server.ts` (`createNeonAuth({ baseUrl, cookies: { secret } })`) + `src/lib/db/index.ts` (Drizzle over `@neondatabase/serverless`) | **High** — all route-handler auth flows through this | Route 401 tests (exist, must keep passing); session tests |
| 3 | `middleware.ts` | Session refresh (`supabase.auth.getUser()`) + redirect gating for 8 protected path prefixes; redirects authed users off `/login`, `/signup` | `auth.middleware({ loginUrl })` from Neon Auth (Next 16 uses `proxy.ts`); keep the protected-path list; add disabled-member denial | **High** — auth boundary; Next 16 renames middleware→proxy | Middleware/proxy regression tests: anon→redirect, authed→pass, authed on /login→/dashboard, disabled member→denied |
| 4 | `src/app/api/auth/[...path]/route.ts` (new) | n/a (Supabase needs no auth route) | `export const { GET, POST } = auth.handler()` | Low | Handler smoke test |

### Auth UI

| # | File | Current purpose | Replacement | Risk | Tests required |
|---|---|---|---|---|---|
| 5 | `src/app/(auth)/login/page.tsx` | `supabase.auth.signInWithPassword` | `authClient.signIn.email(...)`; on success also verify active membership | Medium | Login success/failure; disabled-member login denied |
| 6 | `src/app/(auth)/signup/page.tsx` | **Public** `supabase.auth.signUp` (anyone can register) | Invite-only flow: signup allowed **only** for an email with a pending, unexpired invitation row; server-side check + membership activation. Public signup must be removed | **High** — this is the invite-only security boundary | Uninvited-email rejection; expired-invitation rejection; invited-email success path; acceptance timestamp set |
| 7 | `src/components/layout/Sidebar.tsx` | `supabase.auth.signOut()` | `authClient.signOut()` | Low | Logout clears session; redirect to /login |

### Server components (read paths)

| # | File | Current purpose | Replacement | Risk | Tests required |
|---|---|---|---|---|---|
| 8 | `src/app/(protected)/dashboard/page.tsx` | `getUser()` + selects from `profiles`, `onboarding_answers`, `watchlist_items`, `research_reports` | `auth.getSession()` + Drizzle server queries filtered by the session's member id (server component = privileged path ⇒ explicit `where member_id = session member` required) | Medium | Ownership filter unit tests; cross-member denial (RLS layer) |
| 9 | `src/app/(protected)/research/page.tsx` | `getUser()` + own `research_reports` list | Same as #8 | Medium | Same |
| 10 | `src/app/(protected)/leaps/page.tsx` | `getUser()` + own `leaps_recommendations` list | Same as #8 | Medium | Same |

### Client components (member-scoped CRUD — currently browser→Supabase directly)

| # | File | Current purpose | Replacement | Risk | Tests required |
|---|---|---|---|---|---|
| 11 | `src/app/(protected)/watchlist/page.tsx` | `watchlist_items` select/insert/delete from the browser | Data API (`neon-js .from('watchlist_items')`) with member JWT; **RLS is the enforcement layer** | Medium | RLS: cross-member watchlist denial; insert with false owner fails |
| 12 | `src/app/(protected)/portfolio/page.tsx` | `portfolio_holdings` select/insert/delete | Same pattern as #11 | Medium | RLS: cross-member portfolio denial |
| 13 | `src/app/(protected)/onboarding/page.tsx` | `getUser()` + `onboarding_answers` upsert | Data API upsert under RLS (owner-only WITH CHECK) | Medium | RLS: upsert with false owner fails |
| 14 | `src/app/(protected)/settings/page.tsx` | `getUser()` + `scoring_config` and `onboarding_answers` read/upsert (preserving `watching_stocks` — Phase 1 fix) | Data API under RLS; **must preserve the `watching_stocks` merge helper and its tests** | Medium | Existing `onboarding.test.ts` must keep passing; RLS ownership tests |
| 15 | `src/app/(protected)/research/[ticker]/page.tsx` | Loads latest own `research_reports` row for ticker (multi-line `supabase.from(...)`) | Data API select under RLS | Low | RLS read-own-only |
| 16 | `src/app/(protected)/leaps/[ticker]/page.tsx` | Loads latest own `leaps_recommendations` row | Data API select under RLS | Low | RLS read-own-only |

### API routes (server, privileged path — auth checked in-handler per Phase 1)

| # | File | Current purpose | Replacement | Risk | Tests required |
|---|---|---|---|---|---|
| 17 | `src/app/api/score/route.ts` | `getUser()`; `scoring_config` select; `stock_analyses` upsert | `auth.getSession()` + membership check; Drizzle with explicit `member_id` scoping (privileged path must never skip ownership) | Medium | Existing schema tests keep passing; anonymous 401; disabled-member 403 |
| 18 | `src/app/api/research/route.ts` | `getUser()`; `research_reports` insert (strict AI validation preserved) | Same; **all Phase 1 AI-response validation unchanged** | Medium | Existing `research-route.test.ts` must pass with new mocks |
| 19 | `src/app/api/leaps/route.ts` | `getUser()`; `stock_analyses` prerequisite lookup (409 `analysis_required`); `leaps_recommendations` insert | Same; prerequisite lookup via Drizzle scoped to member | Medium | Existing `leaps-route.test.ts` incl. 409 path |
| 20 | `src/app/api/chat/route.ts` | `getUser()`; `chat_messages` insert | Same | Low | Anonymous 401 |

### Tests currently mocking Supabase

| # | File | Current purpose | Replacement | Risk |
|---|---|---|---|---|
| 21 | `src/app/api/__tests__/research-route.test.ts` | Mocks `@/lib/supabase/server` | Re-point mocks at `@/lib/auth/server` + `@/lib/db` at cutover; assertions unchanged | Low |
| 22 | `src/app/api/__tests__/leaps-route.test.ts` | Same | Same | Low |

### Schema / SQL (Supabase-specific — cannot run on Neon)

| # | File | Supabase-specific construct | Replacement |
|---|---|---|---|
| 23 | `supabase/schema.sql` | `REFERENCES auth.users(id)` (10 tables); `auth.uid()` in every RLS policy; `auth.role() = 'authenticated'` (option_contracts read policy); `on_auth_user_created` trigger on `auth.users` inserting into `profiles`; seed of 21 mock contracts; per-user `scoring_config` backfill from `auth.users` | New Drizzle schema + SQL migrations in `drizzle/` (DDL): `members` table keyed to Neon Auth user id replaces the `auth.users` FK + profile trigger; policies use Neon's `auth.user_id()`; mock contracts seeded by `scripts/seed-mock.mjs`. `supabase/schema.sql` stays in place, marked legacy/non-executable, until the Neon schema is reviewed (per migration plan §10) |

Supabase-specific RLS policies replaced (all 12): `profiles` (view/update/insert own),
`onboarding_answers`, `watchlist_items`, `portfolio_holdings`, `stock_analyses`,
`research_reports`, `leaps_recommendations`, `chat_messages`, `scoring_config`
("users own …", all `auth.uid() = user_id`, `FOR ALL`, **no WITH CHECK** — the new
policies add explicit `WITH CHECK`), and `option_contracts`
(`auth.role() = 'authenticated'` read).

Supabase-specific triggers replaced (2): `on_auth_user_created` (profile creation —
replaced by invitation acceptance flow writing `members`), `update_*_updated_at`
(kept as plain Postgres triggers — not Supabase-specific, ported as-is).

### Documentation referencing Supabase

| # | File | Action at cutover |
|---|---|---|
| 24 | `.env.example` | Supabase vars removed once app code no longer reads them |
| 25 | `README.md` | Setup section rewritten for Neon (deferred to cutover PR) |

## Summary counts

- **20 active source files** import or call Supabase (2 factories, middleware,
  3 auth-UI surfaces, 3 server components, 6 client components, 4 API routes,
  + 2 test files mocking it).
- **1 legacy SQL schema** dependent on `auth.users` / `auth.uid()` / `auth.role()`.
- `supabase.rpc`, `supabase.storage`, realtime, and edge functions are **not
  used anywhere** — the migration surface is auth + PostgREST-style CRUD only.
