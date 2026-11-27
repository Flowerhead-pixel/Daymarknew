import { describe, expect, it } from 'vitest'
import type { Goal, TimeEntry } from '../db/schema'
import { addDays, daysBetween, formatRange, startOfWeek, toISODate, fromISODate } from './dates'
import { compareGoals, deadlineInfo, deadlineText } from './deadline'
import { buildSeries, autoGroup, enrich, plannedVsActual, resolveRange } from './analytics'
import { computeProgress, EMPTY_STATS } from './progress'
import { summarizeWeek } from './weekly'
import { evidence, gain, gainPerHour, parsePct, pendingChecks, weekOf, weekStats } from './assessment'
import { formatDuration, formatClock } from './time'
import { formatValue } from './format'
import { elapsedMs } from './timer'

const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 1, title: 'G', description: '', type: 'numeric', startDate: '2026-11-01', currentValue: 0,
  progressSource: 'time', priority: 'medium', status: 'active', pinned: false, archived: false,
  notes: '', createdAt: 0, updatedAt: 0, ...o,
})
const entry = (id: number, date: string, activityId: number, mins: number, goalId?: number): TimeEntry => ({
  id, activityId, goalId, date, durationSeconds: mins * 60, notes: '', createdAt: id,
})
const acts = [{ id: 1, name: 'Drawing', archived: false }, { id: 2, name: 'Japanese', archived: false }]

describe('dates (local, timezone-safe)', () => {
  it('round-trips a calendar date without shifting a day', () => {
    expect(toISODate(fromISODate('2026-11-27'))).toBe('2026-11-27')
    expect(toISODate(fromISODate('2027-03-01'))).toBe('2027-03-01')
  })
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
  })
  it('counts whole days, including negative', () => {
    expect(daysBetween('2026-11-27', '2027-07-01')).toBe(216)
    expect(daysBetween('2026-11-27', '2026-11-20')).toBe(-7)
  })
  it('finds the start of the week for Monday and Sunday', () => {
    expect(startOfWeek('2026-11-27', 1)).toBe('2026-11-23')
    expect(startOfWeek('2026-11-27', 0)).toBe('2026-11-22')
    expect(startOfWeek('2026-11-22', 1)).toBe('2026-11-16')
  })
  it('formats ranges', () => expect(formatRange('2026-11-23', '2026-11-29')).toBe('23 – 29 Nov 2026'))
})

describe('time formatting', () => {
  it('formats durations and the clock', () => {
    expect(formatDuration(5400)).toBe('1h 30m')
    expect(formatDuration(7200)).toBe('2h')
    expect(formatDuration(0)).toBe('0m')
    expect(formatClock(3725)).toBe('01:02:05')
  })
  it('formats values with units', () => {
    expect(formatValue(20000, '₹')).toBe('₹20,000')
    expect(formatValue(72, 'hours')).toBe('72 hours')
  })
})

describe('timer survives pauses and sleep', () => {
  const base = { id: 'current' as const, activityId: 1, startDate: '2026-11-27' }
  it('running = banked + elapsed since resume', () => {
    expect(elapsedMs({ ...base, state: 'running', accumulatedMs: 60_000, resumedAt: 1_000 }, 31_000)).toBe(90_000)
  })
  it('paused = banked only, however long you wait', () => {
    expect(elapsedMs({ ...base, state: 'paused', accumulatedMs: 60_000, resumedAt: 1_000 }, 9_999_999)).toBe(60_000)
  })
})

describe('goal progress (derived, never double counted)', () => {
  it('time goals add up linked seconds once', () => {
    const p = computeProgress(goal({ targetValue: 100 }), { ...EMPTY_STATS, timeSeconds: 90 * 60 })
    expect(p.percent).toBeCloseTo(1.5)
    expect(p.summary).toBe('1.5 / 100 hours')
  })
  it('manual goals use the stored number', () => {
    const p = computeProgress(goal({ progressSource: 'manual', targetValue: 20, currentValue: 5, unit: 'books' }), EMPTY_STATS)
    expect(p.percent).toBe(25)
    expect(p.summary).toBe('5 books / 20 books')
  })
  it('milestone goals count top-level done / total', () => {
    const p = computeProgress(goal({ progressSource: 'milestones' }), { ...EMPTY_STATS, milestonesDone: 1, milestonesTotal: 4 })
    expect(p.percent).toBe(25)
    expect(computeProgress(goal({ progressSource: 'milestones' }), EMPTY_STATS).percent).toBeNull()
  })
  it('habits track this week against the weekly target', () => {
    const p = computeProgress(goal({ progressSource: 'weekly', weeklyTargetSessions: 3 }), { ...EMPTY_STATS, weekSessions: 2 })
    expect(p.percent).toBeCloseTo(66.67, 1)
  })
  it('goals with no percentage stay percentage-free', () => {
    expect(computeProgress(goal({ progressSource: 'none' }), EMPTY_STATS).percent).toBeNull()
  })
})

describe('deadlines', () => {
  it('describes remaining, approaching, due and past gently', () => {
    const t = '2026-11-27'
    expect(deadlineInfo(goal({ deadline: '2027-07-01' }), t).text).toBe('216 days remaining')
    expect(deadlineInfo(goal({ deadline: '2026-12-10' }), t)).toMatchObject({ tone: 'soon' })
    expect(deadlineInfo(goal({ deadline: t }), t).text).toBe('Due today')
    expect(deadlineInfo(goal({ deadline: '2026-11-20' }), t)).toMatchObject({ text: '7 days past the date', tone: 'past' })
    expect(deadlineInfo(goal({ type: 'ongoing' }), t).text).toBe('Ongoing')
    expect(deadlineInfo(goal({ status: 'completed', deadline: '2020-01-01' }), t).text).toBe('Completed')
  })
  it('shows an approximate deadline as a planned month', () => {
    expect(deadlineText(goal({ deadline: '2027-07-01', deadlineApprox: true }))).toBe('July 2027 (planned)')
  })
  it('sorts nearest deadline first, undated last', () => {
    const a = goal({ id: 1, title: 'a', deadline: '2027-01-01' })
    const b = goal({ id: 2, title: 'b', deadline: '2026-12-01' })
    const c = goal({ id: 3, title: 'c' })
    expect([a, c, b].sort(compareGoals).map((g) => g.title)).toEqual(['b', 'a', 'c'])
  })
})

describe('analytics', () => {
  const goals = [goal({ id: 1, title: 'Draw', weeklyTargetMinutes: 420 }), goal({ id: 2, title: 'Quiet' })]
  const entries = [entry(1, '2026-11-23', 1, 90, 1), entry(2, '2026-11-24', 2, 60), entry(3, '2026-11-24', 1, 30, 1), entry(4, '2026-11-16', 1, 600, 1)]
  const rows = enrich(entries, acts, goals)

  it('resolves ranges', () => {
    const none = { from: '', to: '' }
    expect(resolveRange('thisWeek', '2026-11-27', 1, undefined, none)).toEqual({ from: '2026-11-23', to: '2026-11-29' })
    expect(resolveRange('lastWeek', '2026-11-27', 1, undefined, none)).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    expect(resolveRange('thisMonth', '2026-11-27', 1, undefined, none)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })
  it('chooses a readable grouping', () => {
    expect(autoGroup('2026-11-23', '2026-11-29')).toBe('day')
    expect(autoGroup('2026-10-01', '2026-11-30')).toBe('week')
    expect(autoGroup('2025-01-01', '2026-11-30')).toBe('month')
  })
  it('builds a daily series with empty days included', () => {
    const s = buildSeries(rows.filter((r) => r.entry.date >= '2026-11-23'), '2026-11-23', '2026-11-29', 'day', 1)
    expect(s.data).toHaveLength(7)
    expect(s.keys).toEqual(['Drawing', 'Japanese'])
    expect(s.data[0].Drawing).toBe(1.5)
    expect(s.data[1].Japanese).toBe(1)
  })
  it('folds small activities into Other', () => {
    expect(buildSeries(rows, '2026-11-16', '2026-11-29', 'day', 1, 1).keys).toEqual(['Drawing', 'Other'])
  })
  it('prorates planned time to today', () => {
    const p = plannedVsActual(goals, rows, '2026-11-23', '2026-11-29', '2026-11-27')
    expect([p[0].plannedSeconds / 3600, p[0].actualSeconds / 3600]).toEqual([5, 2])
  })
})

describe('weekly summary', () => {
  it('totals the week, flags moved and quiet goals', () => {
    const goals = [goal({ id: 1, title: 'Draw' }), goal({ id: 2, title: 'Quiet one' })]
    const entries = [entry(1, '2026-11-23', 1, 90, 1), entry(2, '2026-11-24', 2, 60), entry(3, '2026-11-24', 1, 30, 1), entry(4, '2026-11-16', 1, 600, 1)]
    const s = summarizeWeek('2026-11-23', '2026-11-27', {
      entries, activities: acts, goals, milestones: [], logs: [{ id: 1, goalId: 2, date: '2026-11-10', value: 0, note: '' }],
    })
    expect(s.totalSeconds / 60).toBe(180)
    expect(s.sessions).toBe(3)
    expect(s.progressed.map((x) => x.goal.title)).toEqual(['Draw'])
    expect(s.quiet.map((g) => g.title)).toEqual(['Quiet one'])
  })
})

describe('assessment', () => {
  const e = (o: object) => ({ assessmentId: 1, week: 1, topic: 't', date: '2026-12-01', notes: '', ...o }) as never
  it('assigns weeks from the start date', () => {
    expect(weekOf('2026-12-01', '2026-12-01')).toBe(1)
    expect(weekOf('2026-12-07', '2026-12-01')).toBe(1)
    expect(weekOf('2026-12-08', '2026-12-01')).toBe(2)
  })
  it('separates gain from speed', () => {
    expect(gain(e({ baselinePct: 30, initialPct: 80 }))).toBe(50)
    expect(gainPerHour(e({ baselinePct: 30, initialPct: 80, learningMinutes: 120 }))).toBe(25)
    expect(gainPerHour(e({ baselinePct: 30, initialPct: 80 }))).toBeUndefined()
  })
  it('lists follow-up checks still to do', () => {
    expect(pendingChecks(e({ date: '2026-12-01', recall24Pct: 70 }), '2026-12-05').map((x) => [x.label, x.due])).toEqual([['7-day retention', false]])
    expect(pendingChecks(e({ date: '2026-12-01' }), '2026-12-02').map((x) => x.due)).toEqual([true, false])
  })
  it('compares first and latest week, and needs two weeks', () => {
    const rows = [
      e({ week: 1, baselinePct: 20, initialPct: 60, learningMinutes: 120, retention7Pct: 40 }),
      e({ week: 1, baselinePct: 20, initialPct: 40, learningMinutes: 60 }),
      e({ week: 3, baselinePct: 30, initialPct: 90, learningMinutes: 60, retention7Pct: 80 }),
    ]
    const stats = weekStats(rows)
    expect(Math.round(stats[0].gainPerHour!)).toBe(20)
    const speed = evidence(stats).find((x) => x.label.startsWith('Learning'))!
    expect([speed.fromWeek, speed.toWeek, speed.verdict]).toEqual([1, 3, 'higher'])
    expect(evidence(weekStats([rows[0]]))).toHaveLength(0)
  })
  it('validates percentages', () => {
    expect(parsePct('')).toBeUndefined()
    expect(parsePct('50')).toBe(50)
    expect(Number.isNaN(parsePct('101'))).toBe(true)
    expect(Number.isNaN(parsePct('abc'))).toBe(true)
  })
})
