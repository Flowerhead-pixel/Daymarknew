/** Simple horizontal bar list: label, bar, value. Readable as text too. */
export function BarList({
  items,
  max,
  valueLabel,
}: {
  items: { name: string; value: number; sub?: string }[]
  max: number
  valueLabel: (v: number) => string
}) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{it.name}</span>
            <span className="shrink-0 tabular-nums">
              {valueLabel(it.value)}
              {it.sub && <span className="ml-2 text-xs text-mute">{it.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-wash">
            <div className="h-full rounded-full bg-ink" style={{ width: `${max > 0 ? Math.min(100, (it.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
