import type { Goal } from '../db/schema'
import { formatNumber, formatValue } from './format'
import { formatDuration } from './time'

// Everything here is DERIVED from time entries and milestones. Nothing is stored twice,
// so a session can never be counted twice.
export interface GoalStats {
  timeSeconds: number // all linked time, ever
  weekSeconds: number // linked time this week
  weekSessions: number // linked sessions this week
  milestonesDone: number // top-level milestones only
  milestonesTotal: number
}

export const EMPTY_STATS: GoalStats = {
  timeSeconds: 0,
  weekSeconds: 0,
  weekSessions: 0,
  milestonesDone: 0,
  milestonesTotal: 0,
}

export interface Progress {
  percent: number | null // null = this goal has no percentage
  summary: string
}

export function computeProgress(goal: Goal, s: GoalStats): Progress {
  switch (goal.progressSource) {
    case 'time': {
      const hours = s.timeSeconds / 3600
      if (goal.targetValue && goal.targetValue > 0) {
        return {
          percent: (hours / goal.targetValue) * 100,
          summary: `${formatNumber(hours)} / ${formatNumber(goal.targetValue)} hours`,
        }
      }
      return { percent: null, summary: `${formatNumber(hours)} hours logged` }
    }
    case 'milestones': {
      if (s.milestonesTotal === 0) return { percent: null, summary: 'No milestones yet' }
      return {
        percent: (s.milestonesDone / s.milestonesTotal) * 100,
        summary: `${s.milestonesDone} / ${s.milestonesTotal} milestones`,
      }
    }
    case 'manual': {
      if (goal.targetValue && goal.targetValue > 0) {
        return {
          percent: (goal.currentValue / goal.targetValue) * 100,
          summary: `${formatValue(goal.currentValue, goal.unit)} / ${formatValue(goal.targetValue, goal.unit)}`,
        }
      }
      return { percent: null, summary: formatValue(goal.currentValue, goal.unit) }
    }
    case 'weekly': {
      if (goal.weeklyTargetSessions && goal.weeklyTargetSessions > 0) {
        return {
          percent: (s.weekSessions / goal.weeklyTargetSessions) * 100,
          summary: `${s.weekSessions} / ${goal.weeklyTargetSessions} sessions this week`,
        }
      }
      if (goal.weeklyTargetMinutes && goal.weeklyTargetMinutes > 0) {
        return {
          percent: (s.weekSeconds / 60 / goal.weeklyTargetMinutes) * 100,
          summary: `${formatDuration(s.weekSeconds)} / ${formatDuration(goal.weeklyTargetMinutes * 60)} this week`,
        }
      }
      return { percent: null, summary: 'No weekly target set' }
    }
    default:
      return { percent: null, summary: '' }
  }
}

export const clampPercent = (p: number) => Math.max(0, Math.min(100, p))
