# LEAPS Research Assistant

An AI-powered stock and options research tool for experienced investors. Identifies industry leaders primed for LEAPS call option investments using Claude AI.

## Prerequisites

- Node.js 18+
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

Required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI |

## Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Paste and run the contents of `supabase/schema.sql`
4. This creates all tables, RLS policies, triggers, and seeds mock option contract data

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

1. Push to a GitHub repository
2. Import the project in [Vercel](https://vercel.com)
3. Add all environment variables in the Vercel project settings
4. Deploy

## App Architecture

### Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Email/password sign in |
| `/signup` | Account creation |
| `/onboarding` | 5-step profile setup |
| `/dashboard` | Overview with weekly opportunities |
| `/screener` | Score a company for LEAPS suitability |
| `/research/[ticker]` | AI research report for a stock |
| `/leaps/[ticker]` | 3 ranked LEAPS recommendations |
| `/watchlist` | Manage stocks you are tracking |
| `/portfolio` | Track current stock holdings |
| `/settings` | Adjust scoring weights and profile |

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/research` | POST | Generate AI research report |
| `/api/score` | POST | Calculate 1-100 LEAPS suitability score |
| `/api/leaps` | POST | Generate 3 ranked LEAPS recommendations |
| `/api/chat` | POST | Follow-up Q&A with context |

### Scoring System (100 points total)

| Factor | Default Weight | Notes |
|--------|---------------|-------|
| Industry Leadership | 25 | Top 2-3 by market cap required |
| Cash Flow | 20 | Strong FCF = full points; Negative = disqualified |
| Earnings Quality | 20 | Growing EPS = full; Declining = disqualified |
| Debt-to-Equity | 10 | Low D/E preferred |
| 200-Week EMA Distance | 15 | Within 10% = ideal entry |
| Option Affordability | 5 | Based on purchasing power |
| Option Expiration | 5 | 12+ months preferred |

**Score interpretation:**
- 90–100: Strong Buy
- 80–89: Buy
- 60–79: Watch
- 40–59: Weak
- 0–39: Avoid

**Automatic disqualifiers (score = 0):**
- Negative cash flow
- Declining earnings
- Not in top 3 by market cap

### LEAPS Selection Criteria

1. Calls only, 12+ months expiration (longer is better)
2. Options depreciated ~40% from all-time high premium (on sale)
3. Strike price near ATM (delta 0.40–0.60 preferred)
4. Strong volume and open interest for liquidity
5. Not excessive IV (avoid overpriced premiums)

## V2 Roadmap

- Real-time options pricing via market data API
- Brokerage connection (read-only portfolio import)
- Weekly email digest of top opportunities
- Alert system for EMA crossovers
- Multi-leg strategy analysis
- Comparative analysis across same-industry peers

## Disclaimer

This tool is for educational and research purposes only. All content, scores, and recommendations do not constitute financial advice. Options trading involves substantial risk of loss. Past performance does not guarantee future results. Always consult a licensed financial advisor before making investment decisions.
