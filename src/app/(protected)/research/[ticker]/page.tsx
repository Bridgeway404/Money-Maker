'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  TrendingUp,
  DollarSign,
  BarChart2,
  Newspaper,
  Scale,
  Target,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MOCK_COMPANIES } from '@/lib/utils/mock-data'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge, { ScoreBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ChatPanel from '@/components/chat/ChatPanel'
import type { ResearchReport } from '@/types'

interface PageProps {
  params: Promise<{ ticker: string }>
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'financials', label: 'Financials', icon: DollarSign },
  { id: 'technical', label: 'Technical', icon: BarChart2 },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'bull-bear', label: 'Bull/Bear', icon: Scale },
  { id: 'risks', label: 'Risks', icon: AlertCircle },
]

export default function ResearchTickerPage({ params }: PageProps) {
  const { ticker } = use(params)
  const router = useRouter()
  const [report, setReport] = useState<ResearchReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [error, setError] = useState<string | null>(null)

  const upperTicker = ticker.toUpperCase()
  const mockCompany = MOCK_COMPANIES.find((c) => c.ticker === upperTicker)

  const supabase = createClient()

  async function loadExistingReport() {
    setLoading(true)
    const { data } = await supabase
      .from('research_reports')
      .select('*')
      .eq('ticker', upperTicker)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    setReport(data ?? null)
    setLoading(false)
  }

  useEffect(() => {
    loadExistingReport()
  }, [ticker])



  async function generateReport() {
    if (!mockCompany && !upperTicker) return
    setGenerating(true)
    setError(null)

    const company = mockCompany ?? {
      ticker: upperTicker,
      company_name: upperTicker,
      industry: 'Technology',
    }

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: upperTicker,
          company_name: company.company_name,
          industry: company.industry,
          metrics: mockCompany
            ? {
                industry: mockCompany.industry,
                market_cap_rank: mockCompany.market_cap_rank,
                cash_flow: mockCompany.cash_flow,
                earnings_trend: mockCompany.earnings_trend,
                debt_to_equity: mockCompany.debt_to_equity,
                current_price: mockCompany.current_price,
                ema_200_week: mockCompany.ema_200_week,
              }
            : undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to generate report')
      const newReport = await res.json()
      setReport(newReport)
    } catch {
      setError('Failed to generate research report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" label="Loading research..." />
      </div>
    )
  }

  const companyName = report?.company_name ?? mockCompany?.company_name ?? upperTicker
  const industry = report?.industry ?? mockCompany?.industry ?? 'Unknown'

  return (
    <div className="space-y-6">
      <Header
        title={`${upperTicker} Research`}
        description={`${companyName} — ${industry}`}
        actions={
          <div className="flex gap-2">
            {report && (
              <Button
                variant="secondary"
                size="sm"
                onClick={generateReport}
                loading={generating}
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => router.push(`/leaps/${upperTicker}`)}
            >
              <TrendingUp className="h-4 w-4" /> Get LEAPS Ideas
            </Button>
          </div>
        }
      />

      {!report && !generating ? (
        <Card className="text-center py-16">
          <BookOpen className="h-10 w-10 text-zinc-700 mx-auto mb-4" />
          {mockCompany ? (
            <>
              <p className="text-zinc-300 font-medium text-lg mb-2">{mockCompany.company_name}</p>
              <p className="text-zinc-500 text-sm mb-2">{mockCompany.industry}</p>
              <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">{mockCompany.description}</p>
            </>
          ) : (
            <p className="text-zinc-400 mb-6">No research report found for {upperTicker}.</p>
          )}
          <Button onClick={generateReport} size="lg">
            <BookOpen className="h-4 w-4" /> Generate AI Research Report
          </Button>
          <p className="text-xs text-zinc-600 mt-3">
            Takes ~20-30 seconds. Uses Claude AI to synthesize public information.
          </p>
        </Card>
      ) : generating ? (
        <div className="flex flex-col items-center justify-center py-24">
          <LoadingSpinner size="lg" />
          <p className="text-zinc-300 font-medium mt-6">Generating Research Report...</p>
          <p className="text-zinc-500 text-sm mt-2">
            AI is analyzing {companyName}. This takes 20-30 seconds.
          </p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* AI-content notice */}
          <div className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-300">
              <span className="font-medium">Unverified AI narrative:</span> this report is prototype
              output written by an AI model from its general training knowledge and the inputs shown.
              It is not connected to live market data, filings, or news, and nothing in it has been
              fact-checked. Verify every claim against a real data source before acting on it.
            </p>
          </div>

          {/* Header card */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-2xl font-bold text-zinc-100">{report.ticker}</span>
                  {report.score > 0 ? (
                    <ScoreBadge score={report.score} />
                  ) : (
                    <Badge variant="outline">Unscored</Badge>
                  )}
                  <Badge variant="outline">{report.industry}</Badge>
                </div>
                <p className="text-zinc-400">{report.company_name}</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Report generated {new Date(report.generated_at).toLocaleDateString()}
                  {report.score > 0
                    ? ' · Score computed deterministically from the supplied metrics'
                    : ' · No score — run the screener with full metrics to score this company'}
                </p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <Card>
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-zinc-100">Company Overview</h3>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.overview}</p>
                <h4 className="text-base font-semibold text-zinc-100 pt-2">Industry Position</h4>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.industry_position}</p>
              </div>
            )}
            {activeTab === 'financials' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-3">Cash Flow Analysis</h3>
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.cash_flow_analysis}</p>
                </div>
                <div className="border-t border-zinc-800 pt-6">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-3">Earnings Analysis</h3>
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.earnings_analysis}</p>
                </div>
                <div className="border-t border-zinc-800 pt-6">
                  <h3 className="text-lg font-semibold text-zinc-100 mb-3">Debt & Balance Sheet</h3>
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.debt_analysis}</p>
                </div>
              </div>
            )}
            {activeTab === 'technical' && (
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-3">Technical Analysis — 200-Week EMA</h3>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.technical_analysis}</p>
              </div>
            )}
            {activeTab === 'news' && (
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-3">News</h3>
                {report.news_summary ? (
                  <>
                    <div className="mb-3 p-2 rounded-lg bg-rose-400/5 border border-rose-400/20 text-xs text-rose-300">
                      This section was AI-generated by an earlier version of this app without any
                      news feed. Treat it as unreliable — it may describe events that never happened.
                    </div>
                    <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.news_summary}</p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">
                    No news data source is connected to this prototype, so no news is shown. A factual
                    news provider is planned for a later phase.
                  </p>
                )}
              </div>
            )}
            {activeTab === 'bull-bear' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-xl bg-emerald-400/5 border border-emerald-400/20">
                  <h3 className="text-base font-semibold text-emerald-400 mb-3">Bull Case</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{report.bull_case}</p>
                </div>
                <div className="p-4 rounded-xl bg-rose-400/5 border border-rose-400/20">
                  <h3 className="text-base font-semibold text-rose-400 mb-3">Bear Case</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{report.bear_case}</p>
                </div>
                <div className="md:col-span-2 pt-2">
                  <h3 className="text-base font-semibold text-zinc-100 mb-3">Conclusion</h3>
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.conclusion}</p>
                </div>
              </div>
            )}
            {activeTab === 'risks' && (
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-3">Key Risks</h3>
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{report.risks}</p>
              </div>
            )}
          </Card>

          {/* Disclaimer */}
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-500 leading-relaxed">
            <span className="font-medium text-zinc-400">Disclaimer: </span>
            {report.disclaimer}
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
        contextReport={report ? report.conclusion : undefined}
        initialMessage={
          report
            ? report.score > 0
              ? `A background briefing for ${report.ticker} (${report.company_name}) is above; the app computed a deterministic score of ${report.score}/100 from the metrics you supplied. Ask me anything about the framework, the briefing, or LEAPS mechanics — note that I have no live market data.`
              : `A background briefing for ${report.ticker} (${report.company_name}) is above. No score was computed because full metrics were not supplied. Ask me anything about the framework, the briefing, or LEAPS mechanics — note that I have no live market data.`
            : undefined
        }
      />
    </div>
  )
}
