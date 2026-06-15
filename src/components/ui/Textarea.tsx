import { TextareaHTMLAttributes, forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={twMerge(
            'w-full rounded-lg bg-zinc-800 border px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950',
            'disabled:opacity-50 disabled:cursor-not-allowed resize-none',
            error ? 'border-rose-500' : 'border-zinc-700 hover:border-zinc-600',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
