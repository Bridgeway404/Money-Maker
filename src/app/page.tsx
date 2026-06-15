import Link from 'next/link'
import { Activity, TrendingUp, BookOpen, Star, Shield, ArrowRight, CheckCircle } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">LEAPS AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-8">
            <Activity className="h-3.5 w-3.5" />
            AI-Powered LEAPS Research
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Research Industry Leaders.
            <span className="text-emerald-400 block">Identify LEAPS Opportunities.</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            AI synthesizes 10-Ks, earnings calls, and technical data to surface the strongest
            LEAPS call option setups — the way a 20-year seasoned investor would.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-lg transition-all duration-150 shadow-lg shadow-emerald-900/30"
            >
              Start Research
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-semibold text-lg border border-zinc-800 hover:border-zinc-700 transition-all duration-150"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Built for Experienced Investors</h2>
          <p className="text-zinc-400 text-center mb-16 max-w-2xl mx-auto">
            Not another retail trading app. LEAPS AI is designed for investors who understand options
            and want deep research, not noise.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Deep Research Synthesis</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                AI analyzes 10-Ks, 10-Qs, earnings call transcripts, and recent news to build
                comprehensive research reports — covering cash flow, earnings quality, debt, and
                technical positioning.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">LEAPS Recommendations</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Get 3 ranked LEAPS call option contracts for each opportunity — specific expiration
                dates, strike prices, and premiums — with one clear front-runner and detailed
                reasoning behind the recommendation.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <Star className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Scoring System</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Every company gets a 1–100 LEAPS suitability score based on industry leadership,
                cash flow strength, earnings quality, debt levels, and proximity to the 200-week
                EMA. 90+ signals a strong opportunity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-zinc-400 text-center mb-16">Three steps to a well-researched LEAPS position.</p>
          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'Screen & Score',
                description:
                  'Enter a company\'s key metrics — industry rank, cash flow, earnings trend, debt level, and current price vs. 200-week EMA. The scoring engine instantly calculates a 1–100 suitability score, flagging disqualifiers before you waste time.',
              },
              {
                step: '02',
                title: 'Generate Research Report',
                description:
                  'AI produces a comprehensive research report: company overview, competitive position, financial analysis, technical setup, bull/bear case, and risks. Written like a seasoned investor, not a chatbot.',
              },
              {
                step: '03',
                title: 'Get LEAPS Recommendations',
                description:
                  'AI evaluates option contracts and outputs 3 ranked recommendations with specific expiration dates, strike prices, and premiums. One clear front-runner with full explanation. You decide whether to act.',
              },
            ].map(({ step, title, description }) => (
              <div key={step} className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <span className="text-sm font-bold text-emerald-400">{step}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we look for */}
      <section className="px-6 py-20 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">What Qualifies a LEAPS Candidate</h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Not every stock is worth a LEAPS position. We apply strict criteria derived from
            institutional-grade analysis.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              'Top 2–3 by market cap in their industry',
              'Strong, positive free cash flow',
              'Growing or stable earnings',
              'Low-to-moderate debt-to-equity ratio',
              'Stock within 5–10% of 200-week EMA',
              'Options with 12+ months to expiration',
              'Contracts depreciated ~40% from ATH',
              'Strong options volume and open interest',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="px-6 py-12 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-zinc-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-zinc-300 mb-1">Important Disclaimer</p>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  LEAPS AI is an educational and research tool only. All content, analysis, scores,
                  and recommendations are for informational purposes and do not constitute financial
                  advice, investment recommendations, or solicitation to buy or sell securities.
                  Options trading involves substantial risk of loss and is not suitable for all
                  investors. Past performance does not guarantee future results. Always consult a
                  licensed financial advisor before making investment decisions. This platform does
                  not execute trades or connect to brokerage accounts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-zinc-900 text-center">
        <p className="text-sm text-zinc-600">
          LEAPS AI Research Assistant — Educational Tool Only. Not Financial Advice.
        </p>
      </footer>
    </div>
  )
}
