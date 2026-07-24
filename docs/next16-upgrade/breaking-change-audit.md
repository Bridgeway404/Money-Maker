# Next.js 16 Breaking-Change Audit — file-by-file

Inventory taken on `feat/next16-upgrade` at the `main` merge base, BEFORE
any codemod or manual change. Searches covered: `cookies()`, `headers()`,
`draftMode()`, route `params`, page `searchParams`, dynamic route handlers,
`middleware.ts`/exports, Supabase cookie/session handling, `next lint`,
`.eslintrc*`, eslint-in-next-config, webpack/turbopack config, `next/image`,
runtime config, parallel routes, Server Actions, cache APIs, deprecated
Next APIs, React-18-only APIs, old React types.

| File | Current behavior | Required change | Auth risk | Regression test |
|---|---|---|---|---|
| `middleware.ts` | Supabase session refresh (`getAll`/`setAll`), protected-path redirect to `/login?redirectTo=…`, authed redirect from `/login`,`/signup` → `/dashboard`; matcher excludes static assets | Rename to `proxy.ts`, export `proxy()`; logic + matcher unchanged; extract route-decision logic to a pure module | **HIGH** — this is the auth gate | Unit tests on the extracted decision logic (anon→login w/ redirectTo, authed pass-through, authed bounced off auth pages, public routes); static test: exactly one of middleware/proxy exists |
| `src/lib/supabase/server.ts` | `await cookies()` + modern cookie API | **None** (already Next 15+ style) | HIGH if touched — not touched | Static test asserts `await cookies()` remains |
| `src/lib/supabase/client.ts` | `createBrowserClient` | None (version bump only) | Medium | Existing route tests + build |
| `src/app/(protected)/research/[ticker]/page.tsx` | Client page; `params: Promise<{ticker}>` + `use(params)` | **None** (already async-params) | Low | Static test asserts Promise-typed params |
| `src/app/(protected)/leaps/[ticker]/page.tsx` | Same | **None** | Low | Same |
| `src/app/api/{chat,leaps,research,score}/route.ts` | `POST(request: NextRequest)`, auth inside handler; no ctx params | None | Medium | Existing 401/anonymous tests keep passing |
| `next.config.mjs` | `experimental.serverComponentsExternalPackages: ['@anthropic-ai/sdk']` | Rename to top-level `serverExternalPackages` | None | Static test: no `serverComponentsExternalPackages`; build |
| `.eslintrc.json` | `next/core-web-vitals` + ignores | Replace with flat `eslint.config.mjs`; delete `.eslintrc.json` | None | Static test: no `next lint` in scripts/CI; lint runs via CLI with both known warnings still reported |
| `package.json` scripts | `lint: next lint` | `lint: eslint .` (flat config) | None | Same |
| `package.json` deps | Next 14 / React 18 / eslint 8 / ssr 0.5 | Versions per compatibility.md; add `engines.node: 22.x` | Medium (ssr bump) | Full suite + build; bundle-safety tests |
| `.github/workflows/ci.yml` | Node 20 | Node 22 | None | CI itself |
| `.github/workflows/neon-development-validation.yml` | Node 20 | Node 22 (genuine compatibility fix — runs the same `npm ci` against `engines: 22.x`); no other change | None | Workflow untouched otherwise; static test keeps `workflow_dispatch`-only |
| `src/components/ui/{Card,Input,Select,Button}.tsx` + others | `forwardRef` (React 19-supported) | None | None | tsc + build under React 19 types |
| `src/app/**` `export const dynamic = 'force-dynamic'` (9 pages) | Valid in 16 | None | None | Build |

**Not present anywhere** (verified by search): `headers()`, `draftMode()`,
server-side `searchParams`, `next/image`, Server Actions (`'use server'`),
cache APIs, parallel routes (`@folder`), custom webpack/turbopack config,
runtime config (`publicRuntimeConfig`/`serverRuntimeConfig`),
`useFormState`/removed React 18 APIs, eslint config inside `next.config`,
`export const runtime`.

**Supabase auth flows to preserve byte-for-byte in behavior:** signup,
login (`signInWithPassword`), logout (`Sidebar`), session refresh
(middleware `getUser()` + cookie write-back), protected-route redirects
(8 path prefixes), authed redirects off `/login`+`/signup`,
server-component session access (server pages via `createClient()`),
API-route auth (all four handlers), cookie persistence via the
`getAll`/`setAll` contract, Vercel preview behavior (no env changes).
