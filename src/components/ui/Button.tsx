'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600 hover:border-emerald-500',
  secondary:
    'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 hover:border-zinc-600',
  ghost:
    'bg-transparent hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-transparent',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white border border-rose-600 hover:border-rose-500',
  outline:
    'bg-transparent hover:bg-zinc-800 text-zinc-100 border border-zinc-600 hover:border-zinc-400',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading, fullWidth, className, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            variantClasses[variant],
            sizeClasses[size],
            fullWidth && 'w-full',
            className
          )
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
