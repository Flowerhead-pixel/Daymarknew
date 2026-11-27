import type { Goal, GoalType, Priority } from '../db/schema'
import { daysBetween, formatLong, formatMonthYear } from './dates'
import { plural } from './format'

export type Tone = 'past' | 'soon' | 'normal'

export const TYPE_LABEL: Record<GoalType, string> = {
  deadline: 'Deadline',
  numeric: 'Numeric',
  habit: 'Habit',
  project: 'Project',
  ongoing: 'Ongoing',
}

export const STATUS_LABEL = { active: 'Active', paused: 'Paused', completed: 'Completed' } as const

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/** "27 November 2026", or "July 2027 (planned)" for approximate deadlines. */
export function deadlineText(goal: Goal): string | null {
  if (!goal.deadline) return null
  return goal.deadlineApprox ? `${formatMonthYear(goal.deadline)} (planned)` : formatLong(goal.deadline)
}

export function deadlineInfo(goal: Goal, today: string): { text: string; tone: Tone; days?: number } {
  if (goal.status === 'completed') return { text: 'Completed', tone: 'normal' }
  if (!goal.deadline) {
    return { text: goal.type === 'ongoing' ? 'Ongoing' : 'No deadline', tone: 'normal' }
  }
  const days = daysBetween(today, goal.deadline)
  if (days < 0) {
    return { text: `${plural(-days, 'day')} past the date`, tone: 'past', days }
  }
  if (days === 0) return { text: 'Due today', tone: 'soon', days }
  if (days <= 30) return { text: `Approaching · ${plural(days, 'day')} left`, tone: 'soon', days }
  return { text: `${plural(days, 'day')} remaining`, tone: 'normal', days }
}

export function isPast(goal: Goal, today: string): boolean {
  return !!goal.deadline && goal.status !== 'completed' && goal.deadline < today
}

/** Nearest deadline first; goals without a deadline last, by priority then title. */
export function compareGoals(a: Goal, b: Goal): number {
  if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1
  if (a.deadline && !b.deadline) return -1
  if (!a.deadline && b.deadline) return 1
  const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  return p !== 0 ? p : a.title.localeCompare(b.title)
}
