import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  autoGroup,
  buildSeries,
  enrich,
  inRange,
  plannedVsActual,
  PRESET_LABEL,
  resolveRange,
  sumSeconds,
  totalsBy,
  type Group,
  type Preset,
} from '../lib/analytics'
import { formatRange } from '../lib/dates'
import { plural } from '../lib/format'
import { useWeekStartsOn } from '../lib/settings'
import { formatDuration } from '../lib/time'
import { useToday } from '../lib/useToday'
import { BarList } from '../components/BarList'
import { StackedTimeChart } from '../components/charts'
import { Button } from '../components/ui/Button'
import { Card, SectionTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

const GROUP_LABEL: Record<Group, string> = { day: 'Day', week: 'Week', month: 'Month' }

export function Analytics() {
  const today = useToday()
  const weekStartsOn = useWeekStartsOn()
  const entries = useLiveQuery(() => db.timeEntries.toArray(), [])
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const [preset, setPreset] = useState<Preset>('thisWeek')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [category, setCategory] = useState('')
  const [groupChoice, setGroupChoice] = useState<Group | null>(null)

  const earliest = useMemo(() => {
    if (!entries?.length) return undefined
    return entries.reduce((m, e) => (e.date < m ? e.date : m), entries[0].date)
  }, [entries])

  const range = resolveRange(preset, today, weekStartsOn, earliest, custom)
  const validRange = !!range.from && !!range.to && range.from <= range.to
  const group = groupChoice ?? (validRange ? autoGroup(range.from, range.to) : 'day')

  const view = useMemo(() => {
    if (!entries || !activities || !goals || !categories || !validRange) return null
    const all = enrich(entries, activities, goals)
    const dateRows = inRange(all, range.from, range.to)
    const rows = category ? dateRows.filter((r) => String(r.categoryId ?? '') === category) : dateRows
    const catName = new Map(categories.map((c) => [c.id!, c.name]))

    const byActivity = totalsBy(rows, (r) => r.activityName)
    const byCategory = totalsBy(rows, (r) => (r.categoryId !== undefined ? (catName.get(r.categoryId) ?? 'Uncategorised') : 'Uncategorised'))

    // Goal sections ignore the activity-category filter but respect the goal's own category.
    const goalFilter = (id?: number) => {
      if (!category) return true
      const g = goals.find((x) => x.id === id)
      return String(g?.categoryId ?? '') === category
    }
    const linked = dateRows.filter((r) => r.entry.goalId !== undefined && goalFilter(r.entry.goalId))
    const goalTitle = (id?: number) => goals.find((g) => g.id === id)?.title ?? 'Deleted goal'
    const byGoal = totalsBy(linked, (r) => String(r.entry.goalId)).map((x) => ({ ...x, id: Number(x.name), name: goalTitle(Number(x.name)) }))
    const unlinked = sumSeconds(dateRows.filter((r) => r.entry.goalId === undefined && !category))
    const planned = plannedVsActual(
      goals.filter((g) => goalFilter(g.id)),
      dateRows,
      range.from,
      range.to,
      today,
    )

    return {
      total: sumSeconds(rows),
      sessions: rows.length,
      series: buildSeries(rows, range.from, range.to, group, weekStartsOn),
      byActivity,
      byCategory,
      byGoal,
      unlinked,
      planned,
    }
  }, [entries, activities, goals, categories, validRange, range.from, range.to, category, group, weekStartsOn, today])

  return (
    <>
      <PageHeader title="Analytics" subtitle="Where your time goes" />

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Period</span>
            <select className="w-full" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
              {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
                <option key={p} value={p}>
                  {PRESET_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Category</span>
            <select className="w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {preset === 'custom' && (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">From</span>
                <input type="date" className="w-full" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">To</span>
                <input type="date" className="w-full" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </label>
            </>
          )}
        </div>
        {validRange ? (
          <p className="mt-3 text-sm text-mute">{formatRange(range.from, range.to)}</p>
        ) : (
          <p className="mt-3 text-sm">Choose a start and end date (the start must not be after the end).</p>
        )}
      </Card>

      {view && entries && view.total === 0 && view.byGoal.length === 0 && view.planned.length === 0 && (
        <Card>
          <p className="text-sm text-mute">
            No time recorded in this period{category ? ' for this category' : ''}. Log time from the{' '}
            <Link to="/time" className="underline underline-offset-4">
              Time
            </Link>{' '}
            screen and it appears here.
          </p>
        </Card>
      )}

      {view && view.total > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Card className="!p-4">
              <p className="label-caps mb-1">Total</p>
              <p className="whitespace-nowrap font-serif text-xl sm:text-2xl">{formatDuration(view.total)}</p>
            </Card>
            <Card className="!p-4">
              <p className="label-caps mb-1">Sessions</p>
              <p className="font-serif text-xl sm:text-2xl">{view.sessions}</p>
            </Card>
            <Card className="!p-4">
              <p className="label-caps mb-1">Most time</p>
              <p className="break-words font-serif text-xl leading-tight sm:text-2xl">{view.byActivity[0]?.name}</p>
            </Card>
          </div>

          <Card>
            <SectionTitle
              action={
                <div className="flex gap-1">
                  {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
                    <Button key={g} small variant={group === g ? 'primary' : 'ghost'} onClick={() => setGroupChoice(g)}>
                      {GROUP_LABEL[g]}
                    </Button>
                  ))}
                </div>
              }
            >
              Time over time
            </SectionTitle>
            <StackedTimeChart series={view.series} />
          </Card>

          <Card>
            <SectionTitle>By activity</SectionTitle>
            <BarList
              items={view.byActivity.map((a) => ({
                name: a.name,
                value: a.seconds,
                sub: `${Math.round((a.seconds / view.total) * 100)}%`,
              }))}
              max={view.byActivity[0]?.seconds ?? 0}
              valueLabel={formatDuration}
            />
          </Card>

          {view.byCategory.length > 1 && (
            <Card>
              <SectionTitle>By category</SectionTitle>
              <BarList
                items={view.byCategory.map((c) => ({ name: c.name, value: c.seconds, sub: `${Math.round((c.seconds / view.total) * 100)}%` }))}
                max={view.byCategory[0].seconds}
                valueLabel={formatDuration}
              />
            </Card>
          )}
        </div>
      )}

      {view && (view.byGoal.length > 0 || view.planned.length > 0) && (
        <div className="mt-6 space-y-6">
          {view.byGoal.length > 0 && (
            <Card>
              <SectionTitle>Time on each goal</SectionTitle>
              <BarList items={view.byGoal.map((g) => ({ name: g.name, value: g.seconds }))} max={view.byGoal[0].seconds} valueLabel={formatDuration} />
              {view.unlinked > 0 && (
                <p className="mt-4 border-t border-line pt-3 text-sm text-mute">
                  {formatDuration(view.unlinked)} in this period is not linked to any goal.
                </p>
              )}
            </Card>
          )}

          {view.planned.length > 0 && (
            <Card>
              <SectionTitle>Planned and actual</SectionTitle>
              <ul className="space-y-4">
                {view.planned.map((p) => {
                  const pct = p.plannedSeconds > 0 ? Math.round((p.actualSeconds / p.plannedSeconds) * 100) : null
                  return (
                    <li key={p.goal.id}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <Link to={`/goals/${p.goal.id}`} className="min-w-0 truncate hover:underline">
                          {p.goal.title}
                        </Link>
                        <span className="shrink-0 tabular-nums">
                          {formatDuration(p.actualSeconds)} <span className="text-mute">of {formatDuration(p.plannedSeconds)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-wash">
                        <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
                      </div>
                      {pct !== null && <p className="mt-1 text-xs text-mute">{pct}% of plan</p>}
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-xs text-mute">
                Planned time is each goal's weekly hours, counted only for days up to today. Set weekly hours when you edit a goal.
              </p>
            </Card>
          )}
        </div>
      )}

      {view && view.total > 0 && (
        <p className="mt-6 text-xs text-mute">
          {plural(view.sessions, 'session')} · grouped by {group}
        </p>
      )}
    </>
  )
}
