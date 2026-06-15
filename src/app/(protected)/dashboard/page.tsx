export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { WEEKLY_OPPORTUNITIES } from '@/lib/utils/mock-data'
import Card, { CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import Badge, { ScoreBadge } from '@/components/ui/Badge'
import { Search, BookOpen, TrendingUp, ArrowRight, Star, Activity } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load user data
  const [{ data: profile }, { data: onboarding }, { data: watchlist }, { data: recentReports }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('onboarding_answers').select('*').eq('user_id', user.id).single(),
      supabase
        .from('watchlist_items')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false })
        .limit(5),
      supabase
        .from('research_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(5),
    ])

  const displayName = profile?.full_name?.split(' ')[0] ?? user.email?.split('@')[0] ?? 'Investor'

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">
          Good morning, {displayName}
        </h1>
        <p className="text-zinc-400 mt-1">
          Here&apos;s your LEAPS research overview for today.
        </p>
      </div>

      {/* Profile summary + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile summary */}
        {onboarding ? (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Purchasing Power</p>
                <p className="text-sm font-medium text-zinc-200">{onboarding.purchasing_power}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Risk Appetite</p>
                <Badge
                  variant={
                    onboarding.risk_appetite === 'Aggressive'
                      ? 'danger'
                      : onboarding.risk_appetite === 'Moderate'
                      ? 'warning'
                      : 'success'
                  }
                >
                  {onboarding.risk_appetite}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Focus Industries</p>
                <div className="flex flex-wrap gap-1">
                  {(onboarding.industries as string[]).slice(0, 3).map((ind: string) => (
                    <Badge key={ind} variant="outline" className="text-xs">
                      {ind}
                    </Badge>
                  ))}
                  {(onboarding.industries as string[]).length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{(onboarding.industries as string[]).length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="lg:col-span-1 flex flex-col items-center justify-center text-center py-8">
            <Activity className="h-8 w-8 text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-400 mb-3">Complete your profile to personalize recommendations</p>
            <Link
              href="/onboarding"
              className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Complete Onboarding
            </Link>
          </Card>
        )}

        {/* Quick actions */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              href: '/screener',
              icon: Search,
              title: 'Analyze a Stock',
              desc: 'Score a company for LEAPS suitability',
              color: 'text-blue-400',
              bg: 'bg-blue-400/10 border-blue-400/20',
            },
            {
              href: '/leaps',
              icon: TrendingUp,
              title: 'Get LEAPS Ideas',
              desc: 'Browse option recommendations',
              color: 'text-emerald-400',
              bg: 'bg-emerald-400/10 border-emerald-400/20',
            },
            {
              href: '/research',
              icon: BookOpen,
              title: 'View Research',
              desc: 'Read AI-generated reports',
              color: 'text-purple-400',
              bg: 'bg-purple-400/10 border-purple-400/20',
            },
          ].map(({ href, icon: Icon, title, desc, color, bg }) => (
            <Link key={href} href={href}>
              <Card className="h-full hover:border-zinc-600 transition-colors cursor-pointer">
                <div
                  className={`h-10 w-10 rounded-lg ${bg} border flex items-center justify-center mb-3`}
                >
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className="font-semibold text-zinc-100 text-sm">{title}</p>
                <p className="text-xs text-zinc-500 mt-1">{desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Weekly opportunities */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Weekly Highlights</h2>
            <p className="text-sm text-zinc-500">Sample Data — Top scoring LEAPS candidates this week</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {WEEKLY_OPPORTUNITIES.map((opp) => (
            <Card key={opp.ticker} className="hover:border-zinc-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-100">{opp.ticker}</span>
                    <ScoreBadge score={opp.score} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{opp.company_name}</p>
                </div>
                <Badge variant="outline">{opp.industry}</Badge>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-3">{opp.tagline}</p>
              <Link
                href={`/research/${opp.ticker}`}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
              >
                View Research <ArrowRight className="h-3 w-3" />
              </Link>
            </Card>
          ))}
        </div>
      </div>

      {/* Watchlist summary */}
      {watchlist && watchlist.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-zinc-100">Watchlist</h2>
            <Link
              href="/watchlist"
              className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Card padding="none">
            <div className="divide-y divide-zinc-800">
              {watchlist.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Star className="h-3.5 w-3.5 text-yellow-400" />
                    <div>
                      <span className="font-mono font-semibold text-sm text-zinc-100">{item.ticker}</span>
                      <span className="text-zinc-500 text-sm ml-2">{item.company_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.industry}</Badge>
                    <span className="text-xs text-zinc-500">
                      Confidence: {item.confidence_level}/5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Recent reports */}
      {recentReports && recentReports.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-zinc-100">Recent Research</h2>
            <Link
              href="/research"
              className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Card padding="none">
            <div className="divide-y divide-zinc-800">
              {recentReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/research/${report.ticker}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
                    <div>
                      <span className="font-mono font-semibold text-sm text-zinc-100">{report.ticker}</span>
                      <span className="text-zinc-500 text-sm ml-2">{report.company_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScoreBadge score={report.score} />
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
