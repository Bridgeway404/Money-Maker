export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import Card from '@/components/ui/Card'
import Badge, { ScoreBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { TrendingUp, ArrowRight, Plus } from 'lucide-react'
import { MOCK_COMPANIES } from '@/lib/utils/mock-data'
import { formatDate } from '@/lib/utils/formatting'

export default async function LeapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: recommendations } = await supabase
    .from('leaps_recommendations')
    .select('*')
    .eq('user_id', user.id)
    .order('generated_at', { ascending: false })

  return (
    <div className="space-y-6">
      <Header
        title="LEAPS Ideas"
        description="AI-generated LEAPS call option recommendations for qualified companies."
        actions={
          <Link href="/screener">
            <Button size="sm">
              <Plus className="h-4 w-4" /> New Analysis
            </Button>
          </Link>
        }
      />

      {/* Quick access to mock companies */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
          Sample Data — Get LEAPS ideas for:
        </p>
        <div className="flex flex-wrap gap-2">
          {MOCK_COMPANIES.map((c) => (
            <Link
              key={c.ticker}
              href={`/leaps/${c.ticker}`}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm text-zinc-300 font-mono transition-colors"
            >
              {c.ticker}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent recommendations */}
      {recommendations && recommendations.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Your Recommendations</h2>
          {recommendations.map((rec) => (
            <Card key={rec.id} className="hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-100">{rec.ticker}</span>
                      <span className="text-zinc-400">{rec.company_name}</span>
                      <ScoreBadge score={rec.stock_score} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{formatDate(rec.generated_at)}</p>
                    <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                      {rec.front_runner_explanation?.slice(0, 150) || 'AI-generated LEAPS recommendations'}
                    </p>
                  </div>
                </div>
                <Link href={`/leaps/${rec.ticker}`} className="shrink-0 text-emerald-400 hover:text-emerald-300">
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <TrendingUp className="h-10 w-10 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 font-medium">No LEAPS recommendations yet</p>
          <p className="text-zinc-600 text-sm mt-1 mb-6">
            Click a ticker above or score a company in the screener to generate recommendations.
          </p>
        </Card>
      )}
    </div>
  )
}
