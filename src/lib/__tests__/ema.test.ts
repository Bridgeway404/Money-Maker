import { describe, expect, it } from 'vitest'
import { ema } from '@/lib/scoring/ema'

describe('ema', () => {
  it('returns the constant value for a flat series', () => {
    const closes = Array(200).fill(50)
    expect(ema(closes, 200)).toBeCloseTo(50)
  })

  it('computes a known 3-period EMA', () => {
    // k = 2/(3+1) = 0.5; seeded at closes[0]:
    // e0 = 10; e1 = 20*0.5 + 10*0.5 = 15; e2 = 30*0.5 + 15*0.5 = 22.5
    expect(ema([10, 20, 30], 3)).toBeCloseTo(22.5)
  })

  it('lands between the series min and max for a rising series', () => {
    const closes = Array.from({ length: 200 }, (_, i) => 100 + i)
    const result = ema(closes, 200)
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(100)
    expect(result!).toBeLessThan(299)
  })

  describe('insufficient-history rejection', () => {
    it('rejects series shorter than the period', () => {
      expect(ema(Array(199).fill(50), 200)).toBeNull()
      expect(ema([], 200)).toBeNull()
      // The archived implementation accepted 30 closes for a 200-week EMA;
      // this one must not.
      expect(ema(Array(30).fill(50), 200)).toBeNull()
    })

    it('accepts a series exactly the period length', () => {
      expect(ema(Array(200).fill(50), 200)).toBeCloseTo(50)
    })
  })

  describe('invalid input rejection', () => {
    it('rejects non-arrays', () => {
      expect(ema(null, 200)).toBeNull()
      expect(ema(undefined, 200)).toBeNull()
      expect(ema('closes' as unknown, 200)).toBeNull()
    })

    it('rejects invalid periods', () => {
      expect(ema([1, 2, 3], 0)).toBeNull()
      expect(ema([1, 2, 3], -1)).toBeNull()
      expect(ema([1, 2, 3], 2.5)).toBeNull()
    })

    it('rejects series containing non-finite or non-positive closes', () => {
      expect(ema([50, NaN, 50], 3)).toBeNull()
      expect(ema([50, Infinity, 50], 3)).toBeNull()
      expect(ema([50, 0, 50], 3)).toBeNull()
      expect(ema([50, -5, 50], 3)).toBeNull()
      expect(ema([50, '50', 50] as unknown as number[], 3)).toBeNull()
    })
  })
})
