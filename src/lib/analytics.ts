import type { Activity, Goal, TimeEntry } from '../db/schema'
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  formatMonthYear,
  formatShort,
  startOfMonth,
  startOfWeek,
} from './dates'

export interface Row {
  entry: TimeEntry
  activityName: string
  categoryId?: number
}

/** Attaches the activity name and category to each session. */
export function enrich(entries: TimeEntry[], activities: Activity[], goals: Goal[]): Row[] {
  const act = new Map(activities.map((a) => [a.id!, a]))
  const goal = new Map(goals.map((g) => [g.id!, g]))
  return entries.map((entry) => {
    const a = act.get(entry.activityId)
    const g = entry.goalId !== undefined ? goal.get(entry.goalId) : undefined
    return { entry, activityName: a?.name ?? 'Deleted activity', categoryId: a?.categoryId ?? g?.categoryId }
  })
}

export const sumSeconds = (rows: Row[]) => rows.reduce((t, r) => t + r.entry.durationSeconds, 0)

export function inRange(rows: Row[], from: string, to: string): Row[] {
  return rows.filter((r) => r.entry.date >= from && r.entry.date <= to)
}

/* ---------- Date ranges ---------- */

export type Preset = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'last30' | 'last90' | 'all' | 'custom'

export const PRESET_LABEL: Record<Preset, string> = {
  thisWeek: 'This week',
  lastWeek: 'Last week',
  thisMonth: 'This month',
  last30: 'Last 30 days',
  last90: 'Last 90 days',
  all: 'All time',
  custom: 'Custom range',
}

export function resolveRange(
  preset: Preset,
  today: string,
  weekStartsOn: 0 | 1,
  earliest: string | undefined,
  custom: { from: string; to: string },
): { from: string; to: string } {
  const ws = startOfWeek(today, weekStartsOn)
  switch (preset) {
    case 'thisWeek':
      return { from: ws, to: addDays(ws, 6) }
    case 'lastWeek':
      return { from: addDays(ws, -7), to: addDays(ws, -1) }
    case 'thisMonth':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'last30':
      return { from: addDays(today, -29), to: today }
    case 'last90':
      return { from: addDays(today, -89), to: today }
    case 'all':
      return { from: earliest ?? today, to: today }
    case 'custom':
      return custom
  }
}

/* ---------- Grouping ---------- */

export type Group = 'day' | 'week' | 'month'

export function autoGroup(from: string, to: string): Group {
  const days = daysBetween(from, to) + 1
  return days <= 14 ? 'day' : days <= 120 ? 'week' : 'month'
}

export function bucketStart(date: string, group: Group, weekStartsOn: 0 | 1): string {
  if (group === 'day') return date
  if (group === 'week') return startOfWeek(date, weekStartsOn)
  return startOfMonth(date)
}

export function bucketLabel(key: string, group: Group): string {
  if (group === 'month') return formatMonthYear(key)
  return group === 'week' ? `Wk ${formatShort(key)}` : formatShort(key)
}

function bucketList(from: string, to: string, group: Group, weekStartsOn: 0 | 1): string[] {
  const out: string[] = []
  let s = bucketStart(from, group, weekStartsOn)
  const step = (d: string) => (group === 'day' ? addDays(d, 1) : group === 'week' ? addDays(d, 7) : addMonths(d, 1))
  while (s <= to && out.length < 1000) {
    out.push(s)
    s = step(s)
  }
  return out
}

export interface Series {
  keys: string[] // activity names (largest first), maybe ending with "Other"
  data: Record<string, number | string>[] // hours per key per bucket
}

/** Time per bucket, split by activity. Only the biggest `topN` activities get their own colour. */
export function buildSeries(
  rows: Row[],
  from: string,
  to: string,
  group: Group,
  weekStartsOn: 0 | 1,
  topN = 6,
): Series {
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.activityName, (totals.get(r.activityName) ?? 0) + r.entry.durationSeconds)
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
  const top = ranked.slice(0, topN)
  const keys = ranked.length > topN ? [...top, 'Other'] : top

  const buckets = bucketList(from, to, group, weekStartsOn)
  const byBucket = new Map<string, Record<string, number | string>>(
    buckets.map((b) => [b, { bucket: b, label: bucketLabel(b, group) }]),
  )
  for (const r of rows) {
    const b = byBucket.get(bucketStart(r.entry.date, group, weekStartsOn))
    if (!b) continue
    const key = top.includes(r.activityName) ? r.activityName : 'Other'
    b[key] = Math.round((((b[key] as number) ?? 0) + r.entry.durationSeconds / 3600) * 1000) / 1000
  }
  return { keys, data: buckets.map((b) => byBucket.get(b)!) }
}

export function totalsBy(rows: Row[], keyOf: (r: Row) => string): { name: string; seconds: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(keyOf(r), (m.get(keyOf(r)) ?? 0) + r.entry.durationSeconds)
  return [...m.entries()].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds)
}

/* ---------- Planned vs actual ---------- */

export interface PlannedRow {
  goal: Goal
  plannedSeconds: number
  actualSeconds: number
}

/**
 * Planned time is the goal's weekly hours, prorated for the days of the range that fall
 * inside the goal's own dates, and never counting days after today.
 */
export function plannedVsActual(goals: Goal[], rows: Row[], from: string, to: string, today: string): PlannedRow[] {
  const end = to < today ? to : today
  const out: PlannedRow[] = []
  for (const goal of goals) {
    if (goal.archived || !goal.weeklyTargetMinutes) continue
    const s = goal.startDate > from ? goal.startDate : from
    let e = end
    if (goal.deadline && goal.deadline < e) e = goal.deadline
    const days = daysBetween(s, e) + 1
    const actualSeconds = sumSeconds(rows.filter((r) => r.entry.goalId === goal.id && r.entry.date >= from && r.entry.date <= to))
    if (days <= 0 && actualSeconds === 0) continue
    if (goal.status === 'paused' && actualSeconds === 0) continue
    out.push({
      goal,
      plannedSeconds: days > 0 ? Math.round((goal.weeklyTargetMinutes * 60 * days) / 7) : 0,
      actualSeconds,
    })
  }
  return out.sort((a, b) => b.plannedSeconds - a.plannedSeconds)
}
