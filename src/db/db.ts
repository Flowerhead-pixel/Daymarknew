import Dexie, { type EntityTable } from 'dexie'
import type {
  Activity,
  Assessment,
  AssessmentEntry,
  Category,
  Goal,
  Milestone,
  DayPriority,
  ProgressLog,
  Setting,
  TimeEntry,
  TimerState,
  Unit,
  WeeklyReview,
} from './schema'

class DaymarkDB extends Dexie {
  categories!: EntityTable<Category, 'id'>
  units!: EntityTable<Unit, 'id'>
  goals!: EntityTable<Goal, 'id'>
  milestones!: EntityTable<Milestone, 'id'>
  activities!: EntityTable<Activity, 'id'>
  timeEntries!: EntityTable<TimeEntry, 'id'>
  timers!: EntityTable<TimerState, 'id'>
  progressLogs!: EntityTable<ProgressLog, 'id'>
  weeklyReviews!: EntityTable<WeeklyReview, 'id'>
  assessments!: EntityTable<Assessment, 'id'>
  assessmentEntries!: EntityTable<AssessmentEntry, 'id'>
  settings!: EntityTable<Setting, 'key'>
  priorities!: EntityTable<DayPriority, 'id'>

  constructor() {
    super('daymark')
    // Only fields you search/sort by are listed. Other fields are still saved.
    this.version(1).stores({
      categories: '++id, name',
      units: '++id, name',
      goals: '++id, categoryId, status, type, deadline',
      milestones: '++id, goalId, order',
      activities: '++id, name, categoryId',
      timeEntries: '++id, date, activityId, goalId',
      timers: 'id',
      progressLogs: '++id, goalId, date',
      weeklyReviews: '++id, &weekStart',
      assessments: '++id, goalId',
      assessmentEntries: '++id, assessmentId, date',
      settings: 'key',
    })
    // Version 2 adds the daily priorities table. Existing data is untouched.
    this.version(2).stores({
      priorities: '++id, date',
    })
  }
}

export const db = new DaymarkDB()

// Starter categories and units. These are editable settings, NOT sample goals or progress.
// Runs once, when the database is first created.
db.on('populate', (tx) => {
  const categories = ['Language', 'Creative', 'Work', 'Study', 'Health', 'Reading', 'Personal']
  const units = [
    'hours',
    'sessions',
    'books',
    'chapters',
    'pages',
    'videos',
    'tasks',
    '₹',
  ]
  tx.table('categories').bulkAdd(categories.map((name) => ({ name })))
  tx.table('units').bulkAdd(units.map((name) => ({ name })))
})
