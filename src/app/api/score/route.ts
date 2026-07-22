import { NextRequest, NextResponse } from 'next/server'
import { calculateScore, DEFAULT_WEIGHTS } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/server'
import {
  MAX_BODY_BYTES,
  validateScoreRequest,
  validateWeights,
} from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    // Authentication is enforced here in the route itself — middleware gating
    // is a convenience layer, not the security boundary.
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

    const parsed = validateScoreRequest(raw)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { metrics } = parsed.value

    // Weight resolution: request weights (already validated) > stored config
    // (validated; a malformed stored config falls back to defaults rather
    // than silently producing a mis-scaled score) > defaults.
    let finalWeights = parsed.value.weights
    if (!finalWeights) {
      const { data: config } = await supabase
        .from('scoring_config')
        .select('weights')
        .eq('user_id', user.id)
        .single()
      if (config?.weights) {
        const stored = validateWeights(config.weights)
        finalWeights = stored.ok ? stored.value : DEFAULT_WEIGHTS
      }
    }

    const score = calculateScore(metrics, finalWeights)

    await supabase.from('stock_analyses').upsert({
      user_id: user.id,
      ticker: metrics.ticker,
      company_name: metrics.company_name,
      industry: metrics.industry,
      metrics,
      score,
    })

    return NextResponse.json(score)
  } catch (error) {
    console.error('Score API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
