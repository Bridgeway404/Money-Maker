import { SelectHTMLAttributes, forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={twMerge(
            'w-full rounded-lg bg-zinc-800 border px-3 py-2 text-sm text-zinc-100',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'appearance-none cursor-pointer',
            error ? 'border-rose-500' : 'border-zinc-700 hover:border-zinc-600',
            className
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.5em 1.5em',
            paddingRight: '2.5rem',
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
