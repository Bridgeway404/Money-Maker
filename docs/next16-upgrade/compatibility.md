# Next.js 16 Upgrade — Verified Requirements

All versions verified against the npm registry on 2026-07-24 (`npm view …`
from this workspace — the registry is the source of truth for versions and
peer ranges; statements below cite the exact fields read).

## Target versions

| Package | Latest stable | Chosen | Basis |
|---|---|---|---|
| next | **16.2.11** | 16.2.11 | `npm view next version`; matches `npm audit`'s own fix target for the 9 open advisories |
| react / react-dom | 19.2.8 | ^19.2.8 | `next@16.2.11` peers: `react: ^18.2.0 || ^19.0.0` — React 19 is the supported pairing for 16 |
| @types/react | 19.2.17 | ^19.2.17 | matches React 19 |
| @types/react-dom | 19.2.3 | ^19.2.3 | matches React 19 |
| eslint-config-next | 16.2.11 | 16.2.11 | version-locked to next |
| eslint | 10.7.0 latest; **9.x chosen** | ^9 | `eslint-config-next@16.2.11` peers `eslint >=9.0.0`; 9.x is the mature flat-config line the Next docs target — not jumping an extra ESLint major in the same PR |
| typescript | 7.0.2 latest; **5.9.x kept** | ^5 | `eslint-config-next` peers `typescript >=3.3.1`; TS 7 is a separate major migration and out of scope |
| @supabase/ssr | 0.12.3 | ^0.12.3 | current line; peers `@supabase/supabase-js ^2.110.5` |
| @supabase/supabase-js | 2.110.8 | ^2.110.8 | required by @supabase/ssr 0.12.x |
| @types/node | — | ^22 | match the selected Node runtime |

Staging: commit A first moves to **next@15.5.21** (latest 15.x per registry)
with React 19, proving the intermediate step green before the 16 jump.
No canary or RC packages anywhere.

## Node.js

- `next@16.2.11` `engines`: **`node >=20.9.0`** (read from the package).
- **Chosen: Node 22 (LTS)** — current LTS, already the workspace runtime
  (v22.22.2), supported by Vercel's Node 22.x runtime, and above Next's
  floor. Applied via `package.json` `engines.node: "22.x"` (pins Vercel),
  `.nvmrc` (`22`), and both GitHub workflows (`node-version: 22`).
- Distinct from the GitHub Actions runner notice about Node 20 for the
  `actions/*` helpers — that is the runner's internal runtime; updating
  `actions/setup-node` to install Node 22 fixes our application runtime,
  and checkout/setup-node v4+ run fine on the runner's Node 24.

## Framework changes that apply to THIS codebase (audit: breaking-change-audit.md)

1. **Async request APIs** — `cookies()` is already awaited
   (`src/lib/supabase/server.ts`); no `headers()`/`draftMode()` usage.
   Both dynamic pages already type `params` as `Promise<…>` and unwrap with
   `React.use()`. No server-side `searchParams` usage.
2. **`middleware.ts` → `proxy.ts`** — Next 16 renames the convention (file
   and exported function `proxy`). The Supabase session-refresh pattern is
   unchanged inside it: the `@supabase/ssr` `getAll`/`setAll` request/response
   cookie flow works identically in `proxy.ts`; only the file name and
   function name change. Matcher config carries over as-is.
3. **`next lint` removed** — replaced by the ESLint CLI with flat config
   (`eslint.config.mjs`). `eslint-config-next` legacy shareable configs are
   consumed via `@eslint/eslintrc` `FlatCompat` (the officially documented
   bridge) unless the installed package exposes native flat exports
   (checked at install time).
4. **`experimental.serverComponentsExternalPackages` →
   `serverExternalPackages`** (stable since 15).
5. **Turbopack is the default bundler for `next build`** in 16. Attempted
   first with default config; fallback `next build --webpack` only with a
   documented incompatibility.

## Non-issues verified for this codebase

- No `next/image`, no Server Actions, no cache APIs
  (`revalidate`/`unstable_cache`), no parallel routes, no custom
  webpack/turbopack config, no runtime config, no `useFormState` or other
  removed React 18 APIs. `forwardRef` (5 UI components) remains supported
  in React 19 (deprecated in favor of ref-as-prop, but not removed —
  no change needed or made).
- `@supabase/ssr` 0.12.x: the repo already used the modern
  `getAll`/`setAll` cookie contract in all three integration points, so no
  deprecated storage methods needed migrating. **However, the bump did
  require response-handling adaptation** (route behavior itself was
  unchanged): since 0.10, `setAll` receives a **second argument** — headers
  (`Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`,
  `Expires: 0`, `Pragma: no-cache`) that must be set on any response that
  writes auth cookies, so a CDN can never cache one user's session for
  another. The proxy now records the exact refreshed-cookie records and
  those supplied headers (`src/lib/auth/supabase-auth-state.ts`) and applies
  both to the pass-through response **and to every redirect response** —
  previously redirects were fresh `NextResponse.redirect(...)` objects that
  silently dropped the refreshed cookies and headers, risking cached auth
  responses and browser/server session drift (premature logout, redirect
  loops). Only Supabase-supplied state is copied onto redirects — never
  arbitrary internal Next.js middleware headers.

## @neondatabase/auth — documentation only (NOT added in this PR)

`npm view @neondatabase/auth@0.4.2-beta peerDependencies`:
`react >=18`, `react-dom >=18`, **`next >=16.0.0`** — this upgrade clears
the peer blocker recorded in `docs/neon-migration/02`. The package is
deliberately not installed here; the Neon Auth cutover is its own PR.

## Constraint note

Live doc pages (nextjs.org, vercel.com) are unreachable from this
workspace's egress policy; the npm registry (versions, peer ranges,
engines) plus the official codemod output are the verified sources used.
Anything that could not be verified is listed in the PR as a risk instead
of asserted.
