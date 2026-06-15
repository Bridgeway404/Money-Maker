import { ReactNode } from 'react'

interface HeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export default function Header({ title, description, actions }: HeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{title}</h1>
        {description && (
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
