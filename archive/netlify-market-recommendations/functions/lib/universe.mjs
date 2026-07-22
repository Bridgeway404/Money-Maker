// Curated, verified investment universe (identity metadata only).
// No live prices or fabricated current metrics live here — the provider
// layer supplies all current market data. Static fund facts (expense
// ratio / AUM) are carried separately in demo.mjs with an explicit as-of
// label and must never be presented as "current".

// Broad + sector index-tracking ETFs with real tickers.
export const FUND_UNIVERSE = [
  { ticker: 'VTI',  name: 'Vanguard Total Stock Market ETF', category: 'Total US Market', assetClass: 'Equity', broad: true,  leveraged: false, inverse: false, strategies: ['long', 'growth'] },
  { ticker: 'VOO',  name: 'Vanguard S&P 500 ETF',           category: 'Large-Cap Blend',  assetClass: 'Equity', broad: true,  leveraged: false, inverse: false, strategies: ['long', 'growth'] },
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF',   category: 'Dividend',         assetClass: 'Equity', broad: true,  leveraged: false, inverse: false, strategies: ['long'] },
  { ticker: 'VUG',  name: 'Vanguard Growth ETF',             category: 'Large-Cap Growth', assetClass: 'Equity', broad: true,  leveraged: false, inverse: false, strategies: ['long', 'growth'] },
  { ticker: 'VTV',  name: 'Vanguard Value ETF',              category: 'Large-Cap Value',  assetClass: 'Equity', broad: true,  leveraged: false, inverse: false, strategies: ['long'] },
  { ticker: 'VXUS', name: 'Vanguard Total International Stock ETF', category: 'International', assetClass: 'Equity', broad: true, leveraged: false, inverse: false, strategies: ['long'] },
  { ticker: 'BND',  name: 'Vanguard Total Bond Market ETF',  category: 'Bonds',            assetClass: 'Fixed Income', broad: true, leveraged: false, inverse: false, strategies: ['long'] },
  { ticker: 'QQQ',  name: 'Invesco QQQ Trust',               category: 'Large-Cap Growth / Nasdaq-100', assetClass: 'Equity', broad: true, leveraged: false, inverse: false, strategies: ['long', 'growth'] },
  { ticker: 'SMH',  name: 'VanEck Semiconductor ETF',        category: 'Semiconductors',   assetClass: 'Equity', broad: false, leveraged: false, inverse: false, strategies: ['growth'], industry: 'Semiconductors' },
  { ticker: 'XLK',  name: 'Technology Select Sector SPDR',   category: 'Technology',       assetClass: 'Equity', broad: false, leveraged: false, inverse: false, strategies: ['growth', 'long'], industry: 'Technology' },
  { ticker: 'XLV',  name: 'Health Care Select Sector SPDR',  category: 'Healthcare',       assetClass: 'Equity', broad: false, leveraged: false, inverse: false, strategies: ['long', 'growth'], industry: 'Healthcare' },
  { ticker: 'XLF',  name: 'Financial Select Sector SPDR',    category: 'Financials',       assetClass: 'Equity', broad: false, leveraged: false, inverse: false, strategies: ['long', 'growth'], industry: 'Financial' },
  { ticker: 'XLI',  name: 'Industrial Select Sector SPDR',   category: 'Industrials',      assetClass: 'Equity', broad: false, leveraged: false, inverse: false, strategies: ['long', 'growth'], industry: 'Industrials' },
  { ticker: 'XLY',  name: 'Consumer Discretionary Select Sector SPDR', category: 'Consumer', assetClass: 'Equity', broad: false, leveraged: false, inverse: false, strategies: ['growth'], industry: 'Consumer' },
];

// Individual stock candidate universe (identity only). Industry rank is a
// slow-moving structural fact, not a live price metric, so it is acceptable
// as curated metadata; everything price-related comes from the provider.
export const STOCK_UNIVERSE = [
  { ticker: 'AAPL', name: 'Apple Inc.',          industry: 'Technology',     rank: 1, strategies: ['long', 'growth'] },
  { ticker: 'MSFT', name: 'Microsoft Corp.',     industry: 'Technology',     rank: 2, strategies: ['long', 'growth'] },
  { ticker: 'NVDA', name: 'NVIDIA Corp.',        industry: 'Semiconductors', rank: 1, strategies: ['long', 'growth'] },
  { ticker: 'AVGO', name: 'Broadcom Inc.',       industry: 'Semiconductors', rank: 2, strategies: ['long', 'growth'] },
  { ticker: 'JPM',  name: 'JPMorgan Chase & Co.', industry: 'Financial',     rank: 1, strategies: ['long', 'growth'] },
  { ticker: 'V',    name: 'Visa Inc.',           industry: 'Financial',      rank: 2, strategies: ['long', 'growth'] },
  { ticker: 'UNH',  name: 'UnitedHealth Group',  industry: 'Healthcare',     rank: 1, strategies: ['long'] },
  { ticker: 'LLY',  name: 'Eli Lilly and Co.',   industry: 'Healthcare',     rank: 2, strategies: ['long', 'growth'] },
  { ticker: 'HD',   name: 'Home Depot Inc.',     industry: 'Consumer',       rank: 1, strategies: ['long'] },
  { ticker: 'AMZN', name: 'Amazon.com Inc.',     industry: 'Consumer',       rank: 2, strategies: ['long', 'growth'] },
  { ticker: 'LIN',  name: 'Linde plc',           industry: 'Industrials',    rank: 1, strategies: ['long'] },
  { ticker: 'CAT',  name: 'Caterpillar Inc.',    industry: 'Industrials',    rank: 2, strategies: ['long', 'growth'] },
];

export const VALID_INDUSTRIES = ['Technology', 'Semiconductors', 'Financial', 'Healthcare', 'Consumer', 'Industrials'];
