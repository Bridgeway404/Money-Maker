import { describe, expect, it } from 'vitest'
import { calculateScore, calculateEmaDistance, DEFAULT_WEIGHTS } from '@/lib/scoring'
import type { StockMetrics, ScoringWeights } from '@/types'

const BASE: StockMetrics = {
  ticker: 'AAPL',
  company_name: 'Apple Inc.',
  industry: 'Technology',
  market_cap_rank: '1st',
  cash_flow: 'Strong',
  earnings_trend: 'Growing',
  debt_to_equity: 'Low',
  current_price: 100,
  ema_200_week: 100,
  ema_distance_pct: 0,
}

describe('calculateScore', () => {
  it('gives a perfect setup the maximum score of 100', () => {
    const score = calculateScore(BASE)
    // 25 + 20 + 20 + 10 + 15 + affordability + 5; affordability for a $100
    // stock (est. premium $800) is full 5 points.
    expect(score.total).toBe(100)
    expect(score.disqualified).toBe(false)
    expect(score.breakdown.industry_leadership).toBe(25)
    expect(score.breakdown.ema_distance).toBe(15)
  })

  it('caps the total at 100', () => {
    const score = calculateScore(BASE)
    expect(score.total).toBeLessThanOrEqual(100)
  })

  describe('disqualifiers force a zero score', () => {
    it('negative cash flow', () => {
      const score = calculateScore({ ...BASE, cash_flow: 'Negative' })
      expect(score.total).toBe(0)
      expect(score.disqualified).toBe(true)
      expect(score.disqualifier_reason).toMatch(/cash flow/i)
    })

    it('declining earnings', () => {
      const score = calculateScore({ ...BASE, earnings_trend: 'Declining' })
      expect(score.total).toBe(0)
      expect(score.disqualified).toBe(true)
      expect(score.disqualifier_reason).toMatch(/earnings/i)
    })

    it('not an industry leader', () => {
      const score = calculateScore({ ...BASE, market_cap_rank: 'Other' })
      expect(score.total).toBe(0)
      expect(score.disqualified).toBe(true)
      expect(score.disqualifier_reason).toMatch(/industry leader/i)
    })
  })

  describe('EMA distance bands', () => {
    const cases: Array<[number, number]> = [
      [0, 15], // ≤5% → full points
      [5, 15],
      [8, Math.round(15 * 0.85)], // 5-10%
      [15, Math.round(15 * 0.5)], // 10-20%
      [25, Math.round(15 * 0.2)], // 20-30%
      [50, Math.round(15 * 0.05)], // >30%
    ]
    for (const [distance, expected] of cases) {
      it(`${distance}% from EMA scores ${expected}/15`, () => {
        const score = calculateScore({ ...BASE, ema_distance_pct: distance })
        expect(score.breakdown.ema_distance).toBe(expected)
      })
    }

    it('treats negative distance (below EMA) by absolute value', () => {
      const below = calculateScore({ ...BASE, ema_distance_pct: -8 })
      const above = calculateScore({ ...BASE, ema_distance_pct: 8 })
      expect(below.breakdown.ema_distance).toBe(above.breakdown.ema_distance)
    })
  })

  it('applies custom weights', () => {
    const custom: ScoringWeights = {
      industry_leadership: 40,
      cash_flow: 20,
      earnings_quality: 20,
      debt_to_equity: 5,
      ema_distance: 5,
      option_affordability: 5,
      option_expiration: 5,
    }
    const score = calculateScore(BASE, custom)
    expect(score.breakdown.industry_leadership).toBe(40)
    expect(score.breakdown.debt_to_equity).toBe(5)
  })

  it('scores partial-quality inputs between 0 and 100', () => {
    const score = calculateScore({
      ...BASE,
      market_cap_rank: '3rd',
      cash_flow: 'Positive',
      earnings_trend: 'Stable',
      debt_to_equity: 'High',
      ema_distance_pct: 25,
    })
    expect(score.disqualified).toBe(false)
    expect(score.total).toBeGreaterThan(0)
    expect(score.total).toBeLessThan(70)
  })
})

describe('calculateEmaDistance', () => {
  it('computes percentage distance from the EMA', () => {
    expect(calculateEmaDistance(110, 100)).toBeCloseTo(10)
    expect(calculateEmaDistance(90, 100)).toBeCloseTo(-10)
  })

  it('returns 0 when the EMA is 0 (avoids division by zero)', () => {
    expect(calculateEmaDistance(100, 0)).toBe(0)
  })
})

describe('DEFAULT_WEIGHTS', () => {
  it('totals exactly 100', () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(100)
  })
})
