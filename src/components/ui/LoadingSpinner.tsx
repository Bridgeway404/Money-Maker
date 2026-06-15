import { clsx } from 'clsx'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
}

export default function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className={clsx(
          'animate-spin rounded-full border-zinc-700 border-t-emerald-500',
          sizeClasses[size]
        )}
      />
      {label && <p className="text-sm text-zinc-400">{label}</p>}
    </div>
  )
}
