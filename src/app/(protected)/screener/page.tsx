'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, AlertTriangle, ChevronDown } from 'lucide-react'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import ScoreDisplay from '@/components/screener/ScoreDisplay'
import { MOCK_COMPANIES } from '@/lib/utils/mock-data'
import { calculateEmaDistance } from '@/lib/scoring'
import type { StockMetrics, StockScore, Industry, MarketCapRank, CashFlowStatus, EarningsTrend, DebtToEquityLevel } from '@/types'

const INDUSTRY_OPTIONS = [
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Semiconductors', label: 'Semiconductors' },
  { value: 'Industrials', label: 'Industrials' },
  { value: 'Consumer Products', label: 'Consumer Products' },
  { value: 'Financial', label: 'Financial' },
]

export default function ScreenerPage() {
  const router = useRouter()
  const [score, setScore] = useState<StockScore | null>(null)
  const [currentMetrics, setCurrentMetrics] = useState<StockMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [ticker, setTicker] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState<Industry>('Technology')
  const [marketCapRank, setMarketCapRank] = useState<MarketCapRank>('1st')
  const [cashFlow, setCashFlow] = useState<CashFlowStatus>('Strong')
  const [earningsTrend, setEarningsTrend] = useState<EarningsTrend>('Growing')
  const [debtToEquity, setDebtToEquity] = useState<DebtToEquityLevel>('Low')
  const [currentPrice, setCurrentPrice] = useState('')
  const [ema200, setEma200] = useState('')

  function loadMockCompany(mockTicker: string) {
    const company = MOCK_COMPANIES.find((c) => c.ticker === mockTicker)
    if (!company) return

    setTicker(company.ticker)
    setCompanyName(company.company_name)
    setIndustry(company.industry)
    setMarketCapRank(company.market_cap_rank)
    setCashFlow(company.cash_flow)
    setEarningsTrend(company.earnings_trend)
    setDebtToEquity(company.debt_to_equity)
    setCurrentPrice(company.current_price.toString())
    setEma200(company.ema_200_week.toString())
    setScore(null)
  }

  async function handleScore() {
    if (!ticker || !companyName || !currentPrice || !ema200) {
      setError('Please fill in all required fields.')
      return
    }

    const price = parseFloat(currentPrice)
    const ema = parseFloat(ema200)
    const emaDistance = calculateEmaDistance(price, ema)

    const metrics: StockMetrics = {
      ticker: ticker.toUpperCase(),
      company_name: companyName,
      industry,
      market_cap_rank: marketCapRank,
      cash_flow: cashFlow,
      earnings_trend: earningsTrend,
      debt_to_equity: debtToEquity,
      current_price: price,
      ema_200_week: ema,
      ema_distance_pct: emaDistance,
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics }),
      })

      if (!res.ok) throw new Error('Failed to score')
      const scoreData = await res.json()
      setScore(scoreData)
      setCurrentMetrics(metrics)
    } catch {
      setError('Failed to calculate score. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const emaDistance =
    currentPrice && ema200
      ? calculateEmaDistance(parseFloat(currentPrice), parseFloat(ema200))
      : null

  return (
    <div className="space-y-6">
      <Header
        title="Stock Screener"
        description="Evaluate a company for LEAPS option suitability. Score 90+ signals a strong opportunity."
      />

      {/* Sample companies */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
          Sample Data — Load a pre-built company:
        </p>
        <div className="flex flex-wrap gap-2">
          {MOCK_COMPANIES.map((c) => (
            <button
              key={c.ticker}
              onClick={() => loadMockCompany(c.ticker)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm text-zinc-300 font-mono transition-colors"
            >
              {c.ticker}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form */}
        <Card>
          <h3 className="text-base font-semibold text-zinc-100 mb-5">Company Metrics</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
              />
              <Input
                label="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Apple Inc."
              />
            </div>
            <Select
              label="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value as Industry)}
              options={INDUSTRY_OPTIONS}
            />
            <Select
              label="Market Cap Rank"
              value={marketCapRank}
              onChange={(e) => setMarketCapRank(e.target.value as MarketCapRank)}
              options={[
                { value: '1st', label: '#1 in Industry (Largest)' },
                { value: '2nd', label: '#2 in Industry' },
                { value: '3rd', label: '#3 in Industry' },
                { value: 'Other', label: 'Outside Top 3 (Disqualifies)' },
              ]}
              hint="Only top 2-3 companies by market cap qualify"
            />
            <Select
              label="Cash Flow"
              value={cashFlow}
              onChange={(e) => setCashFlow(e.target.value as CashFlowStatus)}
              options={[
                { value: 'Strong', label: 'Strong — Consistently generating significant FCF' },
                { value: 'Positive', label: 'Positive — Cash flow positive but moderate' },
                { value: 'Negative', label: 'Negative — Cash burn (DISQUALIFIES)' },
              ]}
            />
            <Select
              label="Earnings Trend"
              value={earningsTrend}
              onChange={(e) => setEarningsTrend(e.target.value as EarningsTrend)}
              options={[
                { value: 'Growing', label: 'Growing — EPS consistently increasing YoY' },
                { value: 'Stable', label: 'Stable — Consistent but flat earnings' },
                { value: 'Declining', label: 'Declining — EPS falling (DISQUALIFIES)' },
              ]}
            />
            <Select
              label="Debt-to-Equity"
              value={debtToEquity}
              onChange={(e) => setDebtToEquity(e.target.value as DebtToEquityLevel)}
              options={[
                { value: 'Low', label: 'Low — D/E < 0.5' },
                { value: 'Moderate', label: 'Moderate — D/E 0.5–1.5' },
                { value: 'High', label: 'High — D/E > 1.5' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Current Stock Price ($)"
                type="number"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="213.50"
                min="0.01"
                step="0.01"
              />
              <Input
                label="200-Week EMA ($)"
                type="number"
                value={ema200}
                onChange={(e) => setEma200(e.target.value)}
                placeholder="198.20"
                min="0.01"
                step="0.01"
              />
            </div>

            {emaDistance !== null && currentPrice && ema200 && (
              <div className={`p-3 rounded-lg border text-sm ${
                Math.abs(emaDistance) <= 10
                  ? 'bg-emerald-400/5 border-emerald-400/20 text-emerald-300'
                  : Math.abs(emaDistance) <= 20
                  ? 'bg-yellow-400/5 border-yellow-400/20 text-yellow-300'
                  : 'bg-rose-400/5 border-rose-400/20 text-rose-300'
              }`}>
                <p className="font-medium">EMA Distance: {emaDistance >= 0 ? '+' : ''}{emaDistance.toFixed(2)}%</p>
                <p className="text-xs mt-0.5 opacity-75">
                  {Math.abs(emaDistance) <= 10
                    ? 'Ideal range — within 10% of 200-week EMA'
                    : Math.abs(emaDistance) <= 20
                    ? 'Acceptable — 10-20% from EMA; timing is less ideal'
                    : 'Poor timing — more than 20% from 200-week EMA'}
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-rose-400/10 border border-rose-400/20">
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}

            <Button onClick={handleScore} loading={loading} fullWidth size="lg">
              <Search className="h-4 w-4" /> Calculate Score
            </Button>
          </div>
        </Card>

        {/* Score display */}
        <div className="space-y-4">
          {score && currentMetrics ? (
            <>
              <ScoreDisplay score={score} ticker={currentMetrics.ticker} />

              {!score.disqualified && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => router.push(`/research/${currentMetrics.ticker}`)}
                    fullWidth
                    variant="secondary"
                  >
                    Generate Research Report
                  </Button>
                  <Button
                    onClick={() => router.push(`/leaps/${currentMetrics.ticker}`)}
                    fullWidth
                  >
                    Get LEAPS Ideas
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center text-center py-16">
              <Search className="h-10 w-10 text-zinc-700 mb-4" />
              <p className="text-zinc-400 font-medium">Enter company metrics</p>
              <p className="text-zinc-600 text-sm mt-1">
                Fill in the form and click Calculate Score to evaluate LEAPS suitability.
              </p>
            </Card>
          )}

          {/* Scoring guide */}
          <Card variant="bordered">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">Scoring Guide</h4>
            <div className="space-y-2 text-xs text-zinc-400">
              {[
                { range: '90–100', label: 'Strong Buy', color: 'text-emerald-400' },
                { range: '80–89', label: 'Buy', color: 'text-green-400' },
                { range: '60–79', label: 'Watch', color: 'text-yellow-400' },
                { range: '40–59', label: 'Weak', color: 'text-orange-400' },
                { range: '0–39', label: 'Avoid', color: 'text-rose-400' },
              ].map(({ range, label, color }) => (
                <div key={range} className="flex items-center justify-between">
                  <span className={`font-mono font-medium ${color}`}>{range}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-500">
              Negative cash flow, declining earnings, or non-industry-leaders score 0 (disqualified).
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
