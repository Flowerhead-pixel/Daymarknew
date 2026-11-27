import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { startOfWeek } from './dates'
import { EMPTY_STATS, type GoalStats } from './progress'
import { useWeekStartsOn } from './settings'
import { useToday } from './useToday'

/** All goals with their derived stats. Returns undefined while loading. */
export function useGoalData() {
  const today = useToday()
  const weekStartsOn = useWeekStartsOn()
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const entries = useLiveQuery(() => db.timeEntries.toArray(), [])
  const milestones = useLiveQuery(() => db.milestones.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  return useMemo(() => {
    if (!goals || !entries || !milestones || !categories) return undefined
    const weekStart = startOfWeek(today, weekStartsOn)
    const stats = new Map<number, GoalStats>()
    const get = (id: number) => {
      let s = stats.get(id)
      if (!s) {
        s = { ...EMPTY_STATS }
        stats.set(id, s)
      }
      return s
    }
    for (const e of entries) {
      if (e.goalId === undefined) continue
      const s = get(e.goalId)
      s.timeSeconds += e.durationSeconds
      if (e.date >= weekStart) {
        s.weekSeconds += e.durationSeconds
        s.weekSessions += 1
      }
    }
    for (const m of milestones) {
      if (m.parentId !== undefined) continue // tasks under a milestone don't count
      const s = get(m.goalId)
      s.milestonesTotal += 1
      if (m.done) s.milestonesDone += 1
    }
    const catNames = new Map(categories.map((c) => [c.id!, c.name]))
    return {
      today,
      weekStart,
      goals,
      statsOf: (id: number): GoalStats => stats.get(id) ?? EMPTY_STATS,
      categoryName: (id?: number) => (id !== undefined ? (catNames.get(id) ?? 'Uncategorised') : 'Uncategorised'),
    }
  }, [goals, entries, milestones, categories, today, weekStartsOn])
}
