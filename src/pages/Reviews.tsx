import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { WeeklyReview } from '../db/schema'
import { addDays, formatRange, startOfWeek } from '../lib/dates'
import { formatValue, plural } from '../lib/format'
import { useWeekStartsOn } from '../lib/settings'
import { formatDuration } from '../lib/time'
import { useToday } from '../lib/useToday'
import { summarizeWeek } from '../lib/weekly'
import { BarList } from '../components/BarList'
import { Button } from '../components/ui/Button'
import { Card, SectionTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

type Fields = Pick<WeeklyReview, 'accomplished' | 'wentWrong' | 'learned' | 'nextFocus'>

const PROMPTS: { key: keyof Fields; label: string; hint: string }[] = [
  { key: 'accomplished', label: 'What did I accomplish?', hint: '' },
  { key: 'wentWrong', label: 'What went wrong?', hint: '' },
  { key: 'learned', label: 'What did I learn?', hint: '' },
  { key: 'nextFocus', label: 'What should I focus on next week?', hint: '' },
]

const EMPTY: Fields = { accomplished: '', wentWrong: '', learned: '', nextFocus: '' }

/** Saves itself shortly after you stop typing. Mounted once the stored review has loaded. */
function Reflection({ weekStart, initial, planned }: { weekStart: string; initial: Fields; planned?: string }) {
  const [fields, setFields] = useState<Fields>(initial)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const latest = useRef(fields)
  latest.current = fields
  const dirty = useRef(false)

  async function save() {
    clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    setStatus('saving')
    const f = latest.current
    await db.transaction('rw', db.weeklyReviews, async () => {
      const existing = await db.weeklyReviews.where('weekStart').equals(weekStart).first()
      const now = Date.now()
      if (existing?.id !== undefined) await db.weeklyReviews.update(existing.id, { ...f, updatedAt: now })
      else await db.weeklyReviews.add({ weekStart, ...f, createdAt: now, updatedAt: now })
    })
    setStatus('saved')
  }

  // If the stored text changes underneath us (e.g. a save from just before you navigated
  // here finished late) and you have not typed since, show the stored text.
  useEffect(() => {
    if (!dirty.current) setFields(initial)
  }, [initial.accomplished, initial.wentWrong, initial.learned, initial.nextFocus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save any pending text if you leave the page or switch weeks.
  useEffect(() => () => void save(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function change(key: keyof Fields, value: string) {
    dirty.current = true
    setFields((p) => ({ ...p, [key]: value }))
    setStatus('idle')
    clearTimeout(timer.current)
    timer.current = setTimeout(save, 700)
  }

  return (
    <Card>
      <SectionTitle action={<span className="text-xs text-mute">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}</span>}>
        Reflection
      </SectionTitle>
      {planned && (
        <p className="mb-4 rounded-2xl bg-wash px-3 py-2 text-sm">
          <span className="text-mute">Last week you planned to focus on: </span>
          {planned}
        </p>
      )}
      <div className="space-y-4">
        {PROMPTS.map((p) => (
          <label key={p.key} className="block">
            <span className="mb-1 block text-sm font-medium">{p.label}</span>
            <textarea className="w-full" rows={3} value={fields[p.key]} onChange={(e) => change(p.key, e.target.value)} onBlur={save} />
          </label>
        ))}
      </div>
    </Card>
  )
}

export function Reviews() {
  const today = useToday()
  const weekStartsOn = useWeekStartsOn()
  const [params, setParams] = useSearchParams()
  const currentWeek = startOfWeek(today, weekStartsOn)
  const weekStart = params.get('week') ?? currentWeek
  const weekEnd = addDays(weekStart, 6)

  const entries = useLiveQuery(() => db.timeEntries.toArray(), [])
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const milestones = useLiveQuery(() => db.milestones.toArray(), [])
  const logs = useLiveQuery(() => db.progressLogs.toArray(), [])
  const review = useLiveQuery(async () => (await db.weeklyReviews.where('weekStart').equals(weekStart).first()) ?? null, [weekStart])
  const prevReview = useLiveQuery(async () => (await db.weeklyReviews.where('weekStart').equals(addDays(weekStart, -7)).first()) ?? null, [weekStart])
  const allReviews = useLiveQuery(() => db.weeklyReviews.toArray(), [])

  const summary = useMemo(() => {
    if (!entries || !activities || !goals || !milestones || !logs) return null
    return summarizeWeek(weekStart, today, { entries, activities, goals, milestones, logs })
  }, [entries, activities, goals, milestones, logs, weekStart, today])

  const go = (w: string) => setParams(w === currentWeek ? {} : { week: w })
  const past = (allReviews ?? []).filter((r) => r.weekStart !== weekStart).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
  const isCurrent = weekStart === currentWeek

  return (
    <>
      <PageHeader title="Reviews" subtitle="Weekly" />

      <div className="mb-6 flex items-center justify-between gap-2">
        <Button small onClick={() => go(addDays(weekStart, -7))}>
          ← Earlier
        </Button>
        <div className="text-center">
          <p className="font-serif text-lg">{formatRange(weekStart, weekEnd)}</p>
          <p className="text-xs text-mute">{isCurrent ? 'This week so far' : weekStart === addDays(currentWeek, -7) ? 'Last week' : ' '}</p>
        </div>
        <Button small disabled={weekStart >= currentWeek} onClick={() => go(addDays(weekStart, 7))}>
          Later →
        </Button>
      </div>
      {!isCurrent && (
        <div className="-mt-3 mb-6 text-center">
          <button type="button" onClick={() => go(currentWeek)} className="text-sm text-mute underline underline-offset-4 hover:text-ink">
            Jump to this week
          </button>
        </div>
      )}

      {summary && (
        <div className="space-y-6">
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="label-caps mb-1">Tracked</p>
                <p className="font-serif text-3xl">{formatDuration(summary.totalSeconds)}</p>
              </div>
              <div>
                <p className="label-caps mb-1">Sessions</p>
                <p className="font-serif text-3xl">{summary.sessions}</p>
              </div>
            </div>
            {summary.totalSeconds === 0 && (
              <p className="mt-3 text-sm text-mute">Nothing tracked this week. That is fine; this page is just a record.</p>
            )}
          </Card>

          {summary.byActivity.length > 0 && (
            <Card>
              <SectionTitle>Hours by activity</SectionTitle>
              <BarList items={summary.byActivity.map((a) => ({ name: a.name, value: a.seconds }))} max={summary.byActivity[0].seconds} valueLabel={formatDuration} />
            </Card>
          )}

          {summary.progressed.length > 0 && (
            <Card>
              <SectionTitle>Goals that moved</SectionTitle>
              <ul className="divide-y divide-line">
                {summary.progressed.map((p) => (
                  <li key={p.goal.id} className="py-2.5">
                    <Link to={`/goals/${p.goal.id}`} className="hover:underline">
                      {p.goal.title}
                    </Link>
                    <p className="text-sm text-mute">
                      {[
                        p.seconds > 0 && formatDuration(p.seconds),
                        p.milestonesDone > 0 && plural(p.milestonesDone, 'milestone') + ' done',
                        p.manualDelta !== undefined && `${p.manualDelta >= 0 ? '+' : ''}${formatValue(p.manualDelta, p.goal.unit)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {summary.milestones.length > 0 && (
            <Card>
              <SectionTitle>Milestones completed</SectionTitle>
              <ul className="divide-y divide-line">
                {summary.milestones.map((m, i) => (
                  <li key={i} className="py-2.5 text-sm">
                    {m.title}
                    <span className="text-mute"> · {m.goalTitle}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {summary.planned.length > 0 && (
            <Card>
              <SectionTitle>Planned and actual</SectionTitle>
              <BarList
                items={summary.planned.map((p) => ({
                  name: p.goal.title,
                  value: p.actualSeconds,
                  sub: `of ${formatDuration(p.plannedSeconds)}`,
                }))}
                max={Math.max(...summary.planned.map((p) => Math.max(p.actualSeconds, p.plannedSeconds)), 1)}
                valueLabel={formatDuration}
              />
            </Card>
          )}

          {summary.quiet.length > 0 && (
            <Card>
              <SectionTitle>Quiet this week</SectionTitle>
              <p className="mb-2 text-sm text-mute">Active goals with nothing logged. Worth a look, not a worry.</p>
              <ul className="divide-y divide-line">
                {summary.quiet.map((g) => (
                  <li key={g.id} className="py-2">
                    <Link to={`/goals/${g.id}`} className="hover:underline">
                      {g.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {review !== undefined && (
            <Reflection
              key={weekStart}
              weekStart={weekStart}
              initial={review ? { accomplished: review.accomplished, wentWrong: review.wentWrong, learned: review.learned, nextFocus: review.nextFocus } : EMPTY}
              planned={prevReview?.nextFocus?.trim() || undefined}
            />
          )}

          {past.length > 0 && (
            <Card>
              <SectionTitle>Earlier reviews</SectionTitle>
              <ul className="divide-y divide-line">
                {past.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => go(r.weekStart)} className="w-full py-3 text-left hover:bg-wash">
                      <p className="text-sm font-medium">{formatRange(r.weekStart, addDays(r.weekStart, 6))}</p>
                      <p className="truncate text-sm text-mute">{r.accomplished || r.learned || r.nextFocus || r.wentWrong || 'No text'}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
