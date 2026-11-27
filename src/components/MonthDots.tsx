import { addDays, endOfMonth, fromISODate, startOfMonth, startOfWeek } from '../lib/dates'
import { useWeekStartsOn } from '../lib/settings'

/**
 * One dot per day of the current month.
 * Dark = you tracked time that day. Orange = today. Pale = nothing tracked. Outline = still to come.
 * Nothing here is a score: a pale dot is just a day without a logged session.
 */
export function MonthDots({ today, trackedDates }: { today: string; trackedDates: Set<string> }) {
  const weekStartsOn = useWeekStartsOn()
  const first = startOfMonth(today)
  const last = endOfMonth(today)
  const gridStart = startOfWeek(first, weekStartsOn)
  const days: string[] = []
  for (let d = gridStart; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d)

  const heads = weekStartsOn === 1 ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const tracked = days.filter((d) => d >= first && d <= today && trackedDates.has(d)).length

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-semibold text-mute">
        {heads.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2" role="img" aria-label={`Days with tracked time this month: ${tracked}`}>
        {days.map((d) => {
          if (d < first || d > last) return <span key={d} className="aspect-square" />
          const isToday = d === today
          const future = d > today
          const on = trackedDates.has(d)
          const cls = isToday ? 'bg-accent' : future ? 'border border-line bg-transparent' : on ? 'bg-ink' : 'bg-wash'
          return (
            <span key={d} title={fromISODate(d).toDateString()} className={`aspect-square rounded-full ${cls}`} />
          )
        })}
      </div>
      <p className="mt-3 text-xs text-mute">
        {tracked} {tracked === 1 ? 'day' : 'days'} with time tracked this month
      </p>
    </div>
  )
}
