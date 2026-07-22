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

const DEFAULT_TIMEOUT = 2500; // tight budget: handler controls per-stage limits

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
  async getBatch(tickers) {
    const result = {};
    for (const ticker of tickers) {
      const s = DEMO_STOCKS[ticker];
      if (s) {
        result[ticker] = {
          ticker, price: s.price, prevClose: s.prevClose, volume: s.volume, avgVolume: s.avgVolume,
          marketCap: s.marketCap, weeklyCloses: synthWeeklyBars(s.price, s.emaTargetPct),
          cashFlow: s.cashFlow, cashFlowTrend: s.cashFlowTrend,
          earningsTrend: s.earningsTrend, revenueTrend: s.revenueTrend,
          debt: s.debt, equity: s.equity,
          expenseRatio: null, aum: null, staticAsOf: null,
          feedType: 'Demo', provider: 'Demo', asOf: DEMO_AS_OF,
        };
        continue;
      }
      const f = DEMO_FUNDS[ticker];
      if (f) {
        result[ticker] = {
          ticker, price: f.price, prevClose: f.prevClose, volume: f.volume, avgVolume: f.avgVolume,
          expenseRatio: f.expenseRatio, aum: f.aum, staticAsOf: f.staticAsOf,
          weeklyCloses: [], marketCap: null,
          cashFlow: null, cashFlowTrend: null, earningsTrend: null, revenueTrend: null,
          debt: null, equity: null,
          feedType: 'Demo', provider: 'Demo', asOf: DEMO_AS_OF,
        };
      }
    }
    return result;
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
  async getBatch(tickers) {
    const settled = await Promise.allSettled(tickers.map(t => this._common(t)));
    const result = {};
    tickers.forEach((t, i) => {
      if (settled[i].status === 'fulfilled') {
        result[t] = { ...settled[i].value,
          marketCap: null, cashFlow: null, cashFlowTrend: null,
          earningsTrend: null, revenueTrend: null, debt: null, equity: null,
          expenseRatio: null, aum: null, staticAsOf: null };
      }
    });
    return result;
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
  // One multi-symbol request for all tickers — avoids per-ticker round trips.
  // Alpaca GET /v2/stocks/bars?symbols=A,B,C&timeframe=1Week&...
  async getBatch(tickers) {
    const symbols = tickers.join(',');
    const start   = new Date(Date.now() - 220 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const url     = `https://data.alpaca.markets/v2/stocks/bars?symbols=${symbols}&timeframe=1Week&start=${start}&limit=300&feed=${this.feed}&adjustment=all&sort=asc`;
    let data;
    try { data = await this._json(url); } catch { return {}; }
    const bars = data.bars || {};
    const result = {};
    for (const ticker of tickers) {
      const tickerBars = bars[ticker] || [];
      const closes     = tickerBars.map(b => b.c).filter(c => typeof c === 'number');
      const last       = tickerBars.slice(-1)[0] || {};
      const prev       = tickerBars.slice(-2)[0] || {};
      result[ticker] = {
        ticker,
        price: last.c ?? null, prevClose: prev.c ?? null,
        volume: last.v ?? null, avgVolume: avgOf(tickerBars.slice(-13).map(b => b.v)),
        weeklyCloses: closes,
        feedType: this.feedType, provider: this.name,
        asOf: last.t || new Date().toISOString(),
        // Fundamentals not in bars endpoint:
        marketCap: null, cashFlow: null, cashFlowTrend: null,
        earningsTrend: null, revenueTrend: null, debt: null, equity: null,
        expenseRatio: null, aum: null, staticAsOf: null,
      };
    }
    return result;
  }
}

function avgOf(arr) {
  const v = (arr || []).filter(n => typeof n === 'number' && Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
