import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { TimerState } from '../db/schema'
import { todayISO } from './dates'

// The timer is stored in the database as timestamps, not as a counter, so it keeps
// the right time even if the tab sleeps, the phone locks, or the app is closed.

export function elapsedMs(t: TimerState, now: number): number {
  return t.accumulatedMs + (t.state === 'running' ? Math.max(0, now - t.resumedAt) : 0)
}

export async function startTimer(activityId: number, goalId?: number) {
  await db.timers.put({
    id: 'current',
    activityId,
    goalId,
    state: 'running',
    accumulatedMs: 0,
    resumedAt: Date.now(),
    startDate: todayISO(),
  })
}

export async function pauseTimer() {
  const t = await db.timers.get('current')
  if (!t || t.state !== 'running') return
  await db.timers.put({ ...t, state: 'paused', accumulatedMs: elapsedMs(t, Date.now()) })
}

export async function resumeTimer() {
  const t = await db.timers.get('current')
  if (!t || t.state !== 'paused') return
  await db.timers.put({ ...t, state: 'running', resumedAt: Date.now() })
}

/** Saves the timer as a session and clears it. Returns saved seconds (0 = nothing saved). */
export async function stopTimer(): Promise<number> {
  const t = await db.timers.get('current')
  if (!t) return 0
  const seconds = Math.round(elapsedMs(t, Date.now()) / 1000)
  await db.transaction('rw', db.timers, db.timeEntries, async () => {
    if (seconds >= 1) {
      await db.timeEntries.add({
        activityId: t.activityId,
        goalId: t.goalId,
        date: t.startDate,
        durationSeconds: seconds,
        notes: t.notes ?? '',
        createdAt: Date.now(),
      })
    }
    await db.timers.delete('current')
  })
  return seconds
}

export async function discardTimer() {
  await db.timers.delete('current')
}

export function useTimer() {
  const timer = useLiveQuery(() => db.timers.get('current'), [])
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (timer?.state !== 'running') return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timer?.state, timer?.resumedAt])
  const elapsedSeconds = timer ? Math.floor(elapsedMs(timer, now) / 1000) : 0
  return { timer, elapsedSeconds }
}
