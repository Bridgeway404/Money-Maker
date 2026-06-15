// Market-data provider abstraction. The recommendation engine consumes a
// normalized shape and never touches a provider's raw response structure, so
// Polygon or Alpaca can be swapped purely via MARKET_DATA_PROVIDER.
//
// Normalized quote shape (any field may be null = "not available"):
//   { ticker, price, prevClose, volume, avgVolume, marketCap, industry,
//     weeklyCloses[], feedType, provider, asOf,
//     cashFlow, cashFlowTrend, earningsTrend, revenueTrend, debt, equity, rank }

import { DEMO_STOCKS, DEMO_FUNDS, DEMO_AS_OF } from './demo.mjs';
import { synthWeeklyBars } from './scoring.mjs';

const DEFAULT_TIMEOUT = 8000;

export function selectProvider(env) {
  const choice = (env.MARKET_DATA_PROVIDER || 'demo').toLowerCase();
  if (choice === 'polygon' && env.POLYGON_API_KEY) return new PolygonProvider(env);
  if (choice === 'alpaca' && env.ALPACA_API_KEY_ID && env.ALPACA_API_SECRET_KEY) return new AlpacaProvider(env);
  // Explicit demo, or live requested but credentials missing -> demo.
  const reason = choice !== 'demo' ? `Credentials for "${choice}" not configured` : null;
  return new DemoProvider(env, reason);
}

async function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms || DEFAULT_TIMEOUT);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

// --------------------------- Demo ----------------------------------------
export class DemoProvider {
  constructor(env, fallbackReason = null) {
    this.name = 'Demo';
    this.feedType = 'Demo';
    this.isDemo = true;
    this.fallbackReason = fallbackReason; // set when live was requested but unavailable
  }
  async getStock(ticker) {
    const d = DEMO_STOCKS[ticker];
    if (!d) return null;
    return {
      ticker, price: d.price, prevClose: d.prevClose, volume: d.volume, avgVolume: d.avgVolume,
      marketCap: d.marketCap, weeklyCloses: synthWeeklyBars(d.price, d.emaTargetPct),
      cashFlow: d.cashFlow, cashFlowTrend: d.cashFlowTrend, earningsTrend: d.earningsTrend,
      revenueTrend: d.revenueTrend, debt: d.debt, equity: d.equity,
      feedType: 'Demo', provider: 'Demo', asOf: DEMO_AS_OF,
    };
  }
  async getFund(ticker) {
    const d = DEMO_FUNDS[ticker];
    if (!d) return null;
    return {
      ticker, price: d.price, prevClose: d.prevClose, volume: d.volume, avgVolume: d.avgVolume,
      expenseRatio: d.expenseRatio, aum: d.aum, staticAsOf: d.staticAsOf,
      feedType: 'Demo', provider: 'Demo', asOf: DEMO_AS_OF,
    };
  }
}

// --------------------------- Polygon -------------------------------------
// https://polygon.io/docs — uses /v2/aggs (weekly bars) and prev close.
export class PolygonProvider {
  constructor(env) {
    this.name = 'Polygon';
    this.feedType = 'Delayed'; // most retail Polygon plans are 15-min delayed
    this.isDemo = false;
    this.key = env.POLYGON_API_KEY;
    this.timeout = +env.MARKET_DATA_TIMEOUT_MS || DEFAULT_TIMEOUT;
  }
  async _json(url) {
    const r = await fetchWithTimeout(`${url}${url.includes('?') ? '&' : '?'}apiKey=${this.key}`, {}, this.timeout);
    if (r.status === 429) throw Object.assign(new Error('rate_limited'), { code: 'rate_limited' });
    if (!r.ok) throw new Error(`polygon_${r.status}`);
    return r.json();
  }
  async _common(ticker) {
    const to = new Date();
    const from = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 220);
    const fmt = (dt) => dt.toISOString().slice(0, 10);
    const aggs = await this._json(`https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/week/${fmt(from)}/${fmt(to)}?adjusted=true&sort=asc&limit=300`);
    const closes = (aggs.results || []).map(b => b.c).filter(c => typeof c === 'number');
    const last = (aggs.results || []).slice(-1)[0] || {};
    const prev = (aggs.results || []).slice(-2)[0] || {};
    return {
      ticker, price: last.c ?? null, prevClose: prev.c ?? null,
      volume: last.v ?? null, avgVolume: avgOf((aggs.results || []).slice(-13).map(b => b.v)),
      weeklyCloses: closes, feedType: this.feedType, provider: this.name,
      asOf: last.t ? new Date(last.t).toISOString() : new Date().toISOString(),
    };
  }
  async getStock(ticker) {
    const base = await this._common(ticker);
    let marketCap = null, industry = null;
    try {
      const d = await this._json(`https://api.polygon.io/v3/reference/tickers/${ticker}`);
      marketCap = d.results?.market_cap ?? null;
      industry = d.results?.sic_description ?? null;
    } catch { /* non-fatal: mark unavailable */ }
    // Fundamentals (cash flow / earnings) are not reliably available on basic
    // plans; mark unavailable rather than fabricate.
    return { ...base, marketCap, industry,
      cashFlow: null, cashFlowTrend: null, earningsTrend: null, revenueTrend: null, debt: null, equity: null };
  }
  async getFund(ticker) {
    const base = await this._common(ticker);
    return { ...base, expenseRatio: null, aum: null, staticAsOf: null };
  }
}

// --------------------------- Alpaca --------------------------------------
// https://docs.alpaca.markets — Market Data API v2 weekly bars.
export class AlpacaProvider {
  constructor(env) {
    this.name = 'Alpaca';
    this.feed = (env.ALPACA_DATA_FEED || 'iex').toLowerCase();
    this.feedType = this.feed === 'sip' ? 'Real-Time' : 'Delayed';
    this.isDemo = false;
    this.headers = { 'APCA-API-KEY-ID': env.ALPACA_API_KEY_ID, 'APCA-API-SECRET-KEY': env.ALPACA_API_SECRET_KEY };
    this.timeout = +env.MARKET_DATA_TIMEOUT_MS || DEFAULT_TIMEOUT;
  }
  async _json(url) {
    const r = await fetchWithTimeout(url, { headers: this.headers }, this.timeout);
    if (r.status === 429) throw Object.assign(new Error('rate_limited'), { code: 'rate_limited' });
    if (!r.ok) throw new Error(`alpaca_${r.status}`);
    return r.json();
  }
  async _common(ticker) {
    const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 * 220).toISOString().slice(0, 10);
    const d = await this._json(`https://data.alpaca.markets/v2/stocks/${ticker}/bars?timeframe=1Week&start=${start}&limit=300&feed=${this.feed}&adjustment=all`);
    const bars = d.bars || [];
    const closes = bars.map(b => b.c).filter(c => typeof c === 'number');
    const last = bars.slice(-1)[0] || {};
    const prev = bars.slice(-2)[0] || {};
    return {
      ticker, price: last.c ?? null, prevClose: prev.c ?? null,
      volume: last.v ?? null, avgVolume: avgOf(bars.slice(-13).map(b => b.v)),
      weeklyCloses: closes, feedType: this.feedType, provider: this.name,
      asOf: last.t || new Date().toISOString(),
    };
  }
  async getStock(ticker) {
    const base = await this._common(ticker);
    return { ...base, marketCap: null, industry: null,
      cashFlow: null, cashFlowTrend: null, earningsTrend: null, revenueTrend: null, debt: null, equity: null };
  }
  async getFund(ticker) {
    const base = await this._common(ticker);
    return { ...base, expenseRatio: null, aum: null, staticAsOf: null };
  }
}

function avgOf(arr) {
  const v = (arr || []).filter(n => typeof n === 'number' && Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
