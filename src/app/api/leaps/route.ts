import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL_ID } from '@/lib/ai/client'
import { buildLeapsPrompt } from '@/lib/ai/prompts'
import {
  safeParseJson,
  validateLeapsAiResponse,
} from '@/lib/ai/leaps-response'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_BODY_BYTES,
  resolveStockScore,
  validateLeapsRequest,
} from '@/lib/validation'
import type { RecommendedContract } from '@/types'

const DISCLAIMER =
  'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice. Options trading involves substantial risk of loss.'

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

    const parsed = validateLeapsRequest(raw)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { ticker, company_name, contracts } = parsed.value

    // The stock-quality score must come from a real stored screener analysis
    // belonging to this user. The route never accepts a client-supplied score
    // and never fabricates a fallback.
    const { data: analysis } = await supabase
      .from('stock_analyses')
      .select('score')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const stockScore = resolveStockScore(analysis)
    if (stockScore === null) {
      return NextResponse.json(
        {
          error: 'analysis_required',
          message: `No screener analysis found for ${ticker}. Score the company in the screener first — LEAPS ranking requires a real stored analysis.`,
        },
        { status: 409 }
      )
    }

    const prompt = buildLeapsPrompt(ticker, company_name, stockScore, contracts)

    const message = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
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
    const validated = validateLeapsAiResponse(aiJson, contracts.length)
    if (!validated.ok) {
      console.error('LEAPS AI response rejected:', validated.errors)
      return NextResponse.json(
        {
          error: 'ai_response_invalid',
          message: 'The AI ranking failed validation. Please try again.',
          details: validated.errors,
        },
        { status: 502 }
      )
    }

    // contract_index values are guaranteed in-range and unique by the
    // validator, so this mapping cannot produce undefined contracts.
    const recommendations: RecommendedContract[] = validated.value.recommendations.map(
      (rec) => ({
        rank: rec.rank as 1 | 2 | 3,
        is_front_runner: rec.is_front_runner,
        contract: contracts[rec.contract_index - 1],
        ai_reasoning: rec.ai_reasoning,
        risk_level: rec.risk_level,
        affordability: rec.affordability,
        score: rec.score,
      })
    )

    const leapsData = {
      user_id: user.id,
      ticker,
      company_name,
      stock_score: stockScore,
      recommendations,
      front_runner_explanation: validated.value.front_runner_explanation,
      disclaimer: DISCLAIMER,
    }

    const { data: saved, error } = await supabase
      .from('leaps_recommendations')
      .insert(leapsData)
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({
        ...leapsData,
        id: 'temp',
        generated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json(saved)
  } catch (error) {
    console.error('LEAPS API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
