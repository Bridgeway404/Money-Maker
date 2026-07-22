// Strict validation for the AI's research-narrative JSON. The model's output is
// untrusted. This validator replaces the previous "coerce every section to a
// string, defaulting to empty" behavior, which silently produced apparently-
// successful but substantially blank reports and had no defense against the
// model smuggling in a score or fabricated market data.
//
// Policy:
// - Only the recognized narrative fields below are accepted.
// - The essential sections must be non-empty strings; anything else
//   (array, number, object, null, boolean) is rejected.
// - A fixed set of forbidden fields — score/stock_score/news/news_summary/
//   current_price and other numerical market claims — is HARD-REJECTED if the
//   model includes it. The numeric score and news are server-controlled: the
//   score is computed deterministically (or the report is Unscored) and
//   news_summary stays empty until a real news provider exists.
// - Other unrecognized fields are deliberately IGNORED (dropped), so a stray
//   extra key from the model does not fail an otherwise-valid report, while the
//   forbidden fabrication surface above is never tolerated.
// - Invalid output yields a structured failure; the route logs the detail
//   server-side and returns a generic 502 without persisting anything.

export interface ResearchNarrative {
  overview: string
  industry_position: string
  cash_flow_analysis: string
  earnings_analysis: string
  debt_analysis: string
  technical_analysis: string
  bull_case: string
  bear_case: string
  risks: string
  conclusion: string
  disclaimer: string
}

export type ResearchParseResult =
  | { ok: true; value: ResearchNarrative }
  | { ok: false; errors: string[] }

// Essential sections must all be present and non-empty. `disclaimer` is
// optional here — the route substitutes the canonical disclaimer when the
// model omits it — so it is validated for type/length but not required.
const ESSENTIAL_FIELDS = [
  'overview',
  'industry_position',
  'cash_flow_analysis',
  'earnings_analysis',
  'debt_analysis',
  'technical_analysis',
  'bull_case',
  'bear_case',
  'risks',
  'conclusion',
] as const

const OPTIONAL_FIELDS = ['disclaimer'] as const

const ACCEPTED_FIELDS: readonly string[] = [...ESSENTIAL_FIELDS, ...OPTIONAL_FIELDS]

// Fields the model must never supply. These are either server-controlled
// (score, news_summary) or unsupported numerical market claims that this
// prototype has no data source for and must not fabricate.
const FORBIDDEN_FIELDS: readonly string[] = [
  'score',
  'stock_score',
  'total',
  'news',
  'news_summary',
  'current_price',
  'price',
  'market_cap',
  'revenue',
  'earnings',
  'eps',
  'target_price',
  'price_target',
  'analyst_rating',
  'valuation',
  'pe_ratio',
]

const MAX_SECTION_CHARS = 8_000
const MAX_DISCLAIMER_CHARS = 2_000

const MIN_ESSENTIAL_CHARS = 1

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function validateResearchAiResponse(parsed: unknown): ResearchParseResult {
  const errors: string[] = []

  if (!isRecord(parsed)) {
    return { ok: false, errors: ['AI response is not a JSON object.'] }
  }

  // Hard-reject any forbidden field the model tried to supply.
  for (const key of FORBIDDEN_FIELDS) {
    if (key in parsed) {
      errors.push(`Forbidden model-supplied field present: "${key}".`)
    }
  }

  const out: Partial<ResearchNarrative> = {}

  for (const field of ESSENTIAL_FIELDS) {
    const raw = parsed[field]
    if (typeof raw !== 'string') {
      errors.push(
        `Section "${field}" must be a non-empty string (got ${raw === null ? 'null' : Array.isArray(raw) ? 'array' : typeof raw}).`
      )
      continue
    }
    const trimmed = raw.trim().slice(0, MAX_SECTION_CHARS)
    if (trimmed.length < MIN_ESSENTIAL_CHARS) {
      errors.push(`Section "${field}" is empty.`)
      continue
    }
    out[field] = trimmed
  }

  // Disclaimer: validated if present, but never required (route defaults it).
  if ('disclaimer' in parsed && parsed.disclaimer !== undefined && parsed.disclaimer !== null) {
    if (typeof parsed.disclaimer !== 'string') {
      errors.push('Section "disclaimer" must be a string when provided.')
    } else {
      out.disclaimer = parsed.disclaimer.trim().slice(0, MAX_DISCLAIMER_CHARS)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      overview: out.overview!,
      industry_position: out.industry_position!,
      cash_flow_analysis: out.cash_flow_analysis!,
      earnings_analysis: out.earnings_analysis!,
      debt_analysis: out.debt_analysis!,
      technical_analysis: out.technical_analysis!,
      bull_case: out.bull_case!,
      bear_case: out.bear_case!,
      risks: out.risks!,
      conclusion: out.conclusion!,
      // Empty when the model omitted it; the route substitutes the canonical
      // disclaimer. Unrecognized non-forbidden fields are intentionally dropped.
      disclaimer: out.disclaimer ?? '',
    },
  }
}

export { ACCEPTED_FIELDS, FORBIDDEN_FIELDS, ESSENTIAL_FIELDS }
