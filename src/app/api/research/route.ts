import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL_ID } from '@/lib/ai/client'
import { buildResearchPrompt } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import type { ResearchRequest, ResearchReport } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ResearchRequest = await request.json()
    const { ticker, company_name, industry, metrics } = body

    if (!ticker || !company_name || !industry) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prompt = buildResearchPrompt(ticker.toUpperCase(), company_name, industry, metrics)

    const message = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
    }

    let parsed: Partial<ResearchReport>
    try {
      // Strip markdown code fences if present
      const text = content.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      parsed = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const reportData = {
      user_id: user.id,
      ticker: ticker.toUpperCase(),
      company_name,
      industry,
      score: parsed.score ?? 0,
      overview: parsed.overview ?? '',
      industry_position: parsed.industry_position ?? '',
      cash_flow_analysis: parsed.cash_flow_analysis ?? '',
      earnings_analysis: parsed.earnings_analysis ?? '',
      debt_analysis: parsed.debt_analysis ?? '',
      technical_analysis: parsed.technical_analysis ?? '',
      news_summary: parsed.news_summary ?? '',
      bull_case: parsed.bull_case ?? '',
      bear_case: parsed.bear_case ?? '',
      risks: parsed.risks ?? '',
      conclusion: parsed.conclusion ?? '',
      disclaimer: parsed.disclaimer ?? 'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice.',
    }

    const { data: report, error } = await supabase
      .from('research_reports')
      .insert(reportData)
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      // Return data even if save failed
      return NextResponse.json({ ...reportData, id: 'temp', generated_at: new Date().toISOString() })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Research API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
