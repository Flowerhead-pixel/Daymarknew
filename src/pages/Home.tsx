import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addDays, formatMonthYear, formatWeekday } from '../lib/dates'
import { compareGoals, isPast } from '../lib/deadline'
import { plural } from '../lib/format'
import { formatDuration } from '../lib/time'
import { useLastBackup } from '../lib/storage'
import { useGoalData } from '../lib/useGoalData'
import { Button } from '../components/ui/Button'
import { Card, SectionTitle } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { GoalCard } from '../components/GoalCard'
import { GoalForm } from '../components/GoalForm'
import { MonthDots } from '../components/MonthDots'

function Priorities({ today }: { today: string }) {
  const items = useLiveQuery(() => db.priorities.where('date').equals(today).sortBy('createdAt'), [today])
  const yesterday = useLiveQuery(
    () => db.priorities.where('date').equals(addDays(today, -1)).filter((p) => !p.done).toArray(),
    [today],
  )
  const [text, setText] = useState('')

  async function add() {
    const t = text.trim()
    if (!t) return
    await db.priorities.add({ date: today, text: t, done: false, createdAt: Date.now() })
    setText('')
  }

  async function carryOver() {
    if (!yesterday?.length) return
    await db.transaction('rw', db.priorities, async () => {
      for (const p of yesterday) {
        await db.priorities.update(p.id!, { date: today })
      }
    })
  }

  return (
    <div>
      <SectionTitle>Today's priorities</SectionTitle>
      {items?.length === 0 && <p className="mb-3 text-sm text-mute">Nothing set for today. What matters most?</p>}
      <ul className="mb-3 space-y-1">
        {items?.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              className="h-5 w-5 accent-black"
              checked={p.done}
              aria-label={`Mark "${p.text}" done`}
              onChange={() => db.priorities.update(p.id!, { done: !p.done })}
            />
            <span className={`flex-1 ${p.done ? 'text-mute line-through' : ''}`}>{p.text}</span>
            <button
              type="button"
              className="px-1 text-sm text-mute hover:text-ink"
              aria-label={`Remove "${p.text}"`}
              onClick={() => db.priorities.delete(p.id!)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1"
          placeholder="Add a priority for today"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button variant="primary" disabled={!text.trim()} onClick={add}>
          Add
        </Button>
      </div>
      {!!yesterday?.length && (
        <button type="button" onClick={carryOver} className="mt-3 text-sm text-mute underline underline-offset-4 hover:text-ink">
          Bring over {plural(yesterday.length, 'unfinished item')} from yesterday
        </button>
      )}
    </div>
  )
}

export function Home() {
  const data = useGoalData()
  const today = data?.today
  const entries = useLiveQuery(() => db.timeEntries.toArray(), [])
  const priorities = useLiveQuery(() => (today ? db.priorities.where('date').equals(today).toArray() : []), [today])
  const [creating, setCreating] = useState(false)
  const lastBackup = useLastBackup()

  const summary = useMemo(() => {
    if (!data || !entries) return null
    const day = entries.filter((e) => e.date === data.today)
    const week = entries.filter((e) => e.date >= data.weekStart)
    return {
      daySeconds: day.reduce((t, e) => t + e.durationSeconds, 0),
      sessions: day.length,
      weekSeconds: week.reduce((t, e) => t + e.durationSeconds, 0),
    }
  }, [data, entries])

  const trackedDates = useMemo(() => new Set((entries ?? []).map((e) => e.date)), [entries])

  const groups = useMemo(() => {
    if (!data) return null
    const live = data.goals.filter((g) => !g.archived && g.status !== 'completed')
    const focus = live.filter((g) => g.pinned).sort(compareGoals).slice(0, 3)
    const active = data.goals.filter((g) => !g.archived && g.status === 'active' && !g.pinned).sort(compareGoals)
    return {
      focus,
      past: active.filter((g) => isPast(g, data.today)),
      upcoming: active.filter((g) => !isPast(g, data.today)),
      total: data.goals.filter((g) => !g.archived).length,
    }
  }, [data])

  if (!data || !groups || !summary) return <PageHeader title="Daymark" />

  const done = priorities?.filter((p) => p.done).length ?? 0
  const total = priorities?.length ?? 0
  const card = (g: (typeof data.goals)[number], large = false) => (
    <GoalCard
      key={g.id}
      goal={g}
      stats={data.statsOf(g.id!)}
      categoryName={data.categoryName(g.categoryId)}
      today={data.today}
      large={large}
    />
  )

  return (
    <>
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="label-caps mb-2">{formatWeekday(data.today)}</p>
          <h1 className="flex items-baseline gap-3 leading-none">
            <span className="text-7xl font-bold tracking-tighter">{Number(data.today.slice(8))}</span>
            <span className="text-xl font-medium leading-tight tracking-normal">{formatMonthYear(data.today)}</span>
          </h1>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New goal
        </Button>
      </header>

      <div className="space-y-10">
        <Card>
          <div className="mb-5 grid grid-cols-3 gap-3 border-b border-line pb-5">
            <div>
              <p className="label-caps mb-1">Tracked today</p>
              <p className="whitespace-nowrap text-xl font-bold">{formatDuration(summary.daySeconds)}</p>
              <p className="text-xs text-mute">{plural(summary.sessions, 'session')}</p>
            </div>
            <div>
              <p className="label-caps mb-1">This week</p>
              <p className="whitespace-nowrap text-xl font-bold">{formatDuration(summary.weekSeconds)}</p>
            </div>
            <div>
              <p className="label-caps mb-1">Priorities</p>
              <p className="text-2xl font-bold">{total === 0 ? '–' : `${done} / ${total}`}</p>
              <p className="text-xs text-mute">{total === 0 ? 'none set' : 'done'}</p>
            </div>
          </div>
          <Priorities today={data.today} />
        </Card>

        <Card>
          <SectionTitle>{formatMonthYear(data.today)}</SectionTitle>
          <MonthDots today={data.today} trackedDates={trackedDates} />
        </Card>

        {groups.total === 0 && (
          <Card>
            <h2 className="mb-1 text-xl">Start with one goal</h2>
            <p className="mb-4 text-sm text-mute">
              Add anything you are working towards: an exam, a number of hours, a project. You can pin up to three
              to keep them at the top of this screen.
            </p>
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create your first goal
            </Button>
          </Card>
        )}

        {groups.focus.length > 0 && (
          <section>
            <SectionTitle>Focus</SectionTitle>
            <div className="space-y-3">{groups.focus.map((g) => card(g, true))}</div>
          </section>
        )}

        {groups.past.length > 0 && (
          <section>
            <SectionTitle>Past their date</SectionTitle>
            <p className="mb-3 text-sm text-mute">
              These dates have passed. Move the date, finish them, or pause them. Nothing is lost.
            </p>
            <div className="space-y-3">{groups.past.map((g) => card(g))}</div>
          </section>
        )}

        {groups.upcoming.length > 0 && (
          <section>
            <SectionTitle
              action={
                <Link to="/goals" className="text-sm text-mute hover:text-ink">
                  All goals
                </Link>
              }
            >
              Active goals
            </SectionTitle>
            <div className="space-y-3">{groups.upcoming.map((g) => card(g))}</div>
          </section>
        )}
      </div>

      {lastBackup !== null && (groups.total > 0 || (entries?.length ?? 0) > 0) &&
        (lastBackup === undefined || Date.now() - lastBackup > 30 * 86_400_000) && (
          <p className="mt-10 text-center text-xs text-mute">
            {lastBackup === undefined ? 'No backup yet.' : 'Last backup was over a month ago.'}{' '}
            <Link to="/settings" className="underline underline-offset-4 hover:text-ink">
              Back up in Settings
            </Link>
          </p>
        )}

      {creating && (
        <Modal title="New goal" onClose={() => setCreating(false)}>
          <GoalForm onClose={() => setCreating(false)} />
        </Modal>
      )}
    </>
  )
}
