import { NextRequest, NextResponse } from 'next/server'
import { calculateScore, calculateEmaDistance } from '@/lib/scoring'
import { createClient } from '@/lib/supabase/server'
import type { ScoreRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ScoreRequest = await request.json()
    const { metrics, weights } = body

    if (!metrics) {
      return NextResponse.json({ error: 'Missing metrics' }, { status: 400 })
    }

    // Auto-calculate EMA distance if not provided
    if (metrics.current_price && metrics.ema_200_week && !metrics.ema_distance_pct) {
      metrics.ema_distance_pct = calculateEmaDistance(metrics.current_price, metrics.ema_200_week)
    }

    // Get user's custom weights if not provided
    let finalWeights = weights
    if (!finalWeights) {
      const { data: config } = await supabase
        .from('scoring_config')
        .select('weights')
        .eq('user_id', user.id)
        .single()

      if (config?.weights) {
        finalWeights = config.weights
      }
    }

    const score = calculateScore(metrics, finalWeights)

    // Save analysis to DB
    await supabase.from('stock_analyses').upsert({
      user_id: user.id,
      ticker: metrics.ticker.toUpperCase(),
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
