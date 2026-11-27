import { Link, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { pauseTimer, resumeTimer, stopTimer, useTimer } from '../lib/timer'
import { formatClock } from '../lib/time'
import { Button } from './ui/Button'

/** A slim bar shown on every screen (except Time) while a timer exists. */
export function TimerBar() {
  const { timer, elapsedSeconds } = useTimer()
  const { pathname } = useLocation()
  const activity = useLiveQuery(
    () => (timer ? db.activities.get(timer.activityId) : undefined),
    [timer?.activityId],
  )
  if (!timer || pathname === '/time') return null

  return (
    <div className="sticky top-3 z-30 mb-6 flex items-center justify-between gap-2 rounded-full bg-ink py-2 pl-5 pr-2 text-paper shadow-lg">
      <Link to="/time" className="min-w-0 flex-1 truncate text-sm">
        <span className="opacity-60">{timer.state === 'running' ? 'Timing' : 'Paused'} · </span>
        {activity?.name ?? 'Activity'}
        <span className="ml-2 font-serif tabular-nums">{formatClock(elapsedSeconds)}</span>
      </Link>
      {timer.state === 'running' ? (
        <Button small variant="secondary" className="!border-white/30 !bg-transparent !text-paper" onClick={pauseTimer}>
          Pause
        </Button>
      ) : (
        <Button small className="!border-paper !bg-paper !text-ink" onClick={resumeTimer}>
          Resume
        </Button>
      )}
      <Button small className="!border-accent !bg-accent !text-white" onClick={() => stopTimer()}>
        Stop
      </Button>
    </div>
  )
}
