import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

/** 1 = Monday (default), 0 = Sunday. */
export function useWeekStartsOn(): 0 | 1 {
  const s = useLiveQuery(() => db.settings.get('weekStartsOn'), [])
  return s?.value === 0 ? 0 : 1
}

export function setWeekStartsOn(v: 0 | 1) {
  return db.settings.put({ key: 'weekStartsOn', value: v })
}
