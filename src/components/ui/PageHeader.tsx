import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-7 flex items-end justify-between gap-4">
      <div>
        {subtitle && <p className="label-caps mb-1">{subtitle}</p>}
        <h1 className="text-4xl font-bold leading-none tracking-tight md:text-5xl">{title}</h1>
      </div>
      {action}
    </header>
  )
}
