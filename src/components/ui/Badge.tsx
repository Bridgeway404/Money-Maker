import { HTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
  success: 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30',
  warning: 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30',
  danger: 'bg-rose-400/10 text-rose-400 border border-rose-400/30',
  info: 'bg-blue-400/10 text-blue-400 border border-blue-400/30',
  outline: 'bg-transparent text-zinc-300 border border-zinc-600',
}

export default function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
          variantClasses[variant],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  let variant: BadgeVariant = 'danger'
  let label = 'Avoid'

  if (score >= 90) {
    variant = 'success'
    label = 'Strong Buy'
  } else if (score >= 80) {
    variant = 'success'
    label = 'Buy'
  } else if (score >= 60) {
    variant = 'warning'
    label = 'Watch'
  } else if (score >= 40) {
    variant = 'warning'
    label = 'Weak'
  }

  return (
    <Badge variant={variant} className={className}>
      {score} — {label}
    </Badge>
  )
}
