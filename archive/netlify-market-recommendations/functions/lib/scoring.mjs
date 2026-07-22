// Deterministic server-side calculations and scoring. Claude never invents
// these numbers — it only interprets them. All math lives here.

// Scoring weight configuration (Phase 13). Stored as an editable object.
export const WEIGHTS = {
  growth: {
    growth: 20,        // earnings/revenue growth
    momentum: 20,      // price momentum
    liquidity: 15,     // relative volume + liquidity
    financialHealth: 15,
    industryStrength: 10,
    quality: 10,       // market cap / business quality
    strategyFit: 10,   // user risk + strategy fit
  },
  long: {
    cashFlow: 20,      // cash-flow strength and trend
    earnings: 20,      // earnings quality and growth
    leadership: 15,    // industry leadership
    emaDistance: 15,   // distance from 200-week EMA
    balanceSheet: 10,  // debt-to-equity
    quality: 10,       // durable business quality
    diversification: 5,// portfolio overlap
    strategyFit: 5,    // user risk + strategy fit
  },
};

// Exponential moving average over an ordered (oldest -> newest) close array.
export function ema(closes, period) {
  if (!Array.isArray(closes) || closes.length < Math.min(period, 30)) return null;
  const k = 2 / (period + 1);
  let e = closes[0];
  for (let i = 1; i < closes.length; i++) e = closes[i] * k + e * (1 - k);
  return e;
}

// Synthesize a deterministic weekly close series (oldest -> newest) ending at
// `currentPrice` such that the 200-week EMA sits ~`targetAbovePct` below price.
// Used only for demo data so EMA distance is reproducible and realistic.
export function synthWeeklyBars(currentPrice, targetAbovePct, weeks = 200) {
  const t = targetAbovePct / 100;
  // For a linear ramp P0..P1 the EMA end ~ (P0+P1)/2, giving distance
  // (P1-P0)/(P1+P0). Solve P0 for the desired distance t.
  const p0 = currentPrice * (1 - t) / (1 + t);
  const bars = [];
  for (let i = 0; i < weeks; i++) {
    bars.push(p0 + (currentPrice - p0) * (i / (weeks - 1)));
  }
  return bars;
}

export function pctChange(curr, prev) {
  if (!isFiniteNum(curr) || !isFiniteNum(prev) || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export function relativeVolume(volume, avgVolume) {
  if (!isFiniteNum(volume) || !isFiniteNum(avgVolume) || avgVolume === 0) return null;
  return volume / avgVolume;
}

export function debtToEquity(debt, equity) {
  if (!isFiniteNum(debt) || !isFiniteNum(equity) || equity === 0) return null;
  return debt / equity;
}

export function distanceFromEma(price, emaVal) {
  if (!isFiniteNum(price) || !isFiniteNum(emaVal) || emaVal === 0) return null;
  return ((price - emaVal) / emaVal) * 100;
}

function isFiniteNum(n) { return typeof n === 'number' && Number.isFinite(n); }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

const TREND_SCORE = { rising: 1, growing: 1, stable: 0.55, declining: 0, falling: 0 };

// ---- Long-Term Wealth Building score -------------------------------------
export function scoreLongTerm(metrics, ctx = {}) {
  const w = WEIGHTS.long;
  const bd = {};
  const missing = [];
  const disqualifiers = [];

  // Cash flow
  if (metrics.cashFlow == null) { bd.cashFlow = 0; missing.push('cash flow'); }
  else {
    const neg = metrics.cashFlow === 'negative';
    if (neg) disqualifiers.push('Negative cash flow');
    const base = neg ? 0 : metrics.cashFlow === 'strong' ? 1 : 0.7;
    const trend = TREND_SCORE[metrics.cashFlowTrend] ?? 0.55;
    bd.cashFlow = round(w.cashFlow * (base * 0.7 + trend * 0.3));
  }

  // Earnings
  if (metrics.earningsTrend == null) { bd.earnings = 0; missing.push('earnings trend'); }
  else {
    if (metrics.earningsTrend === 'declining') disqualifiers.push('Materially declining earnings');
    bd.earnings = round(w.earnings * (TREND_SCORE[metrics.earningsTrend] ?? 0.55));
  }

  // Industry leadership
  if (metrics.rank == null) { bd.leadership = 0; missing.push('industry rank'); }
  else {
    if (metrics.rank > 3) disqualifiers.push('Not a top-3 industry leader');
    bd.leadership = round(w.leadership * (metrics.rank === 1 ? 1 : metrics.rank === 2 ? 0.8 : metrics.rank === 3 ? 0.6 : 0.2));
  }

  // Distance from 200-week EMA (5% strongest, 5-10% qualifying, >10% weaker)
  if (metrics.emaDistance == null) { bd.emaDistance = 0; missing.push('200-week EMA'); }
  else {
    const d = Math.abs(metrics.emaDistance);
    const f = d <= 5 ? 1 : d <= 10 ? 0.75 : d <= 20 ? 0.4 : d <= 30 ? 0.15 : 0;
    bd.emaDistance = round(w.emaDistance * f);
  }

  // Balance sheet (D/E)
  if (metrics.debtToEquity == null) { bd.balanceSheet = round(w.balanceSheet * 0.4); missing.push('debt-to-equity'); }
  else {
    const de = metrics.debtToEquity;
    const f = de < 0.5 ? 1 : de < 1 ? 0.75 : de < 1.5 ? 0.45 : de < 2.5 ? 0.2 : 0.05;
    bd.balanceSheet = round(w.balanceSheet * f);
  }

  // Durable quality (proxy: large cap + positive cash flow)
  const capScore = metrics.marketCap == null ? 0.5 : metrics.marketCap >= 5e11 ? 1 : metrics.marketCap >= 1e11 ? 0.8 : metrics.marketCap >= 2e10 ? 0.55 : 0.3;
  bd.quality = round(w.quality * capScore);

  // Diversification / portfolio overlap (less overlap = better)
  bd.diversification = round(w.diversification * (ctx.portfolioOverlap ? 0.3 : 1));

  // Strategy fit (risk tolerance alignment — long-term suits conservative/moderate)
  bd.strategyFit = round(w.strategyFit * (ctx.risk === 'Aggressive' ? 0.6 : 1));

  return finalize(bd, missing, disqualifiers);
}

// ---- Higher-Growth Opportunities score -----------------------------------
export function scoreGrowth(metrics, ctx = {}) {
  const w = WEIGHTS.growth;
  const bd = {};
  const missing = [];
  const disqualifiers = [];

  // Growth (earnings/revenue)
  const eT = TREND_SCORE[metrics.earningsTrend];
  const rT = TREND_SCORE[metrics.revenueTrend];
  if (eT == null && rT == null) { bd.growth = 0; missing.push('earnings/revenue growth'); }
  else bd.growth = round(w.growth * avg([eT, rT]));

  // Momentum (weekly % change, capped)
  if (metrics.weeklyChange == null) { bd.momentum = round(w.momentum * 0.4); missing.push('price momentum'); }
  else {
    const m = clamp((metrics.weeklyChange + 5) / 15, 0, 1); // -5% -> 0, +10% -> 1
    bd.momentum = round(w.momentum * m);
  }

  // Liquidity (relative volume + absolute liquidity)
  if (metrics.relVolume == null) { bd.liquidity = round(w.liquidity * 0.4); missing.push('relative volume'); }
  else {
    const rv = clamp((metrics.relVolume - 0.5) / 1.5, 0, 1); // 0.5x -> 0, 2x -> 1
    const liq = metrics.avgVolume == null ? 0.6 : clamp(metrics.avgVolume / 5_000_000, 0, 1);
    bd.liquidity = round(w.liquidity * (rv * 0.6 + liq * 0.4));
  }

  // Financial health (cash flow + manageable debt)
  const cf = metrics.cashFlow === 'negative' ? 0 : metrics.cashFlow === 'strong' ? 1 : metrics.cashFlow == null ? 0.5 : 0.7;
  const deF = metrics.debtToEquity == null ? 0.6 : metrics.debtToEquity < 1 ? 1 : metrics.debtToEquity < 2 ? 0.5 : 0.2;
  bd.financialHealth = round(w.financialHealth * (cf * 0.6 + deF * 0.4));
  if (metrics.cashFlow === 'negative') disqualifiers.push('Negative cash flow');

  // Industry strength
  bd.industryStrength = round(w.industryStrength * (ctx.favoredIndustry ? 1 : 0.6));

  // Market cap / business quality
  const capScore = metrics.marketCap == null ? 0.5 : metrics.marketCap >= 1e11 ? 1 : metrics.marketCap >= 1e10 ? 0.75 : metrics.marketCap >= 2e9 ? 0.5 : 0.2;
  bd.quality = round(w.quality * capScore);
  if (metrics.marketCap != null && metrics.marketCap < 3e8) disqualifiers.push('Micro-cap below liquidity floor');

  // Strategy fit (growth suits moderate/aggressive)
  bd.strategyFit = round(w.strategyFit * (ctx.risk === 'Conservative' ? 0.6 : 1));

  return finalize(bd, missing, disqualifiers);
}

function finalize(bd, missing, disqualifiers) {
  let total = Object.values(bd).reduce((a, b) => a + b, 0);
  // Missing-data deduction is implicit (unscored factors contribute 0).
  const dataCompleteness = missing.length === 0 ? 'High' : missing.length <= 2 ? 'Medium' : 'Low';
  const confidence = disqualifiers.length ? 'Low' : missing.length <= 1 ? 'High' : missing.length <= 3 ? 'Medium' : 'Low';
  if (disqualifiers.length) total = Math.min(total, 45); // cannot be a "strong" pick
  return {
    score: clamp(Math.round(total), 0, 100),
    breakdown: bd,
    missing,
    disqualifiers,
    dataCompleteness,
    confidence,
  };
}

function round(n) { return Math.round(n * 10) / 10; }
function avg(arr) { const v = arr.filter(x => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.5; }
