import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { discardTimer, pauseTimer, resumeTimer, startTimer, stopTimer, useTimer } from '../lib/timer'
import { formatClock, formatDuration } from '../lib/time'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { SelectWithCreate } from './ui/SelectWithCreate'

export function TimerCard() {
  const { timer, elapsedSeconds } = useTimer()
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const last = useLiveQuery(() => db.timeEntries.orderBy('id').last(), [])

  const [activityId, setActivityId] = useState('')
  const [goalId, setGoalId] = useState('')
  const [defaulted, setDefaulted] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    if (defaulted || !last || !activities) return
    const a = activities.find((x) => x.id === last.activityId && !x.archived)
    if (a) {
      setActivityId(String(a.id))
      if (last.goalId !== undefined) {
        const g = goals?.find((x) => x.id === last.goalId)
        if (g && !g.archived && g.status !== 'completed') setGoalId(String(g.id))
      }
    }
    setDefaulted(true)
  }, [defaulted, last, activities, goals])

  const activityName = (id: number) => activities?.find((a) => a.id === id)?.name ?? 'Activity'
  const goalTitle = (id?: number) => (id === undefined ? undefined : goals?.find((g) => g.id === id)?.title)

  async function onStop() {
    const secs = await stopTimer()
    setSavedMsg(secs >= 1 ? `Saved ${formatDuration(secs)}` : 'Nothing to save')
    setTimeout(() => setSavedMsg(''), 3000)
  }

  if (timer) {
    return (
      <Card>
        <p className="label-caps mb-1">{timer.state === 'running' ? 'Running' : 'Paused'}</p>
        <p className="font-serif text-lg">
          {activityName(timer.activityId)}
          {goalTitle(timer.goalId) && <span className="text-mute"> · {goalTitle(timer.goalId)}</span>}
        </p>
        <p className="my-4 font-serif text-6xl tabular-nums tracking-tight" aria-live="off">
          {formatClock(elapsedSeconds)}
        </p>
        <input
          className="mb-4 w-full"
          placeholder="Notes for this session (optional)"
          defaultValue={timer.notes ?? ''}
          onBlur={(e) => db.timers.update('current', { notes: e.target.value.trim() })}
        />
        <div className="flex flex-wrap gap-2">
          {timer.state === 'running' ? (
            <Button onClick={pauseTimer}>Pause</Button>
          ) : (
            <Button variant="primary" onClick={resumeTimer}>
              Resume
            </Button>
          )}
          <Button variant="primary" onClick={onStop}>
            Stop and save
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
            Discard
          </Button>
        </div>
        <ConfirmDialog
          open={confirmDiscard}
          title="Discard this timer?"
          message="The time recorded so far will not be saved."
          confirmLabel="Discard"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={async () => {
            await discardTimer()
            setConfirmDiscard(false)
          }}
        />
      </Card>
    )
  }

  const goalOptions = (goals ?? [])
    .filter((g) => !g.archived && g.status !== 'completed')
    .sort((a, b) => a.title.localeCompare(b.title))

  return (
    <Card>
      <p className="label-caps mb-3">Timer</p>
      <div className="space-y-3">
        <SelectWithCreate
          value={activityId}
          onChange={setActivityId}
          options={(activities ?? [])
            .filter((a) => !a.archived)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((a) => ({ value: String(a.id), label: a.name }))}
          noneLabel="Choose activity"
          createLabel="+ New activity…"
          placeholder="e.g. Japanese"
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
        <select className="w-full" value={goalId} onChange={(e) => setGoalId(e.target.value)} aria-label="Linked goal">
          <option value="">No linked goal</option>
          {goalOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            disabled={!activityId}
            onClick={() => startTimer(Number(activityId), goalId ? Number(goalId) : undefined)}
          >
            Start timer
          </Button>
          {savedMsg && <span className="text-sm text-mute">{savedMsg}</span>}
        </div>
      </div>
    </Card>
  )
}
