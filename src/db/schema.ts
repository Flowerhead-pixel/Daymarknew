// Types for every record stored in the database.
// Calendar dates are local "YYYY-MM-DD" strings. Exact moments are epoch milliseconds.

export type GoalType = 'deadline' | 'numeric' | 'habit' | 'project' | 'ongoing'
export type GoalStatus = 'active' | 'paused' | 'completed'
export type Priority = 'low' | 'medium' | 'high'
// Where a goal's progress comes from. 'none' = no percentage, just active/completed.
// 'weekly' = this week's sessions/hours against a weekly target (habits).
export type ProgressSource = 'manual' | 'time' | 'milestones' | 'weekly' | 'none'

export interface Category {
  id?: number
  name: string
}

export interface Unit {
  id?: number
  name: string
}

export interface Goal {
  id?: number
  title: string
  description: string
  categoryId?: number
  type: GoalType
  startDate: string
  deadline?: string
  targetValue?: number
  currentValue: number
  unit?: string
  progressSource: ProgressSource
  weeklyTargetMinutes?: number
  weeklyTargetSessions?: number
  // True when the deadline is only a planned month (shown as "July 2027").
  deadlineApprox?: boolean
  priority: Priority
  status: GoalStatus
  pinned: boolean
  archived: boolean
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Milestone {
  id?: number
  goalId: number
  parentId?: number
  title: string
  dueDate?: string
  done: boolean
  doneAt?: number
  order: number
}

export interface Activity {
  id?: number
  name: string
  categoryId?: number
  archived: boolean
}

export interface TimeEntry {
  id?: number
  activityId: number
  goalId?: number
  date: string
  durationSeconds: number
  notes: string
  createdAt: number
}

export interface TimerState {
  id: 'current'
  activityId: number
  goalId?: number
  state: 'running' | 'paused'
  // Time banked from earlier running periods, in ms.
  accumulatedMs: number
  // When the current running period began (epoch ms). Ignored while paused.
  resumedAt: number
  // Local date the timer was first started.
  startDate: string
  notes?: string
}

// A small to-do for one specific day ("Today's priorities").
export interface DayPriority {
  id?: number
  date: string
  text: string
  done: boolean
  createdAt: number
}

export interface ProgressLog {
  id?: number
  goalId: number
  date: string
  value: number
  note: string
}

export interface WeeklyReview {
  id?: number
  weekStart: string
  accomplished: string
  wentWrong: string
  learned: string
  nextFocus: string
  createdAt: number
  updatedAt: number
}

export interface Assessment {
  id?: number
  title: string
  goalId?: number
  startDate: string
  notes: string
}

// One "learning cycle": a topic you studied, with the checks taken around it.
// All percentages are 0-100 and every check is optional (fill them in as they come due).
export interface AssessmentEntry {
  id?: number
  assessmentId: number
  week: number // 1-4
  topic: string
  date: string // day you studied it
  learningMinutes?: number
  baselinePct?: number // what you already knew, before studying
  initialPct?: number // accuracy right after studying
  recall24Pct?: number // recall about 24 hours later
  retention7Pct?: number // retention about 7 days later
  unfamiliarPct?: number // accuracy on questions you had not seen before
  applicationPct?: number // how well you used it in a real task
  notes: string
}

export interface Setting {
  key: string
  value: unknown
}
