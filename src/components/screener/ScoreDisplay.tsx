'use client'

import type { StockScore } from '@/types'
import Card from '@/components/ui/Card'
import ScoreGauge from '@/components/ui/ScoreGauge'
import Badge from '@/components/ui/Badge'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface ScoreDisplayProps {
  score: StockScore
  ticker: string
}

const breakdownLabels: Record<string, string> = {
  industry_leadership: 'Industry Leadership',
  cash_flow: 'Cash Flow',
  earnings_quality: 'Earnings Quality',
  debt_to_equity: 'Debt-to-Equity',
  ema_distance: '200-Week EMA Distance',
  option_affordability: 'Option Affordability',
  option_expiration: 'Option Expiration',
}

const breakdownMax: Record<string, number> = {
  industry_leadership: 25,
  cash_flow: 20,
  earnings_quality: 20,
  debt_to_equity: 10,
  ema_distance: 15,
  option_affordability: 5,
  option_expiration: 5,
}

export default function ScoreDisplay({ score, ticker }: ScoreDisplayProps) {
  return (
    <Card>
      <div className="flex items-start gap-6">
        <div className="shrink-0">
          <ScoreGauge score={score.total} size="lg" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-semibold text-zinc-100">{ticker} Score</h3>
            {score.disqualified ? (
              <Badge variant="danger">Disqualified</Badge>
            ) : score.total >= 90 ? (
              <Badge variant="success">Strong Buy</Badge>
            ) : score.total >= 75 ? (
              <Badge variant="success">Buy</Badge>
            ) : score.total >= 60 ? (
              <Badge variant="warning">Watch</Badge>
            ) : (
              <Badge variant="danger">Avoid</Badge>
            )}
          </div>

          {score.disqualified && score.disqualifier_reason && (
            <div className="flex items-start gap-2 mb-3 p-3 bg-rose-400/5 border border-rose-400/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-300">{score.disqualifier_reason}</p>
            </div>
          )}

          <p className="text-sm text-zinc-400 mb-4">{score.ai_reasoning}</p>

          {/* Breakdown bars */}
          <div className="space-y-2">
            {Object.entries(score.breakdown).map(([key, value]) => {
              const max = breakdownMax[key] ?? 25
              const pct = (value / max) * 100
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-40 text-xs text-zinc-400 shrink-0">
                    {breakdownLabels[key]}
                  </div>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        pct >= 80
                          ? 'bg-emerald-500'
                          : pct >= 50
                          ? 'bg-yellow-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-zinc-300 w-12 text-right tabular-nums">
                    {value}/{max}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
