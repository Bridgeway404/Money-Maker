export type Industry =
  | 'Healthcare'
  | 'Industrials'
  | 'Technology'
  | 'Semiconductors'
  | 'Consumer Products'
  | 'Financial'

export type RiskAppetite = 'Conservative' | 'Moderate' | 'Aggressive'

export type PurchasingPower =
  | '<$1k'
  | '$1k-$5k'
  | '$5k-$25k'
  | '$25k-$100k'
  | '$100k+'

export type Priority = 'Affordability' | 'Upside Potential' | 'Company Quality'

export type MarketCapRank = '1st' | '2nd' | '3rd' | 'Other'

export type CashFlowStatus = 'Strong' | 'Positive' | 'Negative'

export type EarningsTrend = 'Growing' | 'Stable' | 'Declining'

export type DebtToEquityLevel = 'Low' | 'Moderate' | 'High'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  created_at: string
  updated_at: string
}

export interface OnboardingAnswers {
  id: string
  user_id: string
  purchasing_power: PurchasingPower
  industries: Industry[]
  watching_stocks: string[]
  risk_appetite: RiskAppetite
  priority: Priority
  completed_at: string
}

export interface WatchlistItem {
  id: string
  user_id: string
  ticker: string
  company_name: string
  industry: Industry
  notes: string | null
  confidence_level: number // 1-5
  added_at: string
}

export interface PortfolioHolding {
  id: string
  user_id: string
  ticker: string
  company_name: string
  shares: number
  avg_cost: number
  current_value: number | null
  notes: string | null
  added_at: string
}

export interface StockMetrics {
  ticker: string
  company_name: string
  industry: Industry
  market_cap_rank: MarketCapRank
  cash_flow: CashFlowStatus
  earnings_trend: EarningsTrend
  debt_to_equity: DebtToEquityLevel
  current_price: number
  ema_200_week: number
  ema_distance_pct: number // calculated: ((price - ema) / ema) * 100
}

export interface StockScore {
  total: number // 0-100
  breakdown: {
    industry_leadership: number // max 25
    cash_flow: number // max 20
    earnings_quality: number // max 20
    debt_to_equity: number // max 10
    ema_distance: number // max 15
    option_affordability: number // max 5
    option_expiration: number // max 5
  }
  disqualified: boolean
  disqualifier_reason: string | null
  ai_reasoning: string
}

export interface StockAnalysis {
  id: string
  user_id: string
  ticker: string
  company_name: string
  industry: Industry
  metrics: StockMetrics
  score: StockScore
  analyzed_at: string
}

export interface ResearchReport {
  id: string
  user_id: string
  ticker: string
  company_name: string
  industry: Industry
  score: number
  overview: string
  industry_position: string
  cash_flow_analysis: string
  earnings_analysis: string
  debt_analysis: string
  technical_analysis: string
  news_summary: string
  bull_case: string
  bear_case: string
  risks: string
  conclusion: string
  disclaimer: string
  generated_at: string
}

export interface OptionContract {
  id: string
  ticker: string
  option_type: 'CALL' | 'PUT'
  expiration_date: string
  strike_price: number
  current_premium: number
  all_time_high_premium: number
  depreciation_pct: number // how much it's dropped from ATH
  implied_volatility: number
  delta: number
  theta: number
  volume: number
  open_interest: number
  is_mock: boolean
}

export interface RecommendedContract {
  rank: 1 | 2 | 3
  is_front_runner: boolean
  contract: OptionContract
  ai_reasoning: string
  risk_level: 'Low' | 'Medium' | 'High'
  affordability: 'Affordable' | 'Moderate' | 'Expensive'
  score: number
}

export interface LeapsRecommendation {
  id: string
  user_id: string
  ticker: string
  company_name: string
  stock_score: number
  recommendations: RecommendedContract[]
  front_runner_explanation: string
  disclaimer: string
  generated_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  context_ticker: string | null
  created_at: string
}

export interface ScoringWeights {
  industry_leadership: number // default 25
  cash_flow: number // default 20
  earnings_quality: number // default 20
  debt_to_equity: number // default 10
  ema_distance: number // default 15
  option_affordability: number // default 5
  option_expiration: number // default 5
}

export interface ScoringConfig {
  id: string
  user_id: string
  weights: ScoringWeights
  updated_at: string
}

// API request/response types
export interface ResearchRequest {
  ticker: string
  company_name: string
  industry: Industry
  metrics?: Partial<StockMetrics>
}

export interface ScoreRequest {
  metrics: StockMetrics
  weights?: ScoringWeights
}

export interface LeapsRequest {
  ticker: string
  company_name: string
  stock_score: number
  contracts: OptionContract[]
}

export interface ChatRequest {
  message: string
  session_id: string
  context_ticker?: string
  context_report?: string
  history: { role: 'user' | 'assistant'; content: string }[]
}

// Mock data company type
export interface MockCompany {
  ticker: string
  company_name: string
  industry: Industry
  market_cap_rank: MarketCapRank
  cash_flow: CashFlowStatus
  earnings_trend: EarningsTrend
  debt_to_equity: DebtToEquityLevel
  current_price: number
  ema_200_week: number
  description: string
}
