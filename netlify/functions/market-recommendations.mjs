// Netlify Function: POST /.netlify/functions/market-recommendations
// Pipeline: validate → pre-select 5 stocks + 3 funds → ONE Alpaca batch
// request → deterministic score → optional Claude enrichment → 200 JSON.
// Hard budget: 8 s. Demo Data fallback on any live-service failure.

import { FUND_UNIVERSE, STOCK_UNIVERSE } from './lib/universe.mjs';
import { selectProvider } from './lib/providers.mjs';
import { ema, distanceFromEma, pctChange, relativeVolume, debtToEquity, scoreLongTerm, scoreGrowth } from './lib/scoring.mjs';
import { validateRequest, validateResponse } from './lib/validate.mjs';
import { buildSystemPrompt, getClaudeRecommendations } from './lib/claude.mjs';

const DISCLAIMER = 'Educational research only — not individualized financial advice. No outcome is guaranteed; you are responsible for your own investment decisions.';

const STOCK_LIMIT       = 5;     // pre-selected candidates for the batch call
const FUND_LIMIT        = 3;
const ALPACA_TIMEOUT_MS = 2500;  // hard wall on the single batch request
const CLAUDE_TIMEOUT_MS = 3500;  // hard wall on Claude enrichment
const TOTAL_BUDGET_MS   = 8000;  // overall budget (Netlify default is 10 s)

const CACHE = new Map();
const cacheTtl = (env) => (+env.MARKET_DATA_CACHE_TTL_SECONDS || 60) * 1000;

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed. Use POST.' });

  let raw;
  try { raw = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body.' }); }

  const v = validateRequest(raw);
  if (!v.ok) return json(400, { error: v.error });
  const input = v.value;
  const env = process.env;
  const t0 = Date.now();
  log(t0, 'validated');

  const cacheKey = JSON.stringify(input);
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.t < cacheTtl(env)) return json(200, hit.v);

  try {
    const result = await runPipeline(input, env, t0);
    CACHE.set(cacheKey, { t: Date.now(), v: result });
    log(t0, `done status=${result.dataStatus}`);
    return json(200, result);
  } catch (e) {
    log(t0, `pipeline_failed: ${e.message}`);
    try {
      const fb = await runDemoFallback(input, t0);
      // Cache fallback only briefly so a live retry can replace it soon.
      CACHE.set(cacheKey, { t: Date.now() - 55000, v: fb });
      log(t0, 'demo_fallback_ok');
      return json(200, fb);
    } catch (e2) {
      log(t0, `fallback_failed: ${e2.message}`);
      return json(502, { error: 'Unable to generate recommendations right now. Please try again.' });
    }
  }
};

// -------------------- Main pipeline ----------------------------------------

async function runPipeline(input, env, t0) {
  const elapsed  = () => Date.now() - t0;
  // How many ms remain, keeping `reserve` ms in reserve.
  const remaining = (reserve = 0) => Math.max(0, TOTAL_BUDGET_MS - elapsed() - reserve);

  const strategyKey = input.strategy === 'Higher-Growth Opportunities' ? 'growth' : 'long';
  const wantFunds   = input.investmentType !== 'stocks';
  const wantStocks  = input.investmentType !== 'funds';

  const overlapSet = new Set([
    ...(input.considerPortfolio ? input.portfolio.map(h => h.ticker) : []),
    ...(input.considerWatchlist ? input.watchlist.map(h => h.ticker) : []),
  ]);

  // Step 1 – Pre-select small candidate sets using static universe metadata.
  const stockMetas = wantStocks ? preSelectStocks(input, strategyKey, STOCK_LIMIT) : [];
  const fundMetas  = wantFunds  ? preSelectFunds(input, strategyKey, FUND_LIMIT)   : [];
  log(t0, `pre-select stocks:${stockMetas.length} funds:${fundMetas.length}`);

  // Step 2 – Fetch market data: ONE batch request for all tickers.
  const provider = selectProvider(env);
  let batchData  = {};

  if (!provider.isDemo) {
    const allTickers = [...stockMetas, ...fundMetas].map(m => m.ticker);
    // Allocate Alpaca budget; keep CLAUDE_TIMEOUT_MS + 1 s in reserve.
    const alpacaBudget = Math.min(ALPACA_TIMEOUT_MS, remaining(CLAUDE_TIMEOUT_MS + 1000));

    if (allTickers.length > 0 && alpacaBudget > 300) {
      try {
        batchData = await raceTimeout(
          provider.getBatch(allTickers),
          alpacaBudget,
          'alpaca_batch_timeout'
        );
        log(t0, `alpaca_batch symbols:${allTickers.length}`);
      } catch (e) {
        log(t0, `alpaca_err: ${e.message}`);
      }
    }

    // If every ticker came back empty, trigger demo fallback immediately.
    const gotData = Object.values(batchData).some(d => d?.price != null);
    if (!gotData) throw new Error('Alpaca returned no usable market data');
  }
  log(t0, 'market_data_ready');

  // Step 3 – Analyze candidates (synchronous; instant for both demo and live).
  const analyzedStocks = [];
  for (const meta of stockMetas) {
    const data = provider.isDemo ? await provider.getStock(meta.ticker) : batchData[meta.ticker];
    if (!data || data.price == null) continue;
    analyzedStocks.push(analyzeStock(meta, data, strategyKey, input, overlapSet));
  }
  const analyzedFunds = [];
  for (const meta of fundMetas) {
    const data = provider.isDemo ? await provider.getFund(meta.ticker) : batchData[meta.ticker];
    if (!data || data.price == null) continue;
    analyzedFunds.push(analyzeFund(meta, data, input, overlapSet));
  }

  const stockShort = analyzedStocks.sort((a, b) => b.score - a.score);
  const fundShort  = analyzedFunds.sort((a, b) => b.score - a.score);

  const usedStatic = fundShort.some(f => f._staticUsed);
  const { dataStatus, feedType } = deriveStatus(provider, usedStatic, wantFunds);
  const dataTimestamp = (stockShort[0] || fundShort[0])?._asOf || new Date().toISOString();
  const limitations   = collectLimitations(provider, stockShort, fundShort, input);
  log(t0, `scored stocks:${stockShort.length} funds:${fundShort.length}`);

  // Step 4 – Optional Claude enrichment within remaining time budget.
  const claudeBudget = Math.min(CLAUDE_TIMEOUT_MS, remaining(500));
  const useClaude    = !provider.isDemo && !!env.ANTHROPIC_API_KEY && claudeBudget > 500;

  let funds, stocks, marketContextSummary, allocationConsiderations;

  if (useClaude) {
    try {
      const ai = await raceTimeout(
        callClaudeStage(env, input, fundShort, stockShort,
          { dataStatus, feedType, dataTimestamp, provider: provider.name }),
        claudeBudget,
        'claude_timeout'
      );
      funds                   = mergeAi(ai?.funds,  fundShort,  'fund');
      stocks                  = mergeAi(ai?.stocks, stockShort, 'stock');
      marketContextSummary    = clip(ai?.marketContextSummary)     || deterministicContext(input, provider, dataStatus);
      allocationConsiderations = clip(ai?.allocationConsiderations) || deterministicAllocation(input, overlapSet);
      if (Array.isArray(ai?.limitations)) {
        for (const l of ai.limitations) if (typeof l === 'string') limitations.push(clip(l, 200));
      }
      log(t0, 'claude_ok');
    } catch (e) {
      log(t0, `claude_skip: ${e.message}`);
      limitations.push('AI enrichment was unavailable; deterministic analysis shown.');
      funds                   = fundShort.map(toRecDeterministic);
      stocks                  = stockShort.map(toRecDeterministic);
      marketContextSummary    = deterministicContext(input, provider, dataStatus);
      allocationConsiderations = deterministicAllocation(input, overlapSet);
    }
  } else {
    funds                   = fundShort.map(toRecDeterministic);
    stocks                  = stockShort.map(toRecDeterministic);
    marketContextSummary    = deterministicContext(input, provider, dataStatus);
    allocationConsiderations = deterministicAllocation(input, overlapSet);
  }

  log(t0, 'pipeline_complete');
  return {
    requestId: cryptoId(),
    strategy: input.strategy,
    timeHorizon: input.holdingPeriod || (strategyKey === 'growth' ? '6–18 months' : '3+ years'),
    riskTolerance: input.riskTolerance,
    dataStatus,
    dataProvider: provider.name,
    feedType,
    dataTimestamp,
    marketContextSummary,
    funds:  wantFunds  ? funds  : [],
    stocks: wantStocks ? stocks : [],
    allocationConsiderations,
    limitations: [...new Set(limitations)].slice(0, 8),
    disclaimer: DISCLAIMER,
  };
}

async function runDemoFallback(input, t0) {
  const demoEnv = { ...process.env, MARKET_DATA_PROVIDER: 'demo' };
  const fb = await runPipeline(input, demoEnv, t0 || Date.now());
  fb.dataStatus  = 'Demo Data';
  fb.feedType    = 'Demo';
  fb.limitations = [...new Set([...(fb.limitations || []),
    'Live data was unavailable. These results use Demo Data.'])];
  return fb;
}

// -------------------- Pre-selection ----------------------------------------

function preSelectStocks(input, strategyKey, n) {
  let cands = STOCK_UNIVERSE.filter(s => s.strategies.includes(strategyKey));
  if (input.excludedIndustries.length) {
    cands = cands.filter(s => !input.excludedIndustries.includes(s.industry));
  }
  const preferred = input.preferredIndustries;
  cands.sort((a, b) => {
    const ap = preferred.includes(a.industry) ? 0 : 1;
    const bp = preferred.includes(b.industry) ? 0 : 1;
    return ap !== bp ? ap - bp : a.rank - b.rank;
  });
  return cands.slice(0, n);
}

function preSelectFunds(input, strategyKey, n) {
  let cands = FUND_UNIVERSE.filter(f => f.strategies.includes(strategyKey) && !f.leveraged && !f.inverse);
  if (input.excludedIndustries.length) {
    cands = cands.filter(f => !f.industry || !input.excludedIndustries.includes(f.industry));
  }
  const preferred = input.preferredIndustries;
  cands.sort((a, b) => {
    const ap = preferred.length && a.industry && preferred.includes(a.industry) ? 0 : 1;
    const bp = preferred.length && b.industry && preferred.includes(b.industry) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    if (a.broad !== b.broad) return a.broad ? -1 : 1;
    return 0;
  });
  return cands.slice(0, n);
}

// -------------------- Analysis ---------------------------------------------

function analyzeStock(meta, data, strategyKey, input, overlapSet) {
  const emaVal  = ema(data.weeklyCloses, 200);
  const emaDist = distanceFromEma(data.price, emaVal);
  const metrics = {
    price: data.price,
    marketCap: data.marketCap,
    rank: meta.rank,
    weeklyChange: pctChange(data.price, data.prevClose),
    relVolume: relativeVolume(data.volume, data.avgVolume),
    avgVolume: data.avgVolume,
    cashFlow: data.cashFlow,
    cashFlowTrend: data.cashFlowTrend,
    earningsTrend: data.earningsTrend,
    revenueTrend: data.revenueTrend,
    debtToEquity: debtToEquity(data.debt, data.equity),
    emaDistance: emaDist,
    ema200w: emaVal,
  };
  const ctx = {
    risk: input.riskTolerance,
    favoredIndustry: input.preferredIndustries.includes(meta.industry),
    portfolioOverlap: overlapSet.has(meta.ticker),
  };
  const sr = strategyKey === 'growth' ? scoreGrowth(metrics, ctx) : scoreLongTerm(metrics, ctx);
  return {
    kind: 'stock', ticker: meta.ticker, name: meta.name, industry: meta.industry, _strategy: strategyKey,
    metrics, ...sr, _overlap: overlapSet.has(meta.ticker), _asOf: data.asOf, _feed: data.feedType,
    distanceStr: emaDist == null
      ? 'Unavailable (insufficient history)'
      : `${emaDist >= 0 ? '+' : ''}${emaDist.toFixed(1)}% vs 200-wk EMA`,
  };
}

function analyzeFund(meta, data, input, overlapSet) {
  const wChange = pctChange(data.price, data.prevClose);
  const relVol  = relativeVolume(data.volume, data.avgVolume);
  let score = 60;
  if (meta.broad) score += 12;
  if (input.preferredIndustries.includes(meta.industry)) score += 10;
  if (relVol != null && relVol > 1) score += 6;
  if (wChange != null) score += Math.max(-6, Math.min(6, wChange));
  if (overlapSet.has(meta.ticker)) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    kind: 'fund', ticker: meta.ticker, name: meta.name, category: meta.category,
    metrics: { price: data.price, weeklyChange: wChange, relVolume: relVol,
               expenseRatio: data.expenseRatio, aum: data.aum },
    score, disqualifiers: [], missing: [],
    dataCompleteness: data.expenseRatio ? 'Medium' : 'Low',
    confidence: meta.broad ? 'High' : 'Medium',
    _overlap: overlapSet.has(meta.ticker), _asOf: data.asOf, _feed: data.feedType,
    _staticUsed: !!data.staticAsOf, _staticAsOf: data.staticAsOf,
  };
}

// -------------------- Deterministic rendering --------------------------------

function toRecDeterministic(a) { return a.kind === 'fund' ? fundRec(a) : stockRec(a); }

function fundRec(a) {
  const m  = a.metrics;
  const km = [{ label: 'Last Price', value: money(m.price), asOf: shortDate(a._asOf), source: a._feed }];
  if (m.expenseRatio) km.push({ label: 'Expense Ratio', value: m.expenseRatio, asOf: a._staticAsOf || 'static', source: 'Static reference' });
  if (m.aum)          km.push({ label: 'AUM', value: m.aum, asOf: a._staticAsOf || 'static', source: 'Static reference' });
  if (m.weeklyChange != null) km.push({ label: 'Wk Change', value: `${m.weeklyChange >= 0 ? '+' : ''}${m.weeklyChange.toFixed(1)}%`, asOf: shortDate(a._asOf), source: a._feed });
  return {
    ticker: a.ticker, name: a.name, category: a.category, score: a.score,
    reasoning: `${a.name} provides ${a.category.toLowerCase()} exposure, supporting diversification within a ${a._feed === 'Demo' ? 'sample' : 'current'} allocation.`,
    whyNow: 'Diversified funds are intended for steady, long-horizon accumulation rather than precise timing.',
    keyRisks: ['Broad market drawdowns affect index funds', 'Sector funds carry concentration risk', 'Returns are not guaranteed'],
    riskLevel: a.category === 'Bonds' ? 'Low' : 'Medium',
    portfolioOverlap: a._overlap ? 'Already in your portfolio/watchlist — consider concentration.' : 'No overlap detected with your saved holdings.',
    confidence: a.confidence, dataCompleteness: a.dataCompleteness, keyMetrics: km,
  };
}

function stockRec(a) {
  const m     = a.metrics;
  const km    = [{ label: 'Price', value: money(m.price), asOf: shortDate(a._asOf), source: a._feed }];
  if (m.marketCap != null)    km.push({ label: 'Market Cap', value: bigMoney(m.marketCap), asOf: shortDate(a._asOf), source: a._feed });
  if (m.weeklyChange != null) km.push({ label: 'Wk Change', value: `${m.weeklyChange >= 0 ? '+' : ''}${m.weeklyChange.toFixed(1)}%`, asOf: shortDate(a._asOf), source: a._feed });
  if (m.relVolume != null)    km.push({ label: 'Rel. Volume', value: `${m.relVolume.toFixed(2)}x`, asOf: shortDate(a._asOf), source: a._feed });
  if (m.debtToEquity != null) km.push({ label: 'Debt/Equity', value: m.debtToEquity.toFixed(2), asOf: shortDate(a._asOf), source: a._feed === 'Demo' ? 'Demo' : 'Reported' });
  if (m.ema200w != null)      km.push({ label: '200-wk EMA', value: money(m.ema200w), asOf: 'calculated', source: 'Server calc' });
  const risks = [...a.disqualifiers];
  if (Math.abs(m.emaDistance ?? 0) > 10) risks.push('Price is extended from the 200-week EMA');
  if (a.industry === 'Semiconductors' || a.industry === 'Technology') risks.push('Higher volatility typical of the sector');
  risks.push('No outcome is guaranteed');
  return {
    ticker: a.ticker, name: a.name, industry: a.industry, score: a.score,
    reasoning: deterministicStockReasoning(a),
    whyNow: m.emaDistance != null && Math.abs(m.emaDistance) <= 10
      ? `Trading ${a.distanceStr.toLowerCase()}, within the framework's preferred valuation zone while fundamentals look ${a.disqualifiers.length ? 'mixed' : 'solid'}.`
      : 'Included as a qualified candidate; current technical positioning is less ideal for this specific framework.',
    keyRisks: [...new Set(risks)].slice(0, 5),
    riskLevel: stockRiskLevel(a),
    portfolioOverlap: a._overlap ? 'Already in your portfolio/watchlist — mind concentration.' : 'No overlap detected with your saved holdings.',
    confidence: a.confidence, dataCompleteness: a.dataCompleteness,
    distanceFrom200WeekEma: a.distanceStr, keyMetrics: km,
  };
}

function stockRiskLevel(a) {
  const dist     = Math.abs(a.metrics.emaDistance ?? 0);
  const volatile = a.industry === 'Semiconductors' || a.industry === 'Technology';
  if (a._strategy === 'growth') {
    if (dist > 15 || volatile || a.disqualifiers.length) return 'High';
    return 'Medium';
  }
  if (a.disqualifiers.length || dist > 15) return 'High';
  if (a.score >= 82 && dist <= 10) return 'Low';
  return 'Medium';
}

function deterministicStockReasoning(a) {
  const m = a.metrics;
  const parts = [`${a.name} ranks #${m.rank} by market cap in ${a.industry}.`];
  if (m.cashFlow)     parts.push(`Cash flow is ${m.cashFlow}${m.cashFlowTrend ? ` and ${m.cashFlowTrend}` : ''}.`);
  if (m.earningsTrend) parts.push(`Earnings are ${m.earningsTrend}.`);
  if (m.debtToEquity != null) parts.push(`Debt-to-equity is ${m.debtToEquity.toFixed(2)}.`);
  if (m.ema200w != null)      parts.push(`It trades ${a.distanceStr}.`);
  if (a.disqualifiers.length) parts.push(`Caution: ${a.disqualifiers.join('; ')}.`);
  return parts.join(' ');
}

// -------------------- Claude stage ------------------------------------------

async function callClaudeStage(env, input, fundShort, stockShort, status) {
  const compact = {
    status,
    funds: fundShort.map(f => ({
      ticker: f.ticker, name: f.name, category: f.category, score: f.score,
      overlap: f._overlap, expenseRatio: f.metrics.expenseRatio,
      weeklyChangePct: round1(f.metrics.weeklyChange),
    })),
    stocks: stockShort.map(s => ({
      ticker: s.ticker, name: s.name, industry: s.industry, rank: s.metrics.rank,
      score: s.score, weeklyChangePct: round1(s.metrics.weeklyChange),
      relVolume: round2(s.metrics.relVolume), marketCap: s.metrics.marketCap,
      debtToEquity: round2(s.metrics.debtToEquity), cashFlow: s.metrics.cashFlow,
      earningsTrend: s.metrics.earningsTrend,
      ema200wDistancePct: round1(s.metrics.emaDistance),
      disqualifiers: s.disqualifiers, overlap: s._overlap,
    })),
    userPortfolio: input.considerPortfolio ? input.portfolio.map(h => h.ticker) : [],
    userWatchlist: input.considerWatchlist ? input.watchlist.map(h => h.ticker) : [],
  };
  const system      = buildSystemPrompt(input);
  const userContent = [
    'Rank and explain ONLY these pre-qualified finalists. Do not add or invent any others.',
    'Use the supplied deterministic scores and metrics; do not invent numbers.',
    `Return at most ${input.investmentType === 'stocks' ? 0 : 3} funds and ${input.investmentType === 'funds' ? 0 : 5} stocks.`,
    'FINALISTS_JSON:', JSON.stringify(compact),
  ].join('\n');
  return getClaudeRecommendations(env, system, userContent);
}

function mergeAi(aiArr, shortlist, kind) {
  const byTicker = new Map(shortlist.map(s => [s.ticker, s]));
  const out = [];
  if (Array.isArray(aiArr)) {
    for (const r of aiArr) {
      const base = byTicker.get((r?.ticker || '').toUpperCase());
      if (!base) continue; // drop hallucinated tickers
      const det = toRecDeterministic(base);
      out.push({
        ...det,
        reasoning: clip(r.reasoning) || det.reasoning,
        whyNow:    clip(r.whyNow)    || det.whyNow,
        keyRisks:  Array.isArray(r.keyRisks) && r.keyRisks.length ? r.keyRisks.map(x => clip(x, 160)).slice(0, 5) : det.keyRisks,
        riskLevel: ['Low', 'Medium', 'High'].includes(r.riskLevel) ? r.riskLevel : det.riskLevel,
        portfolioOverlap: clip(r.portfolioOverlap) || det.portfolioOverlap,
        score: det.score, // deterministic score is authoritative
        keyMetrics: det.keyMetrics,
      });
      byTicker.delete(base.ticker);
    }
  }
  for (const base of byTicker.values()) out.push(toRecDeterministic(base));
  return out.slice(0, kind === 'fund' ? 3 : 5);
}

// -------------------- Status + limitations ----------------------------------

function deriveStatus(provider, usedStatic, wantFunds) {
  if (provider.isDemo) return { dataStatus: 'Demo Data', feedType: 'Demo' };
  const feed = provider.feedType;
  if (wantFunds && usedStatic) return { dataStatus: 'Mixed Data', feedType: 'Mixed' };
  if (feed === 'Real-Time') return { dataStatus: 'Live Data', feedType: 'Real-Time' };
  return { dataStatus: 'Delayed Data', feedType: 'Delayed' };
}

function collectLimitations(provider, stocks, funds, input) {
  const lims = [];
  if (provider.isDemo) {
    lims.push(provider.fallbackReason
      ? `${provider.fallbackReason}; showing clearly-labelled Demo Data.`
      : 'Demo Data mode: prices and recommendations are illustrative examples, not current market data.');
  }
  if (stocks.some(s => s.metrics.ema200w == null)) lims.push('Some stocks lacked enough history for a 200-week EMA.');
  if (!provider.isDemo && stocks.some(s => s.metrics.cashFlow == null)) {
    lims.push('Fundamental data (cash flow/earnings) was not supplied by the selected provider; those factors were marked unavailable, lowering confidence.');
  }
  if (funds.some(f => f._staticUsed)) lims.push('Fund expense ratio / AUM are static reference values with an as-of label, not live figures.');
  if (input.investmentAmount == null) lims.push('No investment amount was provided, so affordability was not factored.');
  return lims;
}

function deterministicContext(input, provider, status) {
  const horizon = input.strategy === 'Higher-Growth Opportunities' ? '6–18 month' : 'multi-year';
  return `${status} review for a ${horizon} ${input.strategy} approach (${input.riskTolerance} risk). ` +
    `Candidates were screened on liquidity, quality, and ${input.strategy === 'Long-Term Wealth Building' ? 'proximity to the 200-week EMA' : 'momentum and growth'} before ranking. ` +
    `Data provider: ${provider.name}.`;
}
function deterministicAllocation(input, overlapSet) {
  const base = input.strategy === 'Long-Term Wealth Building'
    ? 'Consider anchoring with one or two broad index funds and adding individual leaders selectively. Avoid over-concentration in a single industry.'
    : 'Higher-growth names carry larger drawdowns; size positions accordingly and keep diversified ballast.';
  return overlapSet.size ? `${base} Note: some candidates overlap your existing holdings — review concentration before adding.` : base;
}

// -------------------- Utility -----------------------------------------------

function raceTimeout(promise, ms, tag) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(tag || `timeout_${ms}ms`)), ms)),
  ]);
}

function clip(s, n = 700) { return typeof s === 'string' ? s.trim().slice(0, n) : ''; }
function round1(n) { return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null; }
function round2(n) { return typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null; }
function money(n) { return typeof n === 'number' ? `$${n.toFixed(2)}` : '—'; }
function bigMoney(n) {
  if (typeof n !== 'number') return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n}`;
}
function shortDate(iso) { if (!iso) return ''; const s = String(iso); return s.length >= 10 ? s.slice(0, 10) : s; }
function cryptoId()     { return 'req_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function log(t0, msg)   { try { console.log(`[market-reco] +${Date.now() - t0}ms ${msg}`); } catch {} }

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) };
}
