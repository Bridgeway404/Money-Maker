import { HTMLAttributes, forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'md', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'rounded-xl',
            {
              'bg-zinc-900 border border-zinc-800': variant === 'default',
              'bg-zinc-800 border border-zinc-700': variant === 'elevated',
              'bg-transparent border border-zinc-700': variant === 'bordered',
            },
            {
              'p-0': padding === 'none',
              'p-4': padding === 'sm',
              'p-6': padding === 'md',
              'p-8': padding === 'lg',
            },
            className
          )
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge('mb-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={twMerge('text-lg font-semibold text-zinc-100', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={twMerge('text-sm text-zinc-400 mt-1', className)} {...props}>
      {children}
    </p>
  )
}

export default Card
