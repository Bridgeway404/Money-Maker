import { describe, expect, it } from 'vitest'
import { validateResearchAiResponse } from '@/lib/ai/research-response'

function validNarrative(overrides: Record<string, unknown> = {}) {
  return {
    overview: 'A large-cap technology company with a diversified revenue base.',
    industry_position: 'Among the leaders in its sector by most measures.',
    cash_flow_analysis: 'The supplied cash-flow rating suggests durable generation.',
    earnings_analysis: 'The supplied earnings trend implies steady profitability.',
    debt_analysis: 'A manageable balance sheet at the supplied debt level.',
    technical_analysis: 'Trading near its 200-week EMA per the supplied inputs.',
    bull_case: '• Strong franchise\n• Durable cash flow',
    bear_case: '• Rich valuation\n• Competitive pressure',
    risks: 'Regulatory, competitive, and macro risks apply; data here is limited.',
    conclusion: 'Qualitatively solid; verify with live data before acting.',
    disclaimer: 'Educational research only. Not financial advice.',
    ...overrides,
  }
}

describe('validateResearchAiResponse', () => {
  it('accepts a valid complete research response', () => {
    const result = validateResearchAiResponse(validNarrative())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.overview).toMatch(/technology company/)
      expect(result.value.disclaimer).toMatch(/Educational research/)
    }
  })

  it('defaults disclaimer to empty when the model omits it (route substitutes canonical)', () => {
    const { disclaimer: _omit, ...noDisclaimer } = validNarrative()
    const result = validateResearchAiResponse(noDisclaimer)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.disclaimer).toBe('')
  })

  describe('missing essential sections', () => {
    for (const field of [
      'overview',
      'cash_flow_analysis',
      'technical_analysis',
      'risks',
      'conclusion',
    ]) {
      it(`rejects a response missing "${field}"`, () => {
        const body = validNarrative()
        delete (body as Record<string, unknown>)[field]
        const result = validateResearchAiResponse(body)
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.errors.join(' ')).toContain(field)
      })
    }
  })

  describe('wrong field types', () => {
    for (const bad of [
      { overview: 42 },
      { overview: ['a', 'b'] },
      { overview: { text: 'x' } },
      { overview: null },
      { overview: true },
      { conclusion: 123 },
    ]) {
      it(`rejects ${JSON.stringify(bad)}`, () => {
        const result = validateResearchAiResponse(validNarrative(bad))
        expect(result.ok).toBe(false)
      })
    }
  })

  describe('empty essential sections', () => {
    it('rejects empty-string and whitespace-only sections', () => {
      expect(validateResearchAiResponse(validNarrative({ overview: '' })).ok).toBe(false)
      expect(validateResearchAiResponse(validNarrative({ risks: '   ' })).ok).toBe(false)
      expect(validateResearchAiResponse(validNarrative({ conclusion: '\n\t ' })).ok).toBe(false)
    })
  })

  it('trims and enforces a maximum section length', () => {
    const result = validateResearchAiResponse(validNarrative({ overview: '  ' + 'x'.repeat(50_000) + '  ' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.overview.length).toBe(8_000)
      expect(result.value.overview.startsWith('x')).toBe(true)
    }
  })

  describe('forbidden AI-supplied fields are hard-rejected', () => {
    for (const field of [
      'score',
      'stock_score',
      'total',
      'news',
      'news_summary',
      'current_price',
      'price',
      'market_cap',
      'target_price',
      'analyst_rating',
    ]) {
      it(`rejects a response containing "${field}"`, () => {
        const result = validateResearchAiResponse(validNarrative({ [field]: field.includes('price') || field.includes('score') || field === 'market_cap' || field === 'total' ? 199.5 : 'AAPL beat earnings' }))
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.errors.join(' ')).toContain(field)
      })
    }

    it('rejects an AI-supplied numeric score even when all narrative sections are valid', () => {
      const result = validateResearchAiResponse(validNarrative({ score: 88 }))
      expect(result.ok).toBe(false)
    })

    it('rejects an AI-supplied news_summary even when all narrative sections are valid', () => {
      const result = validateResearchAiResponse(validNarrative({ news_summary: 'Company announced a buyback today.' }))
      expect(result.ok).toBe(false)
    })
  })

  it('ignores unrecognized non-forbidden fields (deliberate drop)', () => {
    const result = validateResearchAiResponse(validNarrative({ moon_phase: 'waxing', extra_note: 'hello' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('moon_phase' in result.value).toBe(false)
      expect('extra_note' in result.value).toBe(false)
    }
  })

  describe('malformed / non-object input', () => {
    it('rejects null, arrays, primitives', () => {
      expect(validateResearchAiResponse(null).ok).toBe(false)
      expect(validateResearchAiResponse(undefined).ok).toBe(false)
      expect(validateResearchAiResponse([1, 2, 3]).ok).toBe(false)
      expect(validateResearchAiResponse('a report').ok).toBe(false)
      expect(validateResearchAiResponse(42).ok).toBe(false)
    })

    it('rejects a response containing only irrelevant fields', () => {
      const result = validateResearchAiResponse({ foo: 'bar', hello: 'world' })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
