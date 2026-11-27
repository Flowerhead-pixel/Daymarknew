import { db } from '../db/db'

/** Deletes a goal and its milestones/history. Logged time is KEPT, just unlinked. */
export async function deleteGoalCascade(goalId: number) {
  await db.transaction('rw', db.goals, db.milestones, db.progressLogs, db.timeEntries, db.timers, async () => {
    await db.milestones.where('goalId').equals(goalId).delete()
    await db.progressLogs.where('goalId').equals(goalId).delete()
    await db.timeEntries
      .where('goalId')
      .equals(goalId)
      .modify((e) => {
        delete e.goalId
      })
    const t = await db.timers.get('current')
    if (t?.goalId === goalId) await db.timers.update('current', { goalId: undefined })
    await db.goals.delete(goalId)
  })
}
