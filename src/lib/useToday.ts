import { useEffect, useState } from 'react'
import { todayISO } from './dates'

/** Today's local date. Updates by itself after midnight. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO())
  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 30_000)
    return () => clearInterval(id)
  }, [])
  return today
}
