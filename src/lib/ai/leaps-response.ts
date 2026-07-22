// Strict validation for the AI's LEAPS-ranking JSON. The model's output is
// untrusted: every contract reference is bounds-checked, duplicates are
// rejected, enums are whitelisted, and free text is clipped. Invalid output
// is reported as a structured failure — never allowed to crash the route or
// flow unvalidated into the database.

export interface AiLeapsRecommendation {
  rank: number
  is_front_runner: boolean
  contract_index: number
  ai_reasoning: string
  risk_level: 'Low' | 'Medium' | 'High'
  affordability: 'Affordable' | 'Moderate' | 'Expensive'
  score: number
}

export interface AiLeapsResponse {
  recommendations: AiLeapsRecommendation[]
  front_runner_explanation: string
}

export type LeapsParseResult =
  | { ok: true; value: AiLeapsResponse }
  | { ok: false; errors: string[] }

const RISK_LEVELS = ['Low', 'Medium', 'High'] as const
const AFFORDABILITY = ['Affordable', 'Moderate', 'Expensive'] as const

const MAX_REASONING_CHARS = 1_500
const MAX_EXPLANATION_CHARS = 4_000

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clip(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

// Strips markdown fences and extracts the outermost JSON object before
// parsing. Returns null instead of throwing on malformed text.
export function safeParseJson(text: string): unknown {
  if (typeof text !== 'string' || !text.trim()) return null
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first >= 0 && last > first) t = t.slice(first, last + 1)
  try {
    return JSON.parse(t)
  } catch {
    return null
  }
}

export function validateLeapsAiResponse(
  parsed: unknown,
  contractCount: number
): LeapsParseResult {
  const errors: string[] = []

  if (!isRecord(parsed)) {
    return { ok: false, errors: ['AI response is not a JSON object.'] }
  }
  if (!Array.isArray(parsed.recommendations)) {
    return { ok: false, errors: ['AI response is missing the recommendations array.'] }
  }
  if (parsed.recommendations.length !== contractCount) {
    errors.push(
      `Expected ${contractCount} recommendations, got ${parsed.recommendations.length}.`
    )
  }

  const seenIndexes = new Set<number>()
  const seenRanks = new Set<number>()
  const recommendations: AiLeapsRecommendation[] = []

  parsed.recommendations.forEach((raw, i) => {
    if (!isRecord(raw)) {
      errors.push(`Recommendation ${i + 1} is not an object.`)
      return
    }

    const contractIndex = raw.contract_index
    if (
      typeof contractIndex !== 'number' ||
      !Number.isInteger(contractIndex) ||
      contractIndex < 1 ||
      contractIndex > contractCount
    ) {
      errors.push(
        `Recommendation ${i + 1}: contract_index ${String(contractIndex)} is out of range (1-${contractCount}).`
      )
      return
    }
    if (seenIndexes.has(contractIndex)) {
      errors.push(`Recommendation ${i + 1}: duplicate contract_index ${contractIndex}.`)
      return
    }
    seenIndexes.add(contractIndex)

    const rank = raw.rank
    if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 1 || rank > contractCount) {
      errors.push(`Recommendation ${i + 1}: rank ${String(rank)} is out of range (1-${contractCount}).`)
      return
    }
    if (seenRanks.has(rank)) {
      errors.push(`Recommendation ${i + 1}: duplicate rank ${rank}.`)
      return
    }
    seenRanks.add(rank)

    if (!RISK_LEVELS.includes(raw.risk_level as never)) {
      errors.push(`Recommendation ${i + 1}: invalid risk_level "${String(raw.risk_level)}".`)
      return
    }
    if (!AFFORDABILITY.includes(raw.affordability as never)) {
      errors.push(`Recommendation ${i + 1}: invalid affordability "${String(raw.affordability)}".`)
      return
    }

    const score = raw.score
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
      errors.push(`Recommendation ${i + 1}: score must be a number between 0 and 100.`)
      return
    }

    const reasoning = clip(raw.ai_reasoning, MAX_REASONING_CHARS)
    if (!reasoning) {
      errors.push(`Recommendation ${i + 1}: missing ai_reasoning.`)
      return
    }

    recommendations.push({
      rank,
      is_front_runner: raw.is_front_runner === true,
      contract_index: contractIndex,
      ai_reasoning: reasoning,
      risk_level: raw.risk_level as AiLeapsRecommendation['risk_level'],
      affordability: raw.affordability as AiLeapsRecommendation['affordability'],
      score: Math.round(score),
    })
  })

  if (errors.length > 0) return { ok: false, errors }

  // Normalize the front-runner flag: exactly one, on the rank-1 entry when the
  // model marked none or several.
  recommendations.sort((a, b) => a.rank - b.rank)
  const flagged = recommendations.filter((r) => r.is_front_runner)
  if (flagged.length !== 1) {
    recommendations.forEach((r) => {
      r.is_front_runner = r.rank === recommendations[0].rank
    })
  }

  return {
    ok: true,
    value: {
      recommendations,
      front_runner_explanation: clip(parsed.front_runner_explanation, MAX_EXPLANATION_CHARS),
    },
  }
}
