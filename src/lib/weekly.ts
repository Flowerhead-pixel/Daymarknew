import type { Activity, Goal, Milestone, ProgressLog, TimeEntry } from '../db/schema'
import { addDays, toISODate } from './dates'
import { enrich, plannedVsActual, sumSeconds, totalsBy, type PlannedRow } from './analytics'

export interface ProgressedGoal {
  goal: Goal
  seconds: number
  milestonesDone: number
  manualDelta?: number
}

export interface WeekSummary {
  weekStart: string
  weekEnd: string
  totalSeconds: number
  sessions: number
  byActivity: { name: string; seconds: number }[]
  progressed: ProgressedGoal[]
  milestones: { title: string; goalTitle: string }[]
  quiet: Goal[] // active goals with nothing logged this week
  planned: PlannedRow[]
}

export function summarizeWeek(
  weekStart: string,
  today: string,
  data: {
    entries: TimeEntry[]
    activities: Activity[]
    goals: Goal[]
    milestones: Milestone[]
    logs: ProgressLog[]
  },
): WeekSummary {
  const weekEnd = addDays(weekStart, 6)
  const rows = enrich(data.entries, data.activities, data.goals).filter(
    (r) => r.entry.date >= weekStart && r.entry.date <= weekEnd,
  )
  const goalTitle = new Map(data.goals.map((g) => [g.id!, g.title]))

  const doneThisWeek = data.milestones.filter((m) => {
    if (!m.done || !m.doneAt) return false
    const d = toISODate(new Date(m.doneAt))
    return d >= weekStart && d <= weekEnd
  })

  const progressed: ProgressedGoal[] = []
  const quiet: Goal[] = []
  for (const goal of data.goals) {
    if (goal.archived) continue
    const seconds = sumSeconds(rows.filter((r) => r.entry.goalId === goal.id))
    const milestonesDone = doneThisWeek.filter((m) => m.goalId === goal.id).length
    const logs = data.logs
      .filter((l) => l.goalId === goal.id)
      .sort((a, b) => (a.date === b.date ? (a.id ?? 0) - (b.id ?? 0) : a.date < b.date ? -1 : 1))
    const inWeek = logs.filter((l) => l.date >= weekStart && l.date <= weekEnd)
    let manualDelta: number | undefined
    if (inWeek.length > 0) {
      const before = [...logs].reverse().find((l) => l.date < weekStart)
      manualDelta = inWeek[inWeek.length - 1].value - (before?.value ?? 0)
    }
    if (seconds > 0 || milestonesDone > 0 || inWeek.length > 0) {
      progressed.push({ goal, seconds, milestonesDone, manualDelta })
    } else if (goal.status === 'active' && goal.startDate <= weekEnd) {
      quiet.push(goal)
    }
  }
  progressed.sort((a, b) => b.seconds - a.seconds)

  return {
    weekStart,
    weekEnd,
    totalSeconds: sumSeconds(rows),
    sessions: rows.length,
    byActivity: totalsBy(rows, (r) => r.activityName),
    progressed,
    milestones: doneThisWeek.map((m) => ({ title: m.title, goalTitle: goalTitle.get(m.goalId) ?? 'Deleted goal' })),
    quiet,
    planned: plannedVsActual(data.goals, rows, weekStart, weekEnd, today),
  }
}
