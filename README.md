# LEAPS Research Assistant

An educational stock and LEAPS-options research prototype built with **Next.js +
Supabase**, with AI narrative generated server-side via the Anthropic API.

> **Canonical application:** the Next.js app in `src/` at the repository root is
> the one and only LEAPS application. The earlier standalone HTML prototype and
> its Netlify function were retired in Phase 1 and preserved under
> [`archive/`](archive/README.md) — they must not be deployed or used.

> **Data status (Phase 1):** this prototype has **no market-data, fundamentals,
> news, or options-data providers**. Company examples are labeled sample data,
> all option contracts are labeled mock data, screener inputs are user-entered,
> and AI report text is unverified narrative. Nothing in this app is a live
> quote or a trade recommendation. Real data providers are planned for Phase 2.

## Prerequisites

- Node.js 18+ (CI runs on Node 20)
- A Supabase account and project
- An Anthropic API key

## Installation

```bash
npm install
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (safe for the browser; RLS enforces access) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key — **server-side only**, never sent to the browser |
| `ANTHROPIC_MODEL` | No | Claude model id override (default `claude-sonnet-4-6`; validated in `src/lib/ai/model.ts`) |

No other environment variables are used. (`SUPABASE_SERVICE_ROLE_KEY` was
declared in earlier versions but never used by any code and has been removed.)

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, run the contents of `supabase/schema.sql`
3. This creates all tables, row-level-security policies, triggers, and seeds
   the clearly-labeled mock option-contract data

## Development

```bash
npm run dev        # start the dev server on http://localhost:3000
npm run typecheck  # TypeScript, no emit
npm run lint       # ESLint (next/core-web-vitals)
npm run test       # Vitest unit tests
npm run build      # production build
npm run verify     # typecheck + lint + test + build (what CI runs)
```

CI (`.github/workflows/ci.yml`) runs `verify` on pull requests and on pushes to
the default branch.

> **Default branch:** the default branch is being renamed to `main`. The push
> CI trigger already lists `main`; the interim Claude-named branch
> (`claude/leaps-research-assistant-mvp-t7voo2`) stays in the trigger only until
> the GitHub rename occurs and will be removed in the Phase 1.5 PR. Treat `main`
> as the canonical branch going forward.

## Deployment

Deploy the Next.js app to **Vercel** (or any Node.js host):

1. Import the repository in [Vercel](https://vercel.com)
2. Set the environment variables above in the project settings
3. Deploy

**Netlify note:** the root `netlify.toml` is intentionally a decommission
configuration. It publishes only `deploy-placeholder/` (a static retirement
notice) so that any Netlify site still connected to this repository stops
serving the archived static prototype. Do not point Netlify at the archive.

## Application Structure

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login`, `/signup` | Supabase email/password auth |
| `/onboarding` | 5-step profile setup |
| `/dashboard` | Overview (highlights are labeled sample data) |
| `/screener` | Deterministic 0–100 LEAPS-suitability score from user-entered metrics |
| `/research/[ticker]` | AI background briefing (labeled unverified prototype narrative) |
| `/leaps/[ticker]` | AI ranking of the labeled mock option contracts |
| `/watchlist`, `/portfolio` | Manual tracking (no live valuations) |
| `/settings` | Scoring weights (must total 100) and profile preferences |

| API route | Method | Notes |
|-----------|--------|-------|
| `/api/score` | POST | Deterministic score; validates metrics and weights; auth required |
| `/api/research` | POST | AI narrative; score is deterministic or omitted — never AI-invented; no news section |
| `/api/leaps` | POST | Requires a stored screener analysis (409 `analysis_required` otherwise); AI ranking is schema-validated and bounds-checked |
| `/api/chat` | POST | Grounded persona; input length limits enforced |

All four API routes check Supabase authentication **inside the route** — the
middleware redirect is a convenience, not the security boundary.

### Scoring

Scoring is 100% deterministic (`src/lib/scoring/index.ts`): weights over
industry leadership (25), cash flow (20), earnings quality (20), debt-to-equity
(10), 200-week-EMA distance (15), option affordability (5), and option
expiration (5). Negative cash flow, declining earnings, or a non-top-3 industry
rank disqualify (score 0). Custom weights must total exactly 100 and are
validated server-side. The AI never produces or overrides a score.

## Repository Layout

```
src/                 Canonical Next.js application
  app/               Pages + API routes
  lib/scoring/       Deterministic scoring + EMA math
  lib/validation/    Request validation for all API routes
  lib/ai/            Anthropic client, model config, prompts, AI-response validation
supabase/schema.sql  Database schema, RLS, mock-contract seed data
archive/             Retired static prototype + Netlify function (NOT deployed)
deploy-placeholder/  Static notice page published by the decommission netlify.toml
```

## Roadmap

- **Phase 2** — real market-data + fundamentals providers (porting the provider
  abstraction preserved in `archive/netlify-market-recommendations/`), then a
  real options-chain provider to replace the mock contracts
- **Phase 3+** — grounded research reports, personalization, risk controls

## Disclaimer

This tool is for educational and research purposes only. All content, scores,
and AI narrative are prototype output and do not constitute financial advice.
Options trading involves substantial risk of loss. Past performance does not
guarantee future results. Always consult a licensed financial advisor before
making investment decisions.
