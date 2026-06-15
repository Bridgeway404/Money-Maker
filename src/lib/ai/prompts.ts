import type { StockMetrics, OptionContract, RecommendedContract } from '@/types'

export const DISCLAIMER =
  'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice. Options trading involves substantial risk of loss. Always consult a licensed financial advisor before making investment decisions.'

export function buildResearchPrompt(
  ticker: string,
  companyName: string,
  industry: string,
  metrics?: Partial<StockMetrics>
): string {
  const metricsSection = metrics
    ? `
Known metrics provided by the user:
- Industry: ${metrics.industry ?? industry}
- Market Cap Rank: ${metrics.market_cap_rank ?? 'Unknown'}
- Cash Flow: ${metrics.cash_flow ?? 'Unknown'}
- Earnings Trend: ${metrics.earnings_trend ?? 'Unknown'}
- Debt-to-Equity Level: ${metrics.debt_to_equity ?? 'Unknown'}
- Current Stock Price: ${metrics.current_price ? `$${metrics.current_price}` : 'Unknown'}
- 200-week EMA: ${metrics.ema_200_week ? `$${metrics.ema_200_week}` : 'Unknown'}
- Distance from 200-week EMA: ${metrics.ema_distance_pct !== undefined ? `${metrics.ema_distance_pct.toFixed(2)}%` : 'Unknown'}
`
    : ''

  return `You are a seasoned Wall Street analyst with 20 years of experience specializing in identifying undervalued industry leaders for LEAPS options strategies. You write research reports with the clarity of a trusted advisor — direct, insightful, and never sugarcoating risk.

Generate a comprehensive research report for ${ticker} (${companyName}), a company in the ${industry} sector.
${metricsSection}
Your report must include the following sections. Write each section thoroughly — this is a real research report for experienced investors who want substance, not marketing language.

Structure your response as a JSON object with these exact keys:
{
  "score": <integer 0-100>,
  "overview": "<2-3 paragraphs: company background, core business model, revenue drivers, competitive positioning>",
  "industry_position": "<2-3 paragraphs: where they rank in their industry, market share, key competitors, moat assessment>",
  "cash_flow_analysis": "<2-3 paragraphs: free cash flow trends, capital allocation, cash generation quality, ability to fund operations and buybacks>",
  "earnings_analysis": "<2-3 paragraphs: EPS trajectory, margins, earnings quality, guidance history, beats/misses pattern>",
  "debt_analysis": "<2 paragraphs: debt-to-equity, interest coverage, balance sheet health, how leverage compares to peers>",
  "technical_analysis": "<2-3 paragraphs: current price relative to 200-week EMA, historical support/resistance, trend direction, why technical setup matters for LEAPS timing>",
  "news_summary": "<2 paragraphs: recent earnings call highlights, key news events, analyst sentiment shifts, macro tailwinds/headwinds>",
  "bull_case": "<3-4 bullet points as a string, each point starting with '• '>",
  "bear_case": "<3-4 bullet points as a string, each point starting with '• '>",
  "risks": "<2-3 paragraphs: key risks investors must understand — regulatory, competitive, macro, company-specific>",
  "conclusion": "<2 paragraphs: overall assessment, LEAPS suitability, what score means for this stock>",
  "disclaimer": "${DISCLAIMER}"
}

Scoring criteria (total 100 points):
- Industry Leadership (top 2-3 in sector): 25 points
- Cash Flow Strength: 20 points
- Earnings Quality/Growth: 20 points
- Debt-to-Equity (low is better): 10 points
- Distance from 200-week EMA (within 5-10% is ideal): 15 points
- Option Affordability: 5 points
- Option Expiration Quality: 5 points

Automatic disqualifiers (score = 0): negative cash flow, consistently declining earnings, not an industry leader.

Score 90+ means exceptional LEAPS opportunity. 75-89 is solid. Below 60 is questionable.

Respond ONLY with valid JSON. No markdown, no code blocks, just the JSON object.`
}

export function buildScoringPrompt(metrics: StockMetrics, weights?: Record<string, number>): string {
  const w = weights ?? {
    industry_leadership: 25,
    cash_flow: 20,
    earnings_quality: 20,
    debt_to_equity: 10,
    ema_distance: 15,
    option_affordability: 5,
    option_expiration: 5,
  }

  return `You are a quantitative analyst scoring a stock for LEAPS option suitability. Score this company based on the provided metrics.

Company: ${metrics.ticker} (${metrics.company_name})
Industry: ${metrics.industry}
Market Cap Rank: ${metrics.market_cap_rank}
Cash Flow: ${metrics.cash_flow}
Earnings Trend: ${metrics.earnings_trend}
Debt-to-Equity Level: ${metrics.debt_to_equity}
Current Price: $${metrics.current_price}
200-week EMA: $${metrics.ema_200_week}
Distance from EMA: ${metrics.ema_distance_pct.toFixed(2)}%

Scoring weights (max points each):
- Industry Leadership: ${w.industry_leadership} pts (full points if top 2-3 in sector; 0 if outside top 3)
- Cash Flow: ${w.cash_flow} pts (Strong=full, Positive=half, Negative=0 and DISQUALIFIED)
- Earnings Quality: ${w.earnings_quality} pts (Growing=full, Stable=half, Declining=0 and DISQUALIFIED)
- Debt-to-Equity: ${w.debt_to_equity} pts (Low=full, Moderate=half, High=minimum)
- EMA Distance: ${w.ema_distance} pts (within 5-10% above/below=full; 10-20%=half; outside=minimum; ideal is slightly below EMA)
- Option Affordability: ${w.option_affordability} pts (assess based on current price and typical options premiums)
- Option Expiration: ${w.option_expiration} pts (default full since user will pick 12+ month contracts)

DISQUALIFIERS: If cash flow is Negative OR earnings trend is Declining OR market cap rank is 'Other', the score is 0 and disqualified is true.

Respond with valid JSON only:
{
  "total": <integer 0-100>,
  "breakdown": {
    "industry_leadership": <integer>,
    "cash_flow": <integer>,
    "earnings_quality": <integer>,
    "debt_to_equity": <integer>,
    "ema_distance": <integer>,
    "option_affordability": <integer>,
    "option_expiration": <integer>
  },
  "disqualified": <boolean>,
  "disqualifier_reason": <string or null>,
  "ai_reasoning": "<2-3 sentences explaining the score and key factors>"
}`
}

export function buildLeapsPrompt(
  ticker: string,
  companyName: string,
  stockScore: number,
  contracts: OptionContract[]
): string {
  const contractsJson = contracts.map((c, i) => ({
    index: i + 1,
    id: c.id,
    expiration: c.expiration_date,
    strike: c.strike_price,
    premium: c.current_premium,
    ath_premium: c.all_time_high_premium,
    depreciation_pct: c.depreciation_pct,
    iv: c.implied_volatility,
    delta: c.delta,
    theta: c.theta,
    volume: c.volume,
    open_interest: c.open_interest,
  }))

  return `You are a seasoned options strategist with 20 years of experience. Analyze these LEAPS call options for ${ticker} (${companyName}) and provide ranked recommendations.

Stock Quality Score: ${stockScore}/100

Option Contracts to Analyze:
${JSON.stringify(contractsJson, null, 2)}

Evaluation criteria (ranked by importance):
1. Expiration: 12+ months is required; longer is better for LEAPS
2. Depreciation from ATH: ~40% drop from all-time high premium = ideal entry (contract is "on sale")
3. Strike price proximity to ITM: closer to in-the-money = higher leverage and conviction
4. Delta: 0.40-0.60 is ideal for LEAPS (not too far OTM)
5. Volume and Open Interest: higher = better liquidity
6. IV: not too elevated (avoid buying expensive premiums)
7. Affordability: premium * 100 = total cost per contract

Rank all contracts from best to worst LEAPS opportunity. Identify the single front-runner.

Respond with valid JSON only:
{
  "recommendations": [
    {
      "rank": 1,
      "is_front_runner": true,
      "contract_index": <1-based index from the list above>,
      "ai_reasoning": "<3-4 sentences explaining why this ranks here, what makes it compelling or concerning>",
      "risk_level": "<Low|Medium|High>",
      "affordability": "<Affordable|Moderate|Expensive>",
      "score": <integer 1-100>
    }
  ],
  "front_runner_explanation": "<3-4 paragraphs explaining the front-runner in depth: why it's the best choice, what the trade looks like, what would need to be true for it to work, and what would cause it to fail. Write like a seasoned investor explaining to a peer.>"
}

Include ALL ${contracts.length} contracts in the recommendations array, ranked 1 through ${contracts.length}.
Disclaimer: "${DISCLAIMER}"`
}

export function buildChatPrompt(
  contextTicker: string | null,
  contextReport: string | null
): string {
  const contextSection = contextTicker
    ? `
Current research context: You are discussing ${contextTicker}.
${contextReport ? `Research summary:\n${contextReport.slice(0, 2000)}` : ''}
`
    : ''

  return `You are a seasoned Wall Street analyst and options strategist with 20 years of experience. You speak directly and substantively — no hedging with vague disclaimers on every sentence, but you are honest about uncertainty and risk. You treat the user as a fellow experienced investor.
${contextSection}
Answer their questions thoroughly. When discussing specific numbers, be clear they are estimates or publicly known data, not real-time quotes. If the question is about a trade, explain the logic and risks clearly. End any trade-specific advice with a brief reminder that this is research, not a trade recommendation.

Keep responses focused and substantive. Avoid generic platitudes.`
}
