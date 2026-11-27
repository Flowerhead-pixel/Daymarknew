import type { AssessmentEntry } from '../db/schema'
import { addDays, daysBetween } from './dates'

// No intelligence score here, by design. These are plain facts about what you studied,
// how long it took, and how much you kept. Learning SPEED (gain per hour) is kept
// separate from hours invested.

export type MetricKey = 'baselinePct' | 'initialPct' | 'recall24Pct' | 'retention7Pct' | 'unfamiliarPct' | 'applicationPct'

export const METRICS: { key: MetricKey; label: string; hint: string }[] = [
  { key: 'baselinePct', label: 'Baseline knowledge', hint: 'A short quiz BEFORE studying: what you already knew.' },
  { key: 'initialPct', label: 'Initial accuracy', hint: 'The same kind of quiz right AFTER studying.' },
  { key: 'recall24Pct', label: '24-hour recall', hint: 'Quiz again about a day later, without revising.' },
  { key: 'retention7Pct', label: '7-day retention', hint: 'Quiz again about a week later, without revising.' },
  { key: 'unfamiliarPct', label: 'Unfamiliar questions', hint: 'Accuracy on new questions you had not seen, same topic.' },
  { key: 'applicationPct', label: 'Practical application', hint: 'Use it for real (write, speak, build). % done correctly.' },
]

export const WEEKS = [1, 2, 3, 4]

/** Which assessment week (1, 2, 3, ...) a date falls in, counting from the start date. */
export function weekOf(date: string, startDate: string): number {
  return Math.floor(daysBetween(startDate, date) / 7) + 1
}

/** Knowledge gained by studying, in percentage points. */
export function gain(e: AssessmentEntry): number | undefined {
  return e.baselinePct !== undefined && e.initialPct !== undefined ? e.initialPct - e.baselinePct : undefined
}

/** Points gained per hour studied. This is the speed measure. */
export function gainPerHour(e: AssessmentEntry): number | undefined {
  const g = gain(e)
  return g !== undefined && e.learningMinutes ? g / (e.learningMinutes / 60) : undefined
}

export interface Due {
  label: string
  date: string
  due: boolean // true once the date has arrived
}

/** The follow-up checks still to do for a cycle. Gentle reminders, nothing more. */
export function pendingChecks(e: AssessmentEntry, today: string): Due[] {
  const out: Due[] = []
  if (e.recall24Pct === undefined) {
    const date = addDays(e.date, 1)
    out.push({ label: '24-hour recall', date, due: today >= date })
  }
  if (e.retention7Pct === undefined) {
    const date = addDays(e.date, 7)
    out.push({ label: '7-day retention', date, due: today >= date })
  }
  return out
}

export interface WeekStat {
  week: number
  cycles: number
  minutes: number
  avg: Partial<Record<MetricKey, number>>
  gainPerHour?: number // total gain / total hours, over cycles that have both
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

export function weekStats(entries: AssessmentEntry[]): WeekStat[] {
  return WEEKS.map((week) => {
    const rows = entries.filter((e) => e.week === week)
    const avg: Partial<Record<MetricKey, number>> = {}
    for (const m of METRICS) {
      const v = mean(rows.map((r) => r[m.key]).filter((x): x is number => x !== undefined))
      if (v !== undefined) avg[m.key] = v
    }
    const both = rows.filter((r) => gain(r) !== undefined && r.learningMinutes)
    const hours = both.reduce((t, r) => t + (r.learningMinutes ?? 0) / 60, 0)
    const totalGain = both.reduce((t, r) => t + (gain(r) ?? 0), 0)
    return {
      week,
      cycles: rows.length,
      minutes: rows.reduce((t, r) => t + (r.learningMinutes ?? 0), 0),
      avg,
      gainPerHour: hours > 0 ? totalGain / hours : undefined,
    }
  })
}

export interface Evidence {
  label: string
  unit: string
  fromWeek: number
  toWeek: number
  from: number
  to: number
  verdict: 'higher' | 'lower' | 'similar'
}

/** Compares the first and the latest week that have data. Needs two different weeks. */
export function evidence(stats: WeekStat[]): Evidence[] {
  const items: { label: string; unit: string; pick: (s: WeekStat) => number | undefined; similar: number }[] = [
    { label: 'Learning speed (gain per hour)', unit: ' pts/h', pick: (s) => s.gainPerHour, similar: 2 },
    { label: '24-hour recall', unit: '%', pick: (s) => s.avg.recall24Pct, similar: 5 },
    { label: '7-day retention', unit: '%', pick: (s) => s.avg.retention7Pct, similar: 5 },
    { label: 'Unfamiliar questions', unit: '%', pick: (s) => s.avg.unfamiliarPct, similar: 5 },
    { label: 'Practical application', unit: '%', pick: (s) => s.avg.applicationPct, similar: 5 },
  ]
  const out: Evidence[] = []
  for (const it of items) {
    const withData = stats.filter((s) => it.pick(s) !== undefined)
    if (withData.length < 2) continue
    const a = withData[0]
    const b = withData[withData.length - 1]
    const from = it.pick(a)!
    const to = it.pick(b)!
    const d = to - from
    out.push({
      label: it.label,
      unit: it.unit,
      fromWeek: a.week,
      toWeek: b.week,
      from,
      to,
      verdict: Math.abs(d) < it.similar ? 'similar' : d > 0 ? 'higher' : 'lower',
    })
  }
  return out
}

export function parsePct(s: string): number | undefined | typeof Number.NaN {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : Number.NaN
}
