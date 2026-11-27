import { db } from '../db/db'
import { todayISO } from './dates'

// Your Japanese and German plans. Nothing here runs by itself: it is only used when you
// press the button and confirm. Everything it creates is an ordinary goal, milestone or
// activity that you can edit or delete like any other. No progress is pre-filled.

export type LanguageKey = 'japanese' | 'german'

export interface LanguagePlan {
  key: LanguageKey
  goalTitle: string
  activityName: string
  description: string
  notes: string
  deadline: string // planned date (shown as a month)
  weeklyHours: number
  milestones: { title: string; dueDate: string }[]
}

export const PLANS: Record<LanguageKey, LanguagePlan> = {
  japanese: {
    key: 'japanese',
    goalTitle: 'JLPT N3',
    activityName: 'Japanese',
    description: 'Current level: N5 mostly complete, N4 in progress. Target: JLPT N3.',
    notes: 'July 2027 is a planned exam period, not a confirmed official examination date.',
    deadline: '2027-07-01',
    weeklyHours: 12,
    milestones: [
      { title: 'December 2026: Fix N5 gaps and establish N4 foundation', dueDate: '2026-12-31' },
      { title: 'January 2027: Complete N4 grammar and vocabulary', dueDate: '2027-01-31' },
      { title: 'February 2027: Consolidate N4 and begin N3', dueDate: '2027-02-28' },
      { title: 'March 2027: Study N3 grammar, vocabulary and kanji', dueDate: '2027-03-31' },
      { title: 'April 2027: Complete first pass of N3 syllabus', dueDate: '2027-04-30' },
      { title: 'May 2027: Intensive reading and listening', dueDate: '2027-05-31' },
      { title: 'June 2027: Mock tests and weak-area revision', dueDate: '2027-06-30' },
      { title: 'July 2027: Final revision and JLPT N3', dueDate: '2027-07-31' },
    ],
  },
  german: {
    key: 'german',
    goalTitle: 'German A2 (B1 if possible)',
    activityName: 'German',
    description: 'Current level: A1, chapters 4–7. Target: A2 minimum, B1 if possible.',
    notes: 'B1 work from April to June depends on university requirements.',
    deadline: '2027-03-31',
    weeklyHours: 4,
    milestones: [
      { title: 'December–January: Complete A1', dueDate: '2027-01-31' },
      { title: 'February–March: Complete A2', dueDate: '2027-03-31' },
      { title: 'April–June: Begin B1 (depending on university requirements)', dueDate: '2027-06-30' },
    ],
  },
}

/** Which plans already exist (matched by goal title), so they are never added twice. */
export async function existingPlans(): Promise<Record<LanguageKey, boolean>> {
  const goals = await db.goals.toArray()
  const has = (title: string) => goals.some((g) => g.title.trim().toLowerCase() === title.toLowerCase())
  return { japanese: has(PLANS.japanese.goalTitle), german: has(PLANS.german.goalTitle) }
}

/** Creates the chosen plans in one all-or-nothing step. Returns the new goal ids. */
export async function addLanguagePlans(choices: { key: LanguageKey; weeklyHours: number }[]): Promise<number[]> {
  return db.transaction('rw', db.categories, db.activities, db.goals, db.milestones, async () => {
    const category = (await db.categories.toArray()).find((c) => c.name.toLowerCase() === 'language')
    const categoryId = category?.id ?? ((await db.categories.add({ name: 'Language' })) as number)

    const ids: number[] = []
    const now = Date.now()
    for (const choice of choices) {
      const plan = PLANS[choice.key]

      const activities = await db.activities.toArray()
      const act = activities.find((a) => a.name.toLowerCase() === plan.activityName.toLowerCase())
      if (!act) await db.activities.add({ name: plan.activityName, categoryId, archived: false })
      else if (act.archived) await db.activities.update(act.id!, { archived: false })

      const goalId = (await db.goals.add({
        title: plan.goalTitle,
        description: plan.description,
        categoryId,
        type: 'project',
        startDate: todayISO(),
        deadline: plan.deadline,
        deadlineApprox: true,
        currentValue: 0,
        progressSource: 'milestones',
        weeklyTargetMinutes: Math.round(choice.weeklyHours * 60),
        priority: 'high',
        status: 'active',
        pinned: false,
        archived: false,
        notes: plan.notes,
        createdAt: now,
        updatedAt: now,
      })) as number

      await db.milestones.bulkAdd(
        plan.milestones.map((m, i) => ({ goalId, title: m.title, dueDate: m.dueDate, done: false, order: i })),
      )
      ids.push(goalId)
    }
    return ids
  })
}
