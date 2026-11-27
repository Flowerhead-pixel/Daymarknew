import { useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { TimeEntry } from '../db/schema'
import { todayISO } from '../lib/dates'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { SelectWithCreate } from './ui/SelectWithCreate'

/** Add a session by hand, or edit an existing one (pass `entry`). */
export function TimeEntryForm({
  entry,
  defaultGoalId,
  onDone,
}: {
  entry?: TimeEntry
  defaultGoalId?: number
  onDone?: () => void
}) {
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const last = useLiveQuery(() => db.timeEntries.orderBy('id').last(), [])

  const totalMin = entry ? Math.round(entry.durationSeconds / 60) : 0
  const [activityId, setActivityId] = useState(entry ? String(entry.activityId) : '')
  const [goalId, setGoalId] = useState(
    entry?.goalId !== undefined ? String(entry.goalId) : defaultGoalId !== undefined ? String(defaultGoalId) : '',
  )
  const [date, setDate] = useState(entry?.date ?? todayISO())
  const [hours, setHours] = useState(entry ? String(Math.floor(totalMin / 60)) : '')
  const [minutes, setMinutes] = useState(entry ? String(totalMin % 60) : '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [defaulted, setDefaulted] = useState(false)

  // New entries start with the activity you used last.
  useEffect(() => {
    if (entry || defaulted || !last || !activities) return
    const a = activities.find((x) => x.id === last.activityId && !x.archived)
    if (a) setActivityId(String(a.id))
    setDefaulted(true)
  }, [entry, defaulted, last, activities])

  const activityOptions = (activities ?? [])
    .filter((a) => !a.archived || a.id === entry?.activityId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ value: String(a.id), label: a.name }))

  const goalOptions = (goals ?? [])
    .filter((g) => (!g.archived && g.status !== 'completed') || g.id === entry?.goalId || g.id === defaultGoalId)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((g) => ({ value: String(g.id), label: g.title }))

  const currentMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0)
  function addMinutes(n: number) {
    const t = currentMinutes + n
    setHours(String(Math.floor(t / 60)))
    setMinutes(String(t % 60))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!activityId) return setError('Choose or create an activity.')
    const h = Number(hours || 0)
    const m = Number(minutes || 0)
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) return setError('Enter a valid duration.')
    const seconds = Math.round((h * 60 + m) * 60)
    if (seconds <= 0) return setError('Duration must be more than zero.')
    if (seconds > 24 * 3600) return setError('A single session can be at most 24 hours.')
    if (!date) return setError('Choose a date.')
    if (date > todayISO()) return setError('That date is in the future.')

    const data = {
      activityId: Number(activityId),
      goalId: goalId ? Number(goalId) : undefined,
      date,
      durationSeconds: seconds,
      notes: notes.trim(),
    }
    if (entry?.id !== undefined) {
      await db.timeEntries.put({ ...entry, ...data })
      onDone?.()
    } else {
      await db.timeEntries.add({ ...data, createdAt: Date.now() })
      setHours('')
      setMinutes('')
      setNotes('')
      setFlash('Session added')
      setTimeout(() => setFlash(''), 2500)
      onDone?.()
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <span className="mb-1 block text-sm font-medium">Activity</span>
        <SelectWithCreate
          value={activityId}
          onChange={setActivityId}
          options={activityOptions}
          noneLabel="Choose activity"
          createLabel="+ New activity…"
          placeholder="e.g. Drawing"
          onCreate={async (name) => {
            const existing = activities?.find((a) => a.name.toLowerCase() === name.toLowerCase())
            if (existing) {
              if (existing.archived) await db.activities.update(existing.id!, { archived: false })
              return String(existing.id)
            }
            const cat = goalId ? goals?.find((g) => g.id === Number(goalId))?.categoryId : undefined
            return String(await db.activities.add({ name, categoryId: cat, archived: false }))
          }}
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">Duration</span>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            aria-label="Hours"
            className="w-20"
            placeholder="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <span className="text-sm text-mute">h</span>
          <input
            inputMode="numeric"
            aria-label="Minutes"
            className="w-20"
            placeholder="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          <span className="text-sm text-mute">min</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {[15, 30, 60].map((n) => (
            <Button key={n} small onClick={() => addMinutes(n)}>
              +{n === 60 ? '1h' : `${n}m`}
            </Button>
          ))}
          {currentMinutes > 0 && (
            <Button
              small
              variant="ghost"
              onClick={() => {
                setHours('')
                setMinutes('')
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" className="w-full" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Linked goal">
          <select className="w-full" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">No goal</option>
            {goalOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notes (optional)">
        <input className="w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {error && <p className="rounded-2xl border border-ink bg-white px-3 py-2 text-sm">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {flash && <span className="text-sm text-mute">{flash}</span>}
        {entry && <Button onClick={onDone}>Cancel</Button>}
        <Button type="submit" variant="primary">
          {entry ? 'Save session' : 'Add session'}
        </Button>
      </div>
    </form>
  )
}
