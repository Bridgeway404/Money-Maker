export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/layout/Header'
import ReportCard from '@/components/research/ReportCard'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { BookOpen, Plus } from 'lucide-react'
import type { ResearchReport } from '@/types'

export default async function ResearchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: reports } = await supabase
    .from('research_reports')
    .select('*')
    .eq('user_id', user.id)
    .order('generated_at', { ascending: false })

  return (
    <div className="space-y-6">
      <Header
        title="Research Reports"
        description="AI-generated company research for LEAPS evaluation."
        actions={
          <Link href="/screener">
            <Button size="sm">
              <Plus className="h-4 w-4" /> New Research
            </Button>
          </Link>
        }
      />

      {!reports || reports.length === 0 ? (
        <Card className="text-center py-16">
          <BookOpen className="h-10 w-10 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 font-medium">No research reports yet</p>
          <p className="text-zinc-600 text-sm mt-1 mb-6">
            Use the screener to score a company, then generate an AI research report.
          </p>
          <Link href="/screener">
            <Button>Start Screening</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {(reports as ResearchReport[]).map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  )
}
