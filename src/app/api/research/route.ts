import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL_ID } from '@/lib/ai/client'
import { buildResearchPrompt, DISCLAIMER } from '@/lib/ai/prompts'
import { safeParseJson } from '@/lib/ai/leaps-response'
import { calculateScore, calculateEmaDistance } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_BODY_BYTES,
  hasCompleteMetrics,
  validateResearchRequest,
} from '@/lib/validation'

const MAX_SECTION_CHARS = 8_000

function section(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, MAX_SECTION_CHARS) : ''
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawText = await request.text()
    if (rawText.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
    }
    let raw: unknown
    try {
      raw = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const parsed = validateResearchRequest(raw)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { ticker, company_name, industry, metrics } = parsed.value

    const prompt = buildResearchPrompt(ticker, company_name, industry, metrics)

    const message = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (!content || content.type !== 'text') {
      return NextResponse.json(
        { error: 'ai_response_invalid', message: 'The AI returned no text content.' },
        { status: 502 }
      )
    }

    const aiJson = safeParseJson(content.text)
    if (aiJson === null || typeof aiJson !== 'object' || Array.isArray(aiJson)) {
      return NextResponse.json(
        { error: 'ai_response_invalid', message: 'The AI response could not be parsed.' },
        { status: 502 }
      )
    }
    const ai = aiJson as Record<string, unknown>

    // The score is NEVER taken from the AI. When the caller supplied the full
    // metric set, it is computed deterministically (same engine as the
    // screener). Otherwise the report is stored unscored (0) and the UI shows
    // "Unscored" instead of a rating.
    let score = 0
    let score_source: 'deterministic' | 'unscored' = 'unscored'
    if (hasCompleteMetrics(metrics)) {
      const full = {
        ...metrics,
        ticker,
        company_name,
        industry,
        ema_distance_pct:
          metrics.ema_distance_pct ??
          calculateEmaDistance(metrics.current_price, metrics.ema_200_week),
      }
      score = calculateScore(full).total
      score_source = 'deterministic'
    }

    const reportData = {
      user_id: user.id,
      ticker,
      company_name,
      industry,
      score,
      overview: section(ai.overview),
      industry_position: section(ai.industry_position),
      cash_flow_analysis: section(ai.cash_flow_analysis),
      earnings_analysis: section(ai.earnings_analysis),
      debt_analysis: section(ai.debt_analysis),
      technical_analysis: section(ai.technical_analysis),
      // No news provider exists; the prompt no longer requests news and the
      // column is stored empty so stale AI "news" can't read as fact.
      news_summary: '',
      bull_case: section(ai.bull_case),
      bear_case: section(ai.bear_case),
      risks: section(ai.risks),
      conclusion: section(ai.conclusion),
      disclaimer: section(ai.disclaimer) || DISCLAIMER,
    }

    const { data: report, error } = await supabase
      .from('research_reports')
      .insert(reportData)
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      // Return the generated report even if persistence failed.
      return NextResponse.json({
        ...reportData,
        id: 'temp',
        generated_at: new Date().toISOString(),
        score_source,
      })
    }

    return NextResponse.json({ ...report, score_source })
  } catch (error) {
    console.error('Research API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
