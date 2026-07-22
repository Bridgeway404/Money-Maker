import Link from 'next/link'
import type { ResearchReport } from '@/types'
import Card from '@/components/ui/Card'
import Badge, { ScoreBadge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils/formatting'
import { ArrowRight, FileText } from 'lucide-react'

interface ReportCardProps {
  report: ResearchReport
}

export default function ReportCard({ report }: ReportCardProps) {
  return (
    <Card className="hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-zinc-100 text-sm">{report.ticker}</span>
              <span className="text-zinc-400 text-sm">{report.company_name}</span>
              {report.score > 0 ? (
                <ScoreBadge score={report.score} />
              ) : (
                <Badge variant="outline">Unscored</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">{report.industry}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500">{formatDate(report.generated_at)}</span>
            </div>
            <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
              {report.conclusion?.slice(0, 150) || report.overview?.slice(0, 150) || 'AI-generated research report'}
            </p>
          </div>
        </div>
        <Link
          href={`/research/${report.ticker}`}
          className="shrink-0 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </Card>
  )
}
