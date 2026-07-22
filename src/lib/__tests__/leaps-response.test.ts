import { describe, expect, it } from 'vitest'
import { safeParseJson, validateLeapsAiResponse } from '@/lib/ai/leaps-response'

function rec(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    is_front_runner: true,
    contract_index: 1,
    ai_reasoning: 'Solid delta and long expiration.',
    risk_level: 'Medium',
    affordability: 'Affordable',
    score: 85,
    ...overrides,
  }
}

function validThree() {
  return {
    recommendations: [
      rec(),
      rec({ rank: 2, is_front_runner: false, contract_index: 2, score: 74 }),
      rec({ rank: 3, is_front_runner: false, contract_index: 3, score: 61 }),
    ],
    front_runner_explanation: 'The first contract wins on delta and time.',
  }
}

describe('safeParseJson', () => {
  it('parses plain JSON', () => {
    expect(safeParseJson('{"a": 1}')).toEqual({ a: 1 })
  })

  it('strips markdown fences and surrounding prose', () => {
    expect(safeParseJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 })
    expect(safeParseJson('Here you go: {"a": 1} hope that helps!')).toEqual({ a: 1 })
  })

  it('returns null for malformed input instead of throwing', () => {
    expect(safeParseJson('not json at all')).toBeNull()
    expect(safeParseJson('{"a": ')).toBeNull()
    expect(safeParseJson('')).toBeNull()
  })
})

describe('validateLeapsAiResponse', () => {
  it('accepts a well-formed response', () => {
    const result = validateLeapsAiResponse(validThree(), 3)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.recommendations).toHaveLength(3)
      expect(result.value.recommendations[0].rank).toBe(1)
    }
  })

  it('rejects non-object and missing-array responses (malformed AI output)', () => {
    expect(validateLeapsAiResponse(null, 3).ok).toBe(false)
    expect(validateLeapsAiResponse('text', 3).ok).toBe(false)
    expect(validateLeapsAiResponse({}, 3).ok).toBe(false)
    expect(validateLeapsAiResponse({ recommendations: 'all of them' }, 3).ok).toBe(false)
  })

  it('rejects a wrong number of recommendations', () => {
    const two = validThree()
    two.recommendations.pop()
    const result = validateLeapsAiResponse(two, 3)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/Expected 3/)
  })

  describe('contract_index safety', () => {
    it('rejects out-of-range indexes (would have crashed the old route)', () => {
      const bad = validThree()
      bad.recommendations[2] = rec({ rank: 3, is_front_runner: false, contract_index: 7 })
      const result = validateLeapsAiResponse(bad, 3)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.join(' ')).toMatch(/out of range/)
    })

    it('rejects zero, negative, and fractional indexes', () => {
      for (const idx of [0, -1, 1.5, '2', null, undefined]) {
        const bad = validThree()
        bad.recommendations[0] = rec({ contract_index: idx })
        expect(validateLeapsAiResponse(bad, 3).ok).toBe(false)
      }
    })

    it('rejects duplicate contract references', () => {
      const bad = validThree()
      bad.recommendations[1] = rec({ rank: 2, is_front_runner: false, contract_index: 1 })
      const result = validateLeapsAiResponse(bad, 3)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.join(' ')).toMatch(/duplicate contract_index/)
    })
  })

  it('rejects duplicate ranks', () => {
    const bad = validThree()
    bad.recommendations[1] = rec({ rank: 1, is_front_runner: false, contract_index: 2 })
    const result = validateLeapsAiResponse(bad, 3)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/duplicate rank/)
  })

  it('whitelists risk_level and affordability enums', () => {
    for (const risk_level of ['Extreme', 'low', '', null]) {
      const bad = validThree()
      bad.recommendations[0] = rec({ risk_level })
      expect(validateLeapsAiResponse(bad, 3).ok).toBe(false)
    }
    for (const affordability of ['Cheap', 'AFFORDABLE', 42]) {
      const bad = validThree()
      bad.recommendations[0] = rec({ affordability })
      expect(validateLeapsAiResponse(bad, 3).ok).toBe(false)
    }
  })

  it('rejects out-of-range scores and missing reasoning', () => {
    for (const score of [-1, 101, NaN, 'high']) {
      const bad = validThree()
      bad.recommendations[0] = rec({ score })
      expect(validateLeapsAiResponse(bad, 3).ok).toBe(false)
    }
    const noReasoning = validThree()
    noReasoning.recommendations[0] = rec({ ai_reasoning: '' })
    expect(validateLeapsAiResponse(noReasoning, 3).ok).toBe(false)
  })

  describe('front-runner normalization', () => {
    it('assigns the rank-1 entry when the model marks none', () => {
      const none = validThree()
      none.recommendations = none.recommendations.map((r) => ({ ...r, is_front_runner: false }))
      const result = validateLeapsAiResponse(none, 3)
      expect(result.ok).toBe(true)
      if (result.ok) {
        const flagged = result.value.recommendations.filter((r) => r.is_front_runner)
        expect(flagged).toHaveLength(1)
        expect(flagged[0].rank).toBe(1)
      }
    })

    it('collapses multiple front-runners to exactly one', () => {
      const many = validThree()
      many.recommendations = many.recommendations.map((r) => ({ ...r, is_front_runner: true }))
      const result = validateLeapsAiResponse(many, 3)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.recommendations.filter((r) => r.is_front_runner)).toHaveLength(1)
      }
    })
  })

  it('clips over-long free text', () => {
    const long = validThree()
    long.recommendations[0] = rec({ ai_reasoning: 'x'.repeat(50_000) })
    long.front_runner_explanation = 'y'.repeat(50_000)
    const result = validateLeapsAiResponse(long, 3)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.recommendations.find((r) => r.rank === 1)!.ai_reasoning.length).toBe(1_500)
      expect(result.value.front_runner_explanation.length).toBe(4_000)
    }
  })
})
