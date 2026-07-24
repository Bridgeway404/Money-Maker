# Phase 1.5 Baseline — main @ `4e4b469` (PR #3 merge)

Recorded before any upgrade change, from a clean `npm ci` on the merge
commit `4e4b4699bb27a4962e883a733177e8e9f6ca7197`.

## Verification results (baseline)

| Check | Result |
|---|---|
| `npm ci` | clean (lockfile in sync) |
| `tsc --noEmit` | clean |
| `next lint` | passes — 2 known warnings (below) |
| `vitest run` | **204 passed, 24 skipped** (live Neon suite, env-gated) |
| `next build` | ✓ Compiled successfully; 18/18 static pages |
| `npm audit` | 9 known advisories, all against **next@14.2.35** (+ its bundled postcss) — the audit's own fix is `next@16.2.11`, i.e. this upgrade |
| Neon imports in `src/` | **0** references to `@neondatabase`, `drizzle`, or `DATABASE_URL` (also test-enforced) |

## Package versions (before)

| Package | Version |
|---|---|
| next | 14.2.35 |
| react / react-dom | ^18 (18.3.x installed) |
| @types/react / @types/react-dom | ^18 |
| @supabase/supabase-js | ^2.45.4 |
| @supabase/ssr | ^0.5.1 |
| eslint | ^8 (8.57.1 installed) |
| eslint-config-next | 14.2.35 |
| typescript | ^5 (5.9.3 installed) |
| @types/node | ^20 |
| vitest | ^4.1.10 |
| tailwindcss / postcss / autoprefixer | ^3.4.1 / ^8 / ^10 |
| drizzle-orm / drizzle-kit / @neondatabase/serverless | ^0.45.2 / ^0.31.10 / ^1.1.0 (tooling only) |

## Node & build system

- No `engines` field, no `.nvmrc`. CI (`ci.yml` and the manual Neon
  validation workflow) pins `actions/setup-node` to Node 20. Local container:
  Node 22.
- Build: `next build` (webpack — Next 14 default). No custom webpack or
  turbopack configuration. `next.config.mjs` contains exactly one setting:
  `experimental.serverComponentsExternalPackages: ['@anthropic-ai/sdk']`.
- Lint: `next lint` via `.eslintrc.json` → `extends: next/core-web-vitals`,
  ignoring `archive/` and `deploy-placeholder/`.

## Middleware behavior (to preserve exactly)

`middleware.ts` (root): creates a Supabase server client over the request
cookies (modern `getAll`/`setAll` API), calls `supabase.auth.getUser()`
(session refresh — writes refreshed auth cookies onto the response), then:

- anonymous + path starts with one of `/dashboard /onboarding /watchlist
  /portfolio /screener /research /leaps /settings` → redirect to
  `/login?redirectTo=<pathname>`;
- authenticated + path is exactly `/login` or `/signup` → redirect to
  `/dashboard`;
- otherwise pass through `supabaseResponse` (carrying refreshed cookies).

Matcher: everything except `_next/static`, `_next/image`, `favicon.ico`,
and common image extensions.

## Supabase authentication paths (unchanged by this PR)

- `src/lib/supabase/server.ts` — server client; **already `await cookies()`**
  (Next 15-style async request API), modern cookie API.
- `src/lib/supabase/client.ts` — browser client (`createBrowserClient`).
- Login/signup pages: `signInWithPassword` / `signUp` via the browser client.
- `Sidebar.tsx`: `signOut`.
- All 4 API routes authenticate via the server client inside the handler.

## Existing warnings

1. `react-hooks/exhaustive-deps` in `leaps/[ticker]/page.tsx:43`
2. `react-hooks/exhaustive-deps` in `research/[ticker]/page.tsx:57`

Both pre-date this work and remain warnings (not upgrade defects).
GitHub Actions also prints a runner-level "Node 20 is being deprecated"
notice about the `actions/*` helpers — distinct from the application's Node
runtime; both are addressed by moving CI to Node 22 in this PR.

## Test counts (before)

204 passed + 24 skipped (the env-gated live Neon RLS suite) = 228 total.
