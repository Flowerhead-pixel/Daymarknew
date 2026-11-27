import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { TimeEntry } from '../db/schema'
import { addDays, formatWeekday, fromISODate, startOfMonth, startOfWeek } from '../lib/dates'
import { formatDuration } from '../lib/time'
import { useWeekStartsOn } from '../lib/settings'
import { useToday } from '../lib/useToday'
import { Button } from '../components/ui/Button'
import { Card, SectionTitle } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { TimeEntryForm } from '../components/TimeEntryForm'
import { TimerCard } from '../components/TimerCard'

type Range = 'week' | 'month' | 'all'

const sum = (rows: TimeEntry[]) => rows.reduce((t, e) => t + e.durationSeconds, 0)

export function Time() {
  const today = useToday()
  const weekStartsOn = useWeekStartsOn()
  const entries = useLiveQuery(() => db.timeEntries.toArray(), [])
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [range, setRange] = useState<Range>('week')
  const [limit, setLimit] = useState(60)
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [deleting, setDeleting] = useState<TimeEntry | null>(null)

  const weekStart = startOfWeek(today, weekStartsOn)
  const monthStart = startOfMonth(today)

  const totals = useMemo(() => {
    const all = entries ?? []
    return {
      today: sum(all.filter((e) => e.date === today)),
      week: sum(all.filter((e) => e.date >= weekStart)),
      month: sum(all.filter((e) => e.date >= monthStart)),
    }
  }, [entries, today, weekStart, monthStart])

  const visible = useMemo(() => {
    const from = range === 'week' ? weekStart : range === 'month' ? monthStart : ''
    return (entries ?? [])
      .filter((e) => e.date >= from)
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  }, [entries, range, weekStart, monthStart])

  const shown = visible.slice(0, limit)
  const groups = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const e of shown) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return [...map.entries()]
  }, [shown])

  const activityName = (id: number) => activities?.find((a) => a.id === id)?.name ?? 'Deleted activity'
  const goalTitle = (id?: number) => (id === undefined ? undefined : goals?.find((g) => g.id === id)?.title)

  const dayLabel = (iso: string) => {
    if (iso === today) return 'Today'
    if (iso === addDays(today, -1)) return 'Yesterday'
    return `${formatWeekday(iso)}, ${fromISODate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  }

  return (
    <>
      <PageHeader title="Time" subtitle="Where it goes" />

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          ['Today', totals.today],
          ['This week', totals.week],
          ['This month', totals.month],
        ].map(([label, secs]) => (
          <Card key={label as string} className="!p-4">
            <p className="label-caps mb-1">{label}</p>
            <p className="font-serif text-2xl">{formatDuration(secs as number)}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <TimerCard />

        <Card>
          <SectionTitle>Add time by hand</SectionTitle>
          <TimeEntryForm />
        </Card>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="label-caps">Sessions</h2>
            <div className="flex gap-1">
              {(['week', 'month', 'all'] as Range[]).map((r) => (
                <Button
                  key={r}
                  small
                  variant={range === r ? 'primary' : 'ghost'}
                  onClick={() => {
                    setRange(r)
                    setLimit(60)
                  }}
                >
                  {r === 'week' ? 'Week' : r === 'month' ? 'Month' : 'All'}
                </Button>
              ))}
            </div>
          </div>

          {entries && visible.length === 0 && (
            <Card>
              <p className="text-sm text-mute">
                No sessions {range === 'all' ? 'yet' : `this ${range}`}. Start the timer or add time by hand.
              </p>
            </Card>
          )}

          <div className="space-y-4">
            {groups.map(([date, rows]) => (
              <Card key={date} className="!p-0">
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <span className="text-sm font-medium">{dayLabel(date)}</span>
                  <span className="text-sm text-mute">{formatDuration(sum(rows))}</span>
                </div>
                <ul className="divide-y divide-line">
                  {rows.map((e) => (
                    <li key={e.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate">{activityName(e.activityId)}</p>
                          {(goalTitle(e.goalId) || e.notes) && (
                            <p className="truncate text-xs text-mute">
                              {goalTitle(e.goalId)}
                              {goalTitle(e.goalId) && e.notes ? ' · ' : ''}
                              {e.notes}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">{formatDuration(e.durationSeconds)}</span>
                      </div>
                      <div className="mt-1 flex gap-1">
                        <Button small variant="ghost" onClick={() => setEditing(e)}>
                          Edit
                        </Button>
                        <Button small variant="ghost" onClick={() => setDeleting(e)}>
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          {visible.length > limit && (
            <div className="mt-4 text-center">
              <Button onClick={() => setLimit((l) => l + 60)}>Show more</Button>
            </div>
          )}
        </section>
      </div>

      {editing && (
        <Modal title="Edit session" onClose={() => setEditing(null)}>
          <TimeEntryForm entry={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this session?"
        message={
          deleting
            ? `${activityName(deleting.activityId)}, ${formatDuration(deleting.durationSeconds)}. If it is linked to a goal, that goal's progress goes down by the same amount.`
            : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting?.id !== undefined) await db.timeEntries.delete(deleting.id)
          setDeleting(null)
        }}
      />
    </>
  )
}
