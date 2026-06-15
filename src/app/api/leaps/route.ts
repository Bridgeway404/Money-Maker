import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL_ID } from '@/lib/ai/client'
import { buildLeapsPrompt } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import type { LeapsRequest, RecommendedContract } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: LeapsRequest = await request.json()
    const { ticker, company_name, stock_score, contracts } = body

    if (!ticker || !contracts || contracts.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prompt = buildLeapsPrompt(ticker.toUpperCase(), company_name, stock_score, contracts)

    const message = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    let parsed: { recommendations: Array<{
      rank: number
      is_front_runner: boolean
      contract_index: number
      ai_reasoning: string
      risk_level: string
      affordability: string
      score: number
    }>, front_runner_explanation: string }

    try {
      const text = content.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    // Map AI output to our contract objects
    const recommendations: RecommendedContract[] = parsed.recommendations.map((rec) => ({
      rank: rec.rank as 1 | 2 | 3,
      is_front_runner: rec.is_front_runner,
      contract: contracts[rec.contract_index - 1],
      ai_reasoning: rec.ai_reasoning,
      risk_level: rec.risk_level as 'Low' | 'Medium' | 'High',
      affordability: rec.affordability as 'Affordable' | 'Moderate' | 'Expensive',
      score: rec.score,
    }))

    const DISCLAIMER =
      'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice. Options trading involves substantial risk of loss.'

    const leapsData = {
      user_id: user.id,
      ticker: ticker.toUpperCase(),
      company_name,
      stock_score,
      recommendations,
      front_runner_explanation: parsed.front_runner_explanation,
      disclaimer: DISCLAIMER,
    }

    const { data: saved, error } = await supabase
      .from('leaps_recommendations')
      .insert(leapsData)
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ ...leapsData, id: 'temp', generated_at: new Date().toISOString() })
    }

    return NextResponse.json(saved)
  } catch (error) {
    console.error('LEAPS API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
