// Deterministic demo market data. Clearly labelled "Demo Data" everywhere
// it surfaces. Values are illustrative examples, NOT current market prices.
// The same request always yields the same demo result (no random
// "fake current market" narrative per the spec).

export const DEMO_AS_OF = '2024-06-14 (illustrative sample — not current)';

// Per-stock seed metrics. `emaTargetPct` is the intended distance of the
// current price ABOVE the synthesized 200-week EMA; scoring.mjs synthesizes a
// deterministic linear weekly series from this so the computed EMA matches.
// Fundamentals are coarse demo signals, not precise financials.
export const DEMO_STOCKS = {
  AAPL: { price: 213.50, prevClose: 211.20, volume: 54_000_000, avgVolume: 58_000_000, marketCap: 3.5e12, emaTargetPct: 7.5,
          cashFlow: 'strong', cashFlowTrend: 'rising', earningsTrend: 'growing', revenueTrend: 'growing', debt: 108e9, equity: 62e9 },
  MSFT: { price: 415.20, prevClose: 410.10, volume: 21_000_000, avgVolume: 24_000_000, marketCap: 3.1e12, emaTargetPct: 8.0,
          cashFlow: 'strong', cashFlowTrend: 'rising', earningsTrend: 'growing', revenueTrend: 'growing', debt: 47e9, equity: 238e9 },
  NVDA: { price: 134.80, prevClose: 129.60, volume: 310_000_000, avgVolume: 260_000_000, marketCap: 3.3e12, emaTargetPct: 22.0,
          cashFlow: 'strong', cashFlowTrend: 'rising', earningsTrend: 'growing', revenueTrend: 'growing', debt: 10e9, equity: 49e9 },
  AVGO: { price: 162.40, prevClose: 159.80, volume: 28_000_000, avgVolume: 30_000_000, marketCap: 760e9, emaTargetPct: 14.0,
          cashFlow: 'strong', cashFlowTrend: 'rising', earningsTrend: 'growing', revenueTrend: 'growing', debt: 74e9, equity: 68e9 },
  JPM:  { price: 225.40, prevClose: 223.10, volume: 9_000_000, avgVolume: 10_500_000, marketCap: 690e9, emaTargetPct: 8.0,
          cashFlow: 'strong', cashFlowTrend: 'stable', earningsTrend: 'growing', revenueTrend: 'growing', debt: 430e9, equity: 345e9 },
  V:    { price: 268.90, prevClose: 266.40, volume: 6_500_000, avgVolume: 7_200_000, marketCap: 540e9, emaTargetPct: 6.0,
          cashFlow: 'strong', cashFlowTrend: 'rising', earningsTrend: 'growing', revenueTrend: 'growing', debt: 20e9, equity: 39e9 },
  UNH:  { price: 542.30, prevClose: 549.80, volume: 3_400_000, avgVolume: 3_100_000, marketCap: 510e9, emaTargetPct: 4.0,
          cashFlow: 'strong', cashFlowTrend: 'stable', earningsTrend: 'stable', revenueTrend: 'growing', debt: 78e9, equity: 108e9 },
  LLY:  { price: 880.10, prevClose: 865.30, volume: 3_000_000, avgVolume: 3_400_000, marketCap: 830e9, emaTargetPct: 28.0,
          cashFlow: 'positive', cashFlowTrend: 'rising', earningsTrend: 'growing', revenueTrend: 'growing', debt: 25e9, equity: 14e9 },
  HD:   { price: 388.60, prevClose: 385.20, volume: 3_200_000, avgVolume: 3_600_000, marketCap: 360e9, emaTargetPct: 4.5,
          cashFlow: 'positive', cashFlowTrend: 'stable', earningsTrend: 'stable', revenueTrend: 'stable', debt: 43e9, equity: 1.4e9 },
  AMZN: { price: 186.30, prevClose: 184.10, volume: 38_000_000, avgVolume: 42_000_000, marketCap: 1.9e12, emaTargetPct: 11.0,
          cashFlow: 'strong', cashFlowTrend: 'rising', earningsTrend: 'growing', revenueTrend: 'growing', debt: 135e9, equity: 201e9 },
  LIN:  { price: 462.80, prevClose: 459.40, volume: 1_600_000, avgVolume: 1_800_000, marketCap: 215e9, emaTargetPct: 5.5,
          cashFlow: 'positive', cashFlowTrend: 'rising', earningsTrend: 'growing', revenueTrend: 'growing', debt: 19e9, equity: 40e9 },
  CAT:  { price: 332.10, prevClose: 336.80, volume: 2_900_000, avgVolume: 3_300_000, marketCap: 160e9, emaTargetPct: 9.0,
          cashFlow: 'positive', cashFlowTrend: 'stable', earningsTrend: 'stable', revenueTrend: 'stable', debt: 38e9, equity: 18e9 },
};

// Demo fund data. `price` is an illustrative demo quote. expenseRatio / aum
// are STATIC reference facts carried with an explicit as-of label.
export const DEMO_FUNDS = {
  VTI:  { price: 268.40, prevClose: 266.90, volume: 3_100_000, avgVolume: 3_400_000, expenseRatio: '0.03%', aum: '$420B', staticAsOf: 'Vanguard 2024 profile (static)' },
  VOO:  { price: 498.10, prevClose: 495.20, volume: 4_600_000, avgVolume: 4_900_000, expenseRatio: '0.03%', aum: '$480B', staticAsOf: 'Vanguard 2024 profile (static)' },
  SCHD: { price: 81.20,  prevClose: 80.60,  volume: 5_200_000, avgVolume: 5_500_000, expenseRatio: '0.06%', aum: '$55B',  staticAsOf: 'Schwab 2024 profile (static)' },
  VUG:  { price: 372.50, prevClose: 368.10, volume: 600_000,   avgVolume: 700_000,   expenseRatio: '0.04%', aum: '$120B', staticAsOf: 'Vanguard 2024 profile (static)' },
  VTV:  { price: 164.30, prevClose: 163.80, volume: 1_400_000, avgVolume: 1_600_000, expenseRatio: '0.04%', aum: '$105B', staticAsOf: 'Vanguard 2024 profile (static)' },
  VXUS: { price: 61.40,  prevClose: 61.10,  volume: 2_900_000, avgVolume: 3_200_000, expenseRatio: '0.08%', aum: '$70B',  staticAsOf: 'Vanguard 2024 profile (static)' },
  BND:  { price: 72.10,  prevClose: 72.20,  volume: 5_800_000, avgVolume: 6_100_000, expenseRatio: '0.03%', aum: '$110B', staticAsOf: 'Vanguard 2024 profile (static)' },
  QQQ:  { price: 478.20, prevClose: 472.60, volume: 31_000_000, avgVolume: 34_000_000, expenseRatio: '0.20%', aum: '$280B', staticAsOf: 'Invesco 2024 profile (static)' },
  SMH:  { price: 258.70, prevClose: 251.40, volume: 7_400_000, avgVolume: 6_900_000, expenseRatio: '0.35%', aum: '$22B',  staticAsOf: 'VanEck 2024 profile (static)' },
  XLK:  { price: 226.90, prevClose: 224.10, volume: 6_200_000, avgVolume: 6_800_000, expenseRatio: '0.09%', aum: '$70B',  staticAsOf: 'SSGA 2024 profile (static)' },
  XLV:  { price: 146.80, prevClose: 147.50, volume: 7_100_000, avgVolume: 7_600_000, expenseRatio: '0.09%', aum: '$40B',  staticAsOf: 'SSGA 2024 profile (static)' },
  XLF:  { price: 41.60,  prevClose: 41.30,  volume: 38_000_000, avgVolume: 41_000_000, expenseRatio: '0.09%', aum: '$38B', staticAsOf: 'SSGA 2024 profile (static)' },
  XLI:  { price: 128.40, prevClose: 129.10, volume: 9_300_000, avgVolume: 9_900_000, expenseRatio: '0.09%', aum: '$18B',  staticAsOf: 'SSGA 2024 profile (static)' },
  XLY:  { price: 182.30, prevClose: 180.50, volume: 4_100_000, avgVolume: 4_500_000, expenseRatio: '0.09%', aum: '$19B',  staticAsOf: 'SSGA 2024 profile (static)' },
};
