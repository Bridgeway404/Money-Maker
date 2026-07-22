// Self-contained request + response validation (no external dependency, so
// the function bundles and runs even with a bare npm install). Treats all
// user-supplied text as data and enforces hard limits.

import { VALID_INDUSTRIES } from './universe.mjs';

const STRATEGIES = ['Higher-Growth Opportunities', 'Long-Term Wealth Building'];
const RISKS = ['Conservative', 'Moderate', 'Aggressive'];
const INVEST_TYPES = ['funds', 'stocks', 'both'];
const DATA_STATUS = ['Demo Data', 'Live Data', 'Delayed Data', 'Indicative Data', 'Mixed Data', 'Data Unavailable'];
const FEED_TYPES = ['Real-Time', 'Delayed', 'Indicative', 'Demo', 'Mixed', 'Unavailable'];
const RISK_LEVELS = ['Low', 'Medium', 'High'];
const CONF = ['Low', 'Medium', 'High'];

const MAX_BODY_BYTES = 24 * 1024;
const MAX_INDUSTRIES = 12;
const MAX_LIST = 60;
const MAX_NOTE = 280;

function str(v, max = 120) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}
function cleanIndustries(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(x => str(x, 40)).filter(x => VALID_INDUSTRIES.includes(x)).slice(0, MAX_INDUSTRIES);
}
function cleanHoldings(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_LIST).map(h => ({
    ticker: str(h?.ticker, 6).toUpperCase().replace(/[^A-Z.]/g, ''),
    name: str(h?.name, 60),
    note: str(h?.note, MAX_NOTE),
  })).filter(h => h.ticker);
}

export function validateRequest(raw) {
  if (typeof raw !== 'object' || raw == null) return { ok: false, error: 'Invalid request body.' };
  const byteLen = Buffer.byteLength(JSON.stringify(raw));
  if (byteLen > MAX_BODY_BYTES) return { ok: false, error: 'Request too large.' };

  const strategy = str(raw.strategy, 40);
  if (!STRATEGIES.includes(strategy)) return { ok: false, error: 'A valid strategy must be selected.' };

  let amount = null;
  if (raw.investmentAmount != null && raw.investmentAmount !== '') {
    const n = Number(raw.investmentAmount);
    if (!Number.isFinite(n) || n < 0 || n > 1e11) return { ok: false, error: 'Investment amount is out of range.' };
    amount = Math.round(n);
  }

  const risk = RISKS.includes(str(raw.riskTolerance)) ? str(raw.riskTolerance) : 'Moderate';
  const investmentType = INVEST_TYPES.includes(str(raw.investmentType)) ? str(raw.investmentType) : 'both';

  return {
    ok: true,
    value: {
      strategy,
      investmentAmount: amount,
      riskTolerance: risk,
      preferredIndustries: cleanIndustries(raw.preferredIndustries),
      excludedIndustries: cleanIndustries(raw.excludedIndustries),
      investmentType,
      holdingPeriod: str(raw.holdingPeriod, 40),
      considerPortfolio: raw.considerPortfolio === true,
      considerWatchlist: raw.considerWatchlist === true,
      portfolio: raw.considerPortfolio === true ? cleanHoldings(raw.portfolio) : [],
      watchlist: raw.considerWatchlist === true ? cleanHoldings(raw.watchlist) : [],
    },
  };
}

// ---- Response (Claude / demo output) validation --------------------------
function isStr(v) { return typeof v === 'string'; }
function metricOk(m) {
  return m && isStr(m.label) && isStr(m.value);
}
function recOk(r, extraKey) {
  if (!r || !isStr(r.ticker) || !/^[A-Z.]{1,6}$/.test(r.ticker)) return false;
  if (!isStr(r.name) || !isStr(r.reasoning)) return false;
  if (typeof r.score !== 'number' || r.score < 0 || r.score > 100) return false;
  if (!RISK_LEVELS.includes(r.riskLevel)) return false;
  if (!CONF.includes(r.confidence)) return false;
  if (!CONF.includes(r.dataCompleteness)) return false;
  if (!Array.isArray(r.keyRisks)) return false;
  if (!Array.isArray(r.keyMetrics) || !r.keyMetrics.every(metricOk)) return false;
  if (extraKey && !isStr(r[extraKey])) return false;
  return true;
}

export function validateResponse(obj) {
  const errors = [];
  if (typeof obj !== 'object' || obj == null) return { ok: false, errors: ['not an object'] };
  if (!STRATEGIES.includes(obj.strategy)) errors.push('strategy');
  if (!DATA_STATUS.includes(obj.dataStatus)) errors.push('dataStatus');
  if (!FEED_TYPES.includes(obj.feedType)) errors.push('feedType');
  if (!isStr(obj.disclaimer)) errors.push('disclaimer');
  if (!Array.isArray(obj.funds)) errors.push('funds[]');
  if (!Array.isArray(obj.stocks)) errors.push('stocks[]');
  if (Array.isArray(obj.funds)) {
    if (obj.funds.length > 3) errors.push('too many funds');
    obj.funds.forEach((f, i) => { if (!recOk(f)) errors.push(`fund[${i}]`); });
  }
  if (Array.isArray(obj.stocks)) {
    if (obj.stocks.length > 5) errors.push('too many stocks');
    obj.stocks.forEach((s, i) => { if (!recOk(s, 'distanceFrom200WeekEma')) errors.push(`stock[${i}]`); });
  }
  return { ok: errors.length === 0, errors };
}

export const ENUMS = { STRATEGIES, RISKS, INVEST_TYPES, DATA_STATUS, FEED_TYPES };
