import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL_ID } from '@/lib/ai/client'
import { buildResearchPrompt, DISCLAIMER } from '@/lib/ai/prompts'
import { safeParseJson } from '@/lib/ai/leaps-response'
import { validateResearchAiResponse } from '@/lib/ai/research-response'
import { calculateScore, calculateEmaDistance } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_BODY_BYTES,
  hasCompleteMetrics,
  validateResearchRequest,
} from '@/lib/validation'

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

    // Strict validation of the AI narrative. Missing/empty essential
    // sections, wrong types, and any model-supplied score/news/market-claim
    // field are all rejected here — no malformed report is coerced into an
    // apparently-successful blank one, and nothing invalid is persisted.
    const aiJson = safeParseJson(content.text)
    const validated = validateResearchAiResponse(aiJson)
    if (!validated.ok) {
      // Detailed errors are logged server-side only; the client gets a
      // generic message with no validation structure or model output.
      console.error('Research AI response rejected:', validated.errors)
      return NextResponse.json(
        { error: 'ai_response_invalid', message: 'The AI report failed validation. Please try again.' },
        { status: 502 }
      )
    }
    const narrative = validated.value

    // The score is NEVER taken from the AI (the validator rejects any
    // model-supplied score field). When the caller supplied the full metric
    // set, it is computed deterministically (same engine as the screener).
    // Otherwise the report is stored unscored (0) and the UI shows "Unscored".
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
      overview: narrative.overview,
      industry_position: narrative.industry_position,
      cash_flow_analysis: narrative.cash_flow_analysis,
      earnings_analysis: narrative.earnings_analysis,
      debt_analysis: narrative.debt_analysis,
      technical_analysis: narrative.technical_analysis,
      // Server-controlled: no news provider exists, so this stays empty
      // regardless of anything the model returns (the validator also rejects
      // model-supplied news fields outright).
      news_summary: '',
      bull_case: narrative.bull_case,
      bear_case: narrative.bear_case,
      risks: narrative.risks,
      conclusion: narrative.conclusion,
      disclaimer: narrative.disclaimer || DISCLAIMER,
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
