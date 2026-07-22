// Server-side request validation for the API routes. Hand-rolled (no runtime
// dependency) in the same spirit as the archived Netlify function's
// validate.mjs: treat every client-supplied value as untrusted, whitelist
// enums, and enforce hard length limits.

import type {
  ChatRequest,
  Industry,
  OptionContract,
  ResearchRequest,
  ScoringWeights,
  StockMetrics,
} from '@/types'

export const MAX_BODY_BYTES = 64 * 1024

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

const TICKER_RE = /^[A-Z][A-Z.]{0,5}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const INDUSTRIES: Industry[] = [
  'Healthcare',
  'Industrials',
  'Technology',
  'Semiconductors',
  'Consumer Products',
  'Financial',
]

const MARKET_CAP_RANKS = ['1st', '2nd', '3rd', 'Other'] as const
const CASH_FLOWS = ['Strong', 'Positive', 'Negative'] as const
const EARNINGS_TRENDS = ['Growing', 'Stable', 'Declining'] as const
const DEBT_LEVELS = ['Low', 'Moderate', 'High'] as const

export const WEIGHT_KEYS: (keyof ScoringWeights)[] = [
  'industry_leadership',
  'cash_flow',
  'earnings_quality',
  'debt_to_equity',
  'ema_distance',
  'option_affordability',
  'option_expiration',
]

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

function str(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  // Strip control characters, trim, and clip.
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max)
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function validTicker(v: unknown): v is string {
  return typeof v === 'string' && TICKER_RE.test(v)
}

// Tickers are identifiers, not prose: truncating "TOOLONGTICKER" to "TOOLON"
// would silently change which symbol is meant, so anything that does not
// fully match after trimming/uppercasing is rejected rather than clipped.
function cleanTicker(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toUpperCase()
  return TICKER_RE.test(t) ? t : null
}

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

// Weights must be non-negative integers summing to exactly 100 — the score is
// presented as "N/100", so any other total silently misrepresents the scale.
export function validateWeights(raw: unknown): Validated<ScoringWeights> {
  if (!isRecord(raw)) return fail('Weights must be an object.')
  const out: Partial<ScoringWeights> = {}
  for (const key of WEIGHT_KEYS) {
    const v = raw[key]
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100) {
      return fail(`Weight "${key}" must be an integer between 0 and 100.`)
    }
    out[key] = v
  }
  const total = WEIGHT_KEYS.reduce((sum, k) => sum + (out[k] as number), 0)
  if (total !== 100) {
    return fail(`Weights must total exactly 100 (got ${total}).`)
  }
  return { ok: true, value: out as ScoringWeights }
}

// ---------------------------------------------------------------------------
// Stock metrics (screener input)
// ---------------------------------------------------------------------------

export function validateMetrics(raw: unknown): Validated<StockMetrics> {
  if (!isRecord(raw)) return fail('Metrics must be an object.')

  const ticker = cleanTicker(raw.ticker)
  if (ticker === null) return fail('Ticker must be 1-6 letters (A-Z, dots allowed).')

  const company_name = str(raw.company_name, 80)
  if (!company_name) return fail('Company name is required (max 80 characters).')

  const industry = str(raw.industry, 40) as Industry
  if (!INDUSTRIES.includes(industry)) return fail('Unknown industry.')

  const market_cap_rank = raw.market_cap_rank
  if (!MARKET_CAP_RANKS.includes(market_cap_rank as never)) return fail('Invalid market cap rank.')

  const cash_flow = raw.cash_flow
  if (!CASH_FLOWS.includes(cash_flow as never)) return fail('Invalid cash flow status.')

  const earnings_trend = raw.earnings_trend
  if (!EARNINGS_TRENDS.includes(earnings_trend as never)) return fail('Invalid earnings trend.')

  const debt_to_equity = raw.debt_to_equity
  if (!DEBT_LEVELS.includes(debt_to_equity as never)) return fail('Invalid debt-to-equity level.')

  const current_price = num(raw.current_price)
  if (current_price === null || current_price <= 0 || current_price > 1_000_000) {
    return fail('Current price must be a positive number.')
  }

  const ema_200_week = num(raw.ema_200_week)
  if (ema_200_week === null || ema_200_week <= 0 || ema_200_week > 1_000_000) {
    return fail('200-week EMA must be a positive number.')
  }

  let ema_distance_pct = num(raw.ema_distance_pct)
  if (ema_distance_pct === null || Math.abs(ema_distance_pct) > 10_000) {
    ema_distance_pct = ((current_price - ema_200_week) / ema_200_week) * 100
  }

  return {
    ok: true,
    value: {
      ticker,
      company_name,
      industry,
      market_cap_rank: market_cap_rank as StockMetrics['market_cap_rank'],
      cash_flow: cash_flow as StockMetrics['cash_flow'],
      earnings_trend: earnings_trend as StockMetrics['earnings_trend'],
      debt_to_equity: debt_to_equity as StockMetrics['debt_to_equity'],
      current_price,
      ema_200_week,
      ema_distance_pct,
    },
  }
}

export function validateScoreRequest(
  raw: unknown
): Validated<{ metrics: StockMetrics; weights?: ScoringWeights }> {
  if (!isRecord(raw)) return fail('Invalid request body.')
  const metrics = validateMetrics(raw.metrics)
  if (!metrics.ok) return metrics
  if (raw.weights !== undefined && raw.weights !== null) {
    const weights = validateWeights(raw.weights)
    if (!weights.ok) return weights
    return { ok: true, value: { metrics: metrics.value, weights: weights.value } }
  }
  return { ok: true, value: { metrics: metrics.value } }
}

// ---------------------------------------------------------------------------
// Research request
// ---------------------------------------------------------------------------

export function validateResearchRequest(raw: unknown): Validated<ResearchRequest> {
  if (!isRecord(raw)) return fail('Invalid request body.')

  const ticker = cleanTicker(raw.ticker)
  if (ticker === null) return fail('Ticker must be 1-6 letters (A-Z, dots allowed).')

  const company_name = str(raw.company_name, 80)
  if (!company_name) return fail('Company name is required (max 80 characters).')

  const industry = str(raw.industry, 40) as Industry
  if (!INDUSTRIES.includes(industry)) return fail('Unknown industry.')

  let metrics: Partial<StockMetrics> | undefined
  if (raw.metrics !== undefined && raw.metrics !== null) {
    if (!isRecord(raw.metrics)) return fail('Metrics must be an object when provided.')
    const m = raw.metrics
    metrics = {}
    if (m.market_cap_rank !== undefined) {
      if (!MARKET_CAP_RANKS.includes(m.market_cap_rank as never)) return fail('Invalid market cap rank.')
      metrics.market_cap_rank = m.market_cap_rank as StockMetrics['market_cap_rank']
    }
    if (m.cash_flow !== undefined) {
      if (!CASH_FLOWS.includes(m.cash_flow as never)) return fail('Invalid cash flow status.')
      metrics.cash_flow = m.cash_flow as StockMetrics['cash_flow']
    }
    if (m.earnings_trend !== undefined) {
      if (!EARNINGS_TRENDS.includes(m.earnings_trend as never)) return fail('Invalid earnings trend.')
      metrics.earnings_trend = m.earnings_trend as StockMetrics['earnings_trend']
    }
    if (m.debt_to_equity !== undefined) {
      if (!DEBT_LEVELS.includes(m.debt_to_equity as never)) return fail('Invalid debt-to-equity level.')
      metrics.debt_to_equity = m.debt_to_equity as StockMetrics['debt_to_equity']
    }
    if (m.current_price !== undefined) {
      const p = num(m.current_price)
      if (p === null || p <= 0 || p > 1_000_000) return fail('Invalid current price.')
      metrics.current_price = p
    }
    if (m.ema_200_week !== undefined) {
      const e = num(m.ema_200_week)
      if (e === null || e <= 0 || e > 1_000_000) return fail('Invalid 200-week EMA.')
      metrics.ema_200_week = e
    }
    if (m.industry !== undefined) {
      if (!INDUSTRIES.includes(m.industry as never)) return fail('Unknown industry in metrics.')
      metrics.industry = m.industry as Industry
    }
  }

  return { ok: true, value: { ticker, company_name, industry, metrics } }
}

// A research report can only carry a deterministic score when every scored
// input was supplied; otherwise it is stored as 0 and displayed as "Unscored".
export function hasCompleteMetrics(
  metrics: Partial<StockMetrics> | undefined
): metrics is StockMetrics {
  if (!metrics) return false
  return (
    metrics.market_cap_rank !== undefined &&
    metrics.cash_flow !== undefined &&
    metrics.earnings_trend !== undefined &&
    metrics.debt_to_equity !== undefined &&
    typeof metrics.current_price === 'number' &&
    typeof metrics.ema_200_week === 'number'
  )
}

// ---------------------------------------------------------------------------
// Chat request
// ---------------------------------------------------------------------------

export const CHAT_LIMITS = {
  message: 2_000,
  contextReport: 3_000,
  historyEntries: 10,
  historyContent: 4_000,
} as const

export function validateChatRequest(raw: unknown): Validated<ChatRequest> {
  if (!isRecord(raw)) return fail('Invalid request body.')

  const message = str(raw.message, CHAT_LIMITS.message)
  if (!message) return fail('Message is required (max 2,000 characters).')

  // Session IDs are client-generated; anything that isn't a UUID is replaced
  // server-side rather than trusted.
  const session_id =
    typeof raw.session_id === 'string' && UUID_RE.test(raw.session_id)
      ? raw.session_id
      : crypto.randomUUID()

  let context_ticker: string | undefined
  if (raw.context_ticker !== undefined && raw.context_ticker !== null && raw.context_ticker !== '') {
    const t = cleanTicker(raw.context_ticker)
    if (t === null) return fail('Invalid context ticker.')
    context_ticker = t
  }

  const context_report =
    raw.context_report !== undefined && raw.context_report !== null
      ? str(raw.context_report, CHAT_LIMITS.contextReport)
      : undefined

  const history: { role: 'user' | 'assistant'; content: string }[] = []
  if (raw.history !== undefined && raw.history !== null) {
    if (!Array.isArray(raw.history)) return fail('History must be an array.')
    for (const entry of raw.history.slice(-CHAT_LIMITS.historyEntries)) {
      if (!isRecord(entry)) return fail('Invalid history entry.')
      if (entry.role !== 'user' && entry.role !== 'assistant') {
        return fail('History roles must be "user" or "assistant".')
      }
      const content = str(entry.content, CHAT_LIMITS.historyContent)
      if (!content) return fail('History entries must have text content.')
      history.push({ role: entry.role, content })
    }
  }

  return { ok: true, value: { message, session_id, context_ticker, context_report, history } }
}

// ---------------------------------------------------------------------------
// LEAPS request
// ---------------------------------------------------------------------------

export const MAX_CONTRACTS = 10

function validateContract(raw: unknown, index: number): Validated<OptionContract> {
  if (!isRecord(raw)) return fail(`Contract ${index + 1} is not an object.`)

  const ticker = cleanTicker(raw.ticker)
  if (ticker === null) return fail(`Contract ${index + 1}: invalid ticker.`)

  if (raw.option_type !== 'CALL' && raw.option_type !== 'PUT') {
    return fail(`Contract ${index + 1}: option_type must be CALL or PUT.`)
  }

  const expiration_date = str(raw.expiration_date, 10)
  if (!DATE_RE.test(expiration_date) || Number.isNaN(Date.parse(expiration_date))) {
    return fail(`Contract ${index + 1}: expiration_date must be YYYY-MM-DD.`)
  }

  const strike_price = num(raw.strike_price)
  const current_premium = num(raw.current_premium)
  const all_time_high_premium = num(raw.all_time_high_premium)
  const depreciation_pct = num(raw.depreciation_pct)
  const implied_volatility = num(raw.implied_volatility)
  const delta = num(raw.delta)
  const theta = num(raw.theta)
  const volume = num(raw.volume)
  const open_interest = num(raw.open_interest)

  if (strike_price === null || strike_price <= 0 || strike_price > 100_000)
    return fail(`Contract ${index + 1}: invalid strike price.`)
  if (current_premium === null || current_premium <= 0 || current_premium > 100_000)
    return fail(`Contract ${index + 1}: invalid premium.`)
  if (all_time_high_premium === null || all_time_high_premium <= 0 || all_time_high_premium > 100_000)
    return fail(`Contract ${index + 1}: invalid all-time-high premium.`)
  if (depreciation_pct === null || depreciation_pct < -100 || depreciation_pct > 100)
    return fail(`Contract ${index + 1}: invalid depreciation percentage.`)
  if (implied_volatility === null || implied_volatility < 0 || implied_volatility > 10)
    return fail(`Contract ${index + 1}: invalid implied volatility.`)
  if (delta === null || delta < -1 || delta > 1)
    return fail(`Contract ${index + 1}: invalid delta.`)
  if (theta === null || Math.abs(theta) > 100)
    return fail(`Contract ${index + 1}: invalid theta.`)
  if (volume === null || !Number.isInteger(volume) || volume < 0)
    return fail(`Contract ${index + 1}: invalid volume.`)
  if (open_interest === null || !Number.isInteger(open_interest) || open_interest < 0)
    return fail(`Contract ${index + 1}: invalid open interest.`)

  // Phase 1 rule: the app has no options data provider, so every contract the
  // client submits must be explicitly labeled mock. This prevents fabricated
  // "live" contracts from entering the pipeline before a real provider exists.
  if (raw.is_mock !== true) {
    return fail(`Contract ${index + 1}: only is_mock contracts are accepted in this phase.`)
  }

  return {
    ok: true,
    value: {
      id: str(raw.id, 64) || `contract-${index + 1}`,
      ticker,
      option_type: raw.option_type,
      expiration_date,
      strike_price,
      current_premium,
      all_time_high_premium,
      depreciation_pct,
      implied_volatility,
      delta,
      theta,
      volume,
      open_interest,
      is_mock: true,
    },
  }
}

export function validateLeapsRequest(
  raw: unknown
): Validated<{ ticker: string; company_name: string; contracts: OptionContract[] }> {
  if (!isRecord(raw)) return fail('Invalid request body.')

  const ticker = cleanTicker(raw.ticker)
  if (ticker === null) return fail('Ticker must be 1-6 letters (A-Z, dots allowed).')

  const company_name = str(raw.company_name, 80) || ticker

  if (!Array.isArray(raw.contracts) || raw.contracts.length === 0) {
    return fail('At least one option contract is required.')
  }
  if (raw.contracts.length > MAX_CONTRACTS) {
    return fail(`At most ${MAX_CONTRACTS} contracts are accepted.`)
  }

  const contracts: OptionContract[] = []
  for (let i = 0; i < raw.contracts.length; i++) {
    const c = validateContract(raw.contracts[i], i)
    if (!c.ok) return c
    if (c.value.ticker !== ticker) {
      return fail(`Contract ${i + 1}: ticker does not match the request ticker.`)
    }
    contracts.push(c.value)
  }

  return { ok: true, value: { ticker, company_name, contracts } }
}

// ---------------------------------------------------------------------------
// Prerequisite analysis score
// ---------------------------------------------------------------------------

// The LEAPS route requires a real stored screener analysis — it must never
// fabricate a stock-quality score. Returns the score total, or null when the
// stored row is absent or malformed (both mean "prerequisite unavailable").
export function resolveStockScore(analysis: unknown): number | null {
  if (!isRecord(analysis)) return null
  const score = analysis.score
  if (!isRecord(score)) return null
  const total = score.total
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0 || total > 100) {
    return null
  }
  return Math.round(total)
}
