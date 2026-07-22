// Exponential moving average over an ordered (oldest -> newest) close series.
//
// Ported from the archived Netlify function (archive/netlify-market-
// recommendations/functions/lib/scoring.mjs) with one deliberate change: the
// archived version accepted as few as 30 closes for a "200-week" EMA, which
// mislabels the indicator for short-history tickers. This version refuses to
// compute unless at least `period` closes are supplied — callers must treat
// null as "insufficient history", never substitute a guess.
export function ema(closes: unknown, period: number): number | null {
  if (!Array.isArray(closes)) return null
  if (!Number.isInteger(period) || period <= 0) return null
  if (closes.length < period) return null
  for (const c of closes) {
    if (typeof c !== 'number' || !Number.isFinite(c) || c <= 0) return null
  }
  const k = 2 / (period + 1)
  let e = closes[0] as number
  for (let i = 1; i < closes.length; i++) {
    e = (closes[i] as number) * k + e * (1 - k)
  }
  return e
}
