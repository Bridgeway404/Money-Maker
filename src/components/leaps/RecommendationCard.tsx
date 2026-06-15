import type { RecommendedContract } from '@/types'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { formatCurrency, formatDate, monthsUntil } from '@/lib/utils/formatting'
import { Crown, TrendingUp, Calendar, DollarSign, Activity } from 'lucide-react'

interface RecommendationCardProps {
  recommendation: RecommendedContract
}

export default function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { rank, is_front_runner, contract, ai_reasoning, risk_level, affordability, score } = recommendation
  const monthsOut = monthsUntil(contract.expiration_date)
  const totalCost = contract.current_premium * 100

  const rankColors = {
    1: is_front_runner ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-700',
    2: 'border-zinc-700',
    3: 'border-zinc-800',
  }

  const riskBadge = {
    Low: 'success' as const,
    Medium: 'warning' as const,
    High: 'danger' as const,
  }

  const affordBadge = {
    Affordable: 'success' as const,
    Moderate: 'warning' as const,
    Expensive: 'danger' as const,
  }

  return (
    <Card
      className={`relative ${rankColors[rank as 1 | 2 | 3]} transition-colors`}
    >
      {/* Rank badge */}
      <div className="flex items-center gap-2 mb-4">
        {is_front_runner ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <Crown className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Front-Runner</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700">
            <span className="text-xs font-semibold text-zinc-400">#{rank} Choice</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Badge variant={riskBadge[risk_level]}>{risk_level} Risk</Badge>
          <Badge variant={affordBadge[affordability]}>{affordability}</Badge>
        </div>
      </div>

      {/* Contract details */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Expiration</span>
          </div>
          <p className="text-sm font-semibold text-zinc-100">{formatDate(contract.expiration_date)}</p>
          <p className="text-xs text-emerald-400 mt-0.5">{monthsOut} months out</p>
        </div>
        <div className="p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Strike Price</span>
          </div>
          <p className="text-sm font-semibold text-zinc-100">{formatCurrency(contract.strike_price)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Delta: {contract.delta.toFixed(2)}</p>
        </div>
        <div className="p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Premium</span>
          </div>
          <p className="text-sm font-semibold text-zinc-100">{formatCurrency(contract.current_premium)}/share</p>
          <p className="text-xs text-zinc-400 mt-0.5">{formatCurrency(totalCost)} per contract</p>
        </div>
        <div className="p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">From ATH</span>
          </div>
          <p className="text-sm font-semibold text-rose-400">-{contract.depreciation_pct.toFixed(1)}%</p>
          <p className="text-xs text-zinc-400 mt-0.5">ATH: {formatCurrency(contract.all_time_high_premium)}</p>
        </div>
      </div>

      {/* Greeks row */}
      <div className="flex gap-4 text-xs text-zinc-400 mb-4 pb-4 border-b border-zinc-800">
        <span>IV: {(contract.implied_volatility * 100).toFixed(1)}%</span>
        <span>Theta: {contract.theta.toFixed(3)}</span>
        <span>Vol: {contract.volume.toLocaleString()}</span>
        <span>OI: {contract.open_interest.toLocaleString()}</span>
      </div>

      {/* AI reasoning */}
      <p className="text-sm text-zinc-300 leading-relaxed">{ai_reasoning}</p>

      {/* Score */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-zinc-500">Contract Score</span>
        <span className="text-sm font-bold text-emerald-400">{score}/100</span>
      </div>
    </Card>
  )
}
