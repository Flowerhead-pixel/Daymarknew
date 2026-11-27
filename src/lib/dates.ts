// Date helpers. Calendar dates are LOCAL "YYYY-MM-DD" strings, so they never shift
// by a day because of timezones. (Do not use toISOString() for calendar dates.)

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

/** Turns "2026-11-27" into a Date at local midnight. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Whole days from one date to another (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const a = fromISODate(from)
  const b = fromISODate(to)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** First day of the week containing `iso`. weekStartsOn: 1 = Monday, 0 = Sunday. */
export function startOfWeek(iso: string, weekStartsOn: 0 | 1 = 1): string {
  const d = fromISODate(iso)
  const diff = (d.getDay() - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return toISODate(d)
}

export function startOfMonth(iso: string): string {
  const d = fromISODate(iso)
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function formatLong(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatWeekday(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-GB', { weekday: 'long' })
}

export function formatMonthYear(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function addMonths(iso: string, months: number): string {
  const d = fromISODate(iso)
  return toISODate(new Date(d.getFullYear(), d.getMonth() + months, 1))
}

export function endOfMonth(iso: string): string {
  return addDays(addMonths(startOfMonth(iso), 1), -1)
}

/** "27 Nov" */
export function formatShort(iso: string): string {
  return fromISODate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** "23 – 29 Nov 2026" (or across months/years when needed). */
export function formatRange(from: string, to: string): string {
  const a = fromISODate(from)
  const b = fromISODate(to)
  const sameYear = a.getFullYear() === b.getFullYear()
  const left = a.toLocaleDateString('en-GB', { day: 'numeric', ...(a.getMonth() !== b.getMonth() || !sameYear ? { month: 'short' } : {}), ...(sameYear ? {} : { year: 'numeric' }) })
  const right = b.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${left} – ${right}`
}
