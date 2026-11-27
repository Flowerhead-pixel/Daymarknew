import { clampPercent } from '../../lib/progress'

export function ProgressBar({ percent, onDark }: { percent: number; onDark?: boolean }) {
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full ${onDark ? 'bg-white/25' : 'bg-black/10'}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampPercent(percent))}
    >
      <div className={`h-full rounded-full ${onDark ? 'bg-white' : 'bg-ink'}`} style={{ width: `${clampPercent(percent)}%` }} />
    </div>
  )
}
