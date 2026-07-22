'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { TrendingUp, RefreshCw, Crown, Shield, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MOCK_COMPANIES, MOCK_OPTION_CONTRACTS } from '@/lib/utils/mock-data'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge, { ScoreBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import RecommendationCard from '@/components/leaps/RecommendationCard'
import ChatPanel from '@/components/chat/ChatPanel'
import type { LeapsRecommendation } from '@/types'

interface PageProps {
  params: Promise<{ ticker: string }>
}

const DISCLAIMER =
  'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice. Options trading involves substantial risk of loss. Always consult a licensed financial advisor before making investment decisions.'

export default function LeapsTickerPage({ params }: PageProps) {
  const { ticker } = use(params)
  const upperTicker = ticker.toUpperCase()

  const [recommendation, setRecommendation] = useState<LeapsRecommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisRequired, setAnalysisRequired] = useState(false)

  const mockCompany = MOCK_COMPANIES.find((c) => c.ticker === upperTicker)
  const mockContracts = MOCK_OPTION_CONTRACTS[upperTicker] ?? []

  const supabase = createClient()

  useEffect(() => {
    loadExistingRecommendation()
  }, [ticker])

  async function loadExistingRecommendation() {
    setLoading(true)
    const { data } = await supabase
      .from('leaps_recommendations')
      .select('*')
      .eq('ticker', upperTicker)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    setRecommendation(data ?? null)
    setLoading(false)
  }

  async function generateRecommendations() {
    if (mockContracts.length === 0) {
      setError('No option contracts available for this ticker. Only mock tickers are supported in the MVP.')
      return
    }

    setGenerating(true)
    setError(null)
    setAnalysisRequired(false)

    const company = mockCompany ?? { ticker: upperTicker, company_name: upperTicker }

    try {
      // The server derives the stock-quality score from the user's stored
      // screener analysis. No score is sent from the client, and there is no
      // fabricated fallback — if no analysis exists, the API says so.
      const res = await fetch('/api/leaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: upperTicker,
          company_name: company.company_name,
          contracts: mockContracts,
        }),
      })

      if (!res.ok) {
        let body: { error?: string; message?: string } = {}
        try {
          body = await res.json()
        } catch {
          // fall through to the generic error below
        }
        if (body.error === 'analysis_required') {
          setAnalysisRequired(true)
          setError(
            body.message ??
              `Score ${upperTicker} in the screener first — recommendations require a stored analysis.`
          )
          return
        }
        setError(body.message ?? 'Failed to generate LEAPS recommendations. Please try again.')
        return
      }
      const data = await res.json()
      setRecommendation(data)
    } catch {
      setError('Failed to generate LEAPS recommendations. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" label="Loading recommendations..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header
        title={`${upperTicker} LEAPS Ideas`}
        description={
          mockCompany
            ? `${mockCompany.company_name} — ${mockCompany.industry}`
            : `LEAPS call option recommendations for ${upperTicker}`
        }
        actions={
          <div className="flex gap-2">
            {recommendation && (
              <Button variant="secondary" size="sm" onClick={generateRecommendations} loading={generating}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            )}
          </div>
        }
      />

      {/* Company context */}
      {mockCompany && (
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono font-bold text-zinc-100">{mockCompany.ticker}</span>
                <Badge variant="outline">{mockCompany.industry}</Badge>
                <Badge variant="success">#{mockCompany.market_cap_rank} in Industry</Badge>
              </div>
              <p className="text-zinc-400 text-sm max-w-2xl">{mockCompany.description}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-zinc-400">Current Price</p>
              <p className="font-bold text-zinc-100 text-lg">${mockCompany.current_price}</p>
              <p className="text-xs text-zinc-500">200W EMA: ${mockCompany.ema_200_week}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Options data note */}
      <div className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20 flex items-start gap-2">
        <Shield className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
        <p className="text-xs text-yellow-300">
          <span className="font-medium">Sample Data:</span> Option contracts below are illustrative mock data for
          demonstration purposes. Real-time options pricing requires a market data subscription (V2 feature).
        </p>
      </div>

      {/* Available contracts */}
      {mockContracts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Available Contracts (Sample Data)</h3>
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2.5 text-zinc-500 font-medium uppercase tracking-wider">Expiration</th>
                    <th className="text-right px-4 py-2.5 text-zinc-500 font-medium uppercase tracking-wider">Strike</th>
                    <th className="text-right px-4 py-2.5 text-zinc-500 font-medium uppercase tracking-wider">Premium</th>
                    <th className="text-right px-4 py-2.5 text-zinc-500 font-medium uppercase tracking-wider">From ATH</th>
                    <th className="text-right px-4 py-2.5 text-zinc-500 font-medium uppercase tracking-wider">Delta</th>
                    <th className="text-right px-4 py-2.5 text-zinc-500 font-medium uppercase tracking-wider">IV</th>
                    <th className="text-right px-4 py-2.5 text-zinc-500 font-medium uppercase tracking-wider">Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {mockContracts.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5 text-zinc-300">{new Date(c.expiration_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-zinc-200">${c.strike_price}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-zinc-200">${c.current_premium.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-rose-400 font-medium">-{c.depreciation_pct.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">{c.delta.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-300">{(c.implied_volatility * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-right text-zinc-400">{c.volume.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Generate / Results */}
      {!recommendation && !generating ? (
        <Card className="text-center py-12">
          <TrendingUp className="h-10 w-10 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 font-medium mb-2">
            Ready to generate LEAPS recommendations for {upperTicker}
          </p>
          <p className="text-zinc-600 text-sm mb-6">
            AI will analyze all {mockContracts.length} option contracts and rank them with reasoning.
          </p>
          {error && (
            <p className="text-sm text-rose-400 mb-4">{error}</p>
          )}
          <div className="flex items-center justify-center gap-3">
            <Button onClick={generateRecommendations} size="lg" disabled={mockContracts.length === 0}>
              <TrendingUp className="h-4 w-4" /> Generate LEAPS Recommendations
            </Button>
            {analysisRequired && (
              <Link href="/screener">
                <Button variant="secondary" size="lg">
                  <Search className="h-4 w-4" /> Run Screener Analysis
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : generating ? (
        <div className="flex flex-col items-center justify-center py-24">
          <LoadingSpinner size="lg" />
          <p className="text-zinc-300 font-medium mt-6">Analyzing Option Contracts...</p>
          <p className="text-zinc-500 text-sm mt-2">
            AI is evaluating all contracts and ranking recommendations.
          </p>
        </div>
      ) : recommendation ? (
        <div className="space-y-6">
          {/* Front runner highlight */}
          {recommendation.front_runner_explanation && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-emerald-400">Front-Runner Analysis</h3>
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                {recommendation.front_runner_explanation}
              </p>
            </Card>
          )}

          {/* Recommendation cards */}
          <div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-4">
              All 3 Recommendations
            </h3>
            <div className="space-y-4">
              {recommendation.recommendations
                .sort((a, b) => a.rank - b.rank)
                .map((rec, i) => (
                  <RecommendationCard key={i} recommendation={rec} />
                ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-500 leading-relaxed">
            <span className="font-medium text-zinc-400">Disclaimer: </span>
            {recommendation.disclaimer || DISCLAIMER}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-400/10 border border-rose-400/20">
              <p className="text-sm text-rose-400">{error}</p>
            </div>
          )}
        </div>
      ) : null}

      <ChatPanel
        contextTicker={upperTicker}
        initialMessage={
          recommendation
            ? `I've evaluated ${upperTicker} LEAPS contracts. Ask me anything about the recommendations, strike selection, expiration rationale, or options strategy.`
            : `I can help you understand LEAPS strategy for ${upperTicker}. Ask me anything about options mechanics, strike selection, or how to evaluate these contracts.`
        }
      />
    </div>
  )
}
