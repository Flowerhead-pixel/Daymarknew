import { Link } from 'react-router-dom'
import type { Goal } from '../db/schema'
import { deadlineInfo, deadlineText, STATUS_LABEL, TYPE_LABEL } from '../lib/deadline'
import { computeProgress, type GoalStats } from '../lib/progress'
import { swatchFor } from '../lib/palette'
import { ProgressBar } from './ui/ProgressBar'

export function GoalCard({
  goal,
  stats,
  categoryName,
  today,
  large,
}: {
  goal: Goal
  stats: GoalStats
  categoryName: string
  today: string
  large?: boolean
}) {
  const info = deadlineInfo(goal, today)
  const progress = computeProgress(goal, stats)
  const date = deadlineText(goal)
  const sw = swatchFor(categoryName, goal.categoryId)
  const sub = sw.dark ? 'text-white/75' : 'text-black/60'

  return (
    <Link
      to={`/goals/${goal.id}`}
      style={{ backgroundColor: sw.bg }}
      className={`block rounded-3xl p-5 transition-transform active:scale-[0.99] ${
        sw.dark ? 'text-white' : 'text-ink'
      } ${info.tone === 'past' ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''} ${large ? 'sm:p-6' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={`truncate text-[11px] font-semibold uppercase tracking-widest ${sub}`}>
          {categoryName} · {TYPE_LABEL[goal.type]}
        </span>
        <span className={`shrink-0 text-xs ${sub}`}>
          {[goal.pinned && 'Pinned', goal.status !== 'active' && STATUS_LABEL[goal.status]].filter(Boolean).join(' · ')}
        </span>
      </div>
      <h3 className={`${large ? 'text-3xl' : 'text-2xl'} font-bold leading-tight`}>{goal.title}</h3>
      <p className={`mt-1 text-sm ${sub}`}>
        {date && <span>{date} · </span>}
        <span className={info.tone === 'soon' ? 'font-semibold' : ''}>{info.text}</span>
      </p>
      {(progress.percent !== null || progress.summary) && (
        <div className="mt-3">
          {progress.percent !== null && <ProgressBar percent={progress.percent} onDark={sw.dark} />}
          <div className={`mt-2 flex justify-between text-xs ${sub}`}>
            <span>{progress.summary}</span>
            {progress.percent !== null && (
              <span className="text-sm font-bold">{Math.round(progress.percent)}%</span>
            )}
          </div>
        </div>
      )}
    </Link>
  )
}
