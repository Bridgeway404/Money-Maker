import type {
  StockMetrics,
  StockScore,
  ScoringWeights,
  MarketCapRank,
  CashFlowStatus,
  EarningsTrend,
  DebtToEquityLevel,
} from '@/types'

export const DEFAULT_WEIGHTS: ScoringWeights = {
  industry_leadership: 25,
  cash_flow: 20,
  earnings_quality: 20,
  debt_to_equity: 10,
  ema_distance: 15,
  option_affordability: 5,
  option_expiration: 5,
}

function scoreIndustryLeadership(rank: MarketCapRank, maxPoints: number): number {
  switch (rank) {
    case '1st':
      return maxPoints
    case '2nd':
      return Math.round(maxPoints * 0.85)
    case '3rd':
      return Math.round(maxPoints * 0.65)
    case 'Other':
      return 0 // disqualifier
    default:
      return 0
  }
}

function scoreCashFlow(cashFlow: CashFlowStatus, maxPoints: number): number {
  switch (cashFlow) {
    case 'Strong':
      return maxPoints
    case 'Positive':
      return Math.round(maxPoints * 0.6)
    case 'Negative':
      return 0 // disqualifier
    default:
      return 0
  }
}

function scoreEarnings(trend: EarningsTrend, maxPoints: number): number {
  switch (trend) {
    case 'Growing':
      return maxPoints
    case 'Stable':
      return Math.round(maxPoints * 0.55)
    case 'Declining':
      return 0 // disqualifier
    default:
      return 0
  }
}

function scoreDebtToEquity(level: DebtToEquityLevel, maxPoints: number): number {
  switch (level) {
    case 'Low':
      return maxPoints
    case 'Moderate':
      return Math.round(maxPoints * 0.6)
    case 'High':
      return Math.round(maxPoints * 0.2)
    default:
      return 0
  }
}

function scoreEmaDistance(distancePct: number, maxPoints: number): number {
  // distancePct = ((price - ema) / ema) * 100
  // Ideal: -10% to +10% (within 10% of EMA)
  // Best: slightly below EMA (-10% to 0%) — stock is near support
  const abs = Math.abs(distancePct)

  if (abs <= 5) {
    // Very close to EMA — ideal
    return maxPoints
  } else if (abs <= 10) {
    // Within 5-10% — strong
    return Math.round(maxPoints * 0.85)
  } else if (abs <= 20) {
    // 10-20% away — moderate
    return Math.round(maxPoints * 0.5)
  } else if (abs <= 30) {
    // 20-30% away — weak
    return Math.round(maxPoints * 0.2)
  } else {
    // More than 30% from EMA — poor timing
    return Math.round(maxPoints * 0.05)
  }
}

function scoreOptionAffordability(currentPrice: number, maxPoints: number): number {
  // Rough estimate: options cost ~5-10% of stock price
  // Affordable if a contract costs under $2,500 (option premium < $25/share)
  const estimatedPremium = currentPrice * 0.08 * 100 // rough est: 8% of price * 100 shares
  if (estimatedPremium <= 1000) {
    return maxPoints
  } else if (estimatedPremium <= 2500) {
    return Math.round(maxPoints * 0.8)
  } else if (estimatedPremium <= 5000) {
    return Math.round(maxPoints * 0.5)
  } else {
    return Math.round(maxPoints * 0.2)
  }
}

function getDisqualifierReason(
  metrics: StockMetrics
): string | null {
  if (metrics.cash_flow === 'Negative') {
    return 'Negative cash flow disqualifies this stock from LEAPS consideration. Positive cash flow is required.'
  }
  if (metrics.earnings_trend === 'Declining') {
    return 'Declining earnings disqualifies this stock. Consistent or growing earnings are required.'
  }
  if (metrics.market_cap_rank === 'Other') {
    return 'Company is not an industry leader (top 2-3 by market cap). Industry leadership is required.'
  }
  return null
}

export function calculateScore(
  metrics: StockMetrics,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): StockScore {
  const disqualifierReason = getDisqualifierReason(metrics)

  if (disqualifierReason) {
    return {
      total: 0,
      breakdown: {
        industry_leadership: 0,
        cash_flow: 0,
        earnings_quality: 0,
        debt_to_equity: 0,
        ema_distance: 0,
        option_affordability: 0,
        option_expiration: 0,
      },
      disqualified: true,
      disqualifier_reason: disqualifierReason,
      ai_reasoning: disqualifierReason,
    }
  }

  const breakdown = {
    industry_leadership: scoreIndustryLeadership(metrics.market_cap_rank, weights.industry_leadership),
    cash_flow: scoreCashFlow(metrics.cash_flow, weights.cash_flow),
    earnings_quality: scoreEarnings(metrics.earnings_trend, weights.earnings_quality),
    debt_to_equity: scoreDebtToEquity(metrics.debt_to_equity, weights.debt_to_equity),
    ema_distance: scoreEmaDistance(metrics.ema_distance_pct, weights.ema_distance),
    option_affordability: scoreOptionAffordability(metrics.current_price, weights.option_affordability),
    option_expiration: weights.option_expiration, // full points — user picks expiration
  }

  const total = Math.min(
    100,
    Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  )

  let aiReasoning: string
  if (total >= 90) {
    aiReasoning = `${metrics.ticker} scores ${total}/100 — an exceptional LEAPS opportunity. The company checks all critical boxes: industry leadership, strong cash flows, growing earnings, and trades near its 200-week EMA, creating an ideal technical entry point.`
  } else if (total >= 75) {
    aiReasoning = `${metrics.ticker} scores ${total}/100 — a solid LEAPS candidate with some considerations. The company demonstrates most key qualifications but has areas where careful evaluation is warranted before committing capital.`
  } else if (total >= 60) {
    aiReasoning = `${metrics.ticker} scores ${total}/100 — marginal LEAPS suitability. While not disqualified, there are meaningful gaps versus the ideal setup. Consider waiting for better conditions or a stronger entry.`
  } else {
    aiReasoning = `${metrics.ticker} scores ${total}/100 — below the threshold for LEAPS consideration. The risk/reward profile does not favor a long-dated options position at this time.`
  }

  return {
    total,
    breakdown,
    disqualified: false,
    disqualifier_reason: null,
    ai_reasoning: aiReasoning,
  }
}

export function calculateEmaDistance(price: number, ema: number): number {
  if (ema === 0) return 0
  return ((price - ema) / ema) * 100
}

export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400'
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-rose-400'
}

export function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-emerald-400/10 border-emerald-400/30'
  if (score >= 80) return 'bg-green-400/10 border-green-400/30'
  if (score >= 60) return 'bg-yellow-400/10 border-yellow-400/30'
  if (score >= 40) return 'bg-orange-400/10 border-orange-400/30'
  return 'bg-rose-400/10 border-rose-400/30'
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Strong Buy'
  if (score >= 80) return 'Buy'
  if (score >= 60) return 'Watch'
  if (score >= 40) return 'Weak'
  return 'Avoid'
}
