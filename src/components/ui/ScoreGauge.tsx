'use client'

interface ScoreGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function getColor(score: number): { stroke: string; text: string; label: string } {
  if (score >= 90) return { stroke: '#10b981', text: 'text-emerald-400', label: 'Strong Buy' }
  if (score >= 80) return { stroke: '#22c55e', text: 'text-green-400', label: 'Buy' }
  if (score >= 60) return { stroke: '#eab308', text: 'text-yellow-400', label: 'Watch' }
  if (score >= 40) return { stroke: '#f97316', text: 'text-orange-400', label: 'Weak' }
  return { stroke: '#f43f5e', text: 'text-rose-400', label: 'Avoid' }
}

const dimensions = {
  sm: { size: 80, strokeWidth: 6, fontSize: 16, labelSize: 9 },
  md: { size: 120, strokeWidth: 8, fontSize: 24, labelSize: 11 },
  lg: { size: 160, strokeWidth: 10, fontSize: 32, labelSize: 13 },
}

export default function ScoreGauge({ score, size = 'md', showLabel = true }: ScoreGaugeProps) {
  const { stroke, text, label } = getColor(score)
  const dims = dimensions[size]
  const cx = dims.size / 2
  const cy = dims.size / 2
  const radius = (dims.size - dims.strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  // We use 270deg arc (3/4 circle), starting from bottom-left
  const arcLength = circumference * 0.75
  const filled = arcLength * (score / 100)
  const offset = circumference - filled

  // Rotate so the start is at 225deg (bottom-left)
  const rotation = 135

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={dims.size} height={dims.size} style={{ transform: `rotate(${rotation}deg)` }}>
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#27272a"
          strokeWidth={dims.strokeWidth}
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
        />
        {/* Score fill */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={dims.strokeWidth}
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div
        className={`flex flex-col items-center -mt-${size === 'sm' ? 12 : size === 'md' ? 16 : 20}`}
        style={{ marginTop: `-${dims.size * 0.6}px` }}
      >
        <span
          className={`font-bold tabular-nums ${text}`}
          style={{ fontSize: dims.fontSize }}
        >
          {score}
        </span>
        {showLabel && (
          <span
            className="text-zinc-400 font-medium"
            style={{ fontSize: dims.labelSize }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
