import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Goal, Milestone } from '../db/schema'
import { formatLong, toISODate, todayISO } from '../lib/dates'
import { deadlineInfo, deadlineText, STATUS_LABEL, TYPE_LABEL } from '../lib/deadline'
import { formatNumber, formatValue, plural } from '../lib/format'
import { deleteGoalCascade } from '../lib/goalActions'
import { computeProgress, type GoalStats } from '../lib/progress'
import { formatDuration } from '../lib/time'
import { useGoalData } from '../lib/useGoalData'
import { Button } from '../components/ui/Button'
import { Card, SectionTitle } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { ProgressBar } from '../components/ui/ProgressBar'
import { GoalForm } from '../components/GoalForm'
import { TimeEntryForm } from '../components/TimeEntryForm'

/* ---------- Milestones ---------- */

function MilestoneSection({ goal }: { goal: Goal }) {
  const all = useLiveQuery(() => db.milestones.where('goalId').equals(goal.id!).sortBy('order'), [goal.id])
  const [editMode, setEditMode] = useState(false)
  const [text, setText] = useState('')
  const [taskFor, setTaskFor] = useState<number | null>(null)
  const [taskText, setTaskText] = useState('')
  const [renaming, setRenaming] = useState<{ id: number; title: string } | null>(null)
  const [toDelete, setToDelete] = useState<Milestone | null>(null)

  const top = (all ?? []).filter((m) => m.parentId === undefined)
  const childrenOf = (id: number) => (all ?? []).filter((m) => m.parentId === id)
  const nextOrder = (rows: Milestone[]) => (rows.length ? Math.max(...rows.map((r) => r.order)) + 1 : 0)

  async function add(parentId?: number) {
    const title = (parentId === undefined ? text : taskText).trim()
    if (!title) return
    const siblings = (all ?? []).filter((m) => m.parentId === parentId)
    await db.milestones.add({ goalId: goal.id!, parentId, title, done: false, order: nextOrder(siblings) })
    if (parentId === undefined) setText('')
    else {
      setTaskText('')
      setTaskFor(null)
    }
  }

  async function toggle(m: Milestone) {
    await db.milestones.update(m.id!, { done: !m.done, doneAt: m.done ? undefined : Date.now() })
  }

  async function move(m: Milestone, dir: -1 | 1) {
    const siblings = (all ?? []).filter((x) => x.parentId === m.parentId)
    const i = siblings.findIndex((x) => x.id === m.id)
    const other = siblings[i + dir]
    if (!other) return
    await db.transaction('rw', db.milestones, async () => {
      await db.milestones.update(m.id!, { order: other.order })
      await db.milestones.update(other.id!, { order: m.order })
    })
  }

  async function remove(m: Milestone) {
    await db.milestones.where('parentId').equals(m.id!).delete()
    await db.milestones.delete(m.id!)
  }

  const doneCount = top.filter((m) => m.done).length
  const allDone = top.length > 0 && doneCount === top.length && goal.status !== 'completed'

  const Row = ({ m, child }: { m: Milestone; child?: boolean }) => {
    const siblings = (all ?? []).filter((x) => x.parentId === m.parentId)
    const i = siblings.findIndex((x) => x.id === m.id)
    const kids = child ? [] : childrenOf(m.id!)
    const r = renaming && renaming.id === m.id ? renaming : null
    return (
      <li className={child ? 'ml-7' : ''}>
        <div className="flex items-start gap-3 py-1.5">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-black"
            checked={m.done}
            onChange={() => toggle(m)}
            aria-label={`Mark "${m.title}" done`}
          />
          <div className="min-w-0 flex-1">
            {r ? (
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1"
                  value={r.title}
                  autoFocus
                  onChange={(e) => setRenaming({ id: m.id!, title: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && r.title.trim()) {
                      await db.milestones.update(m.id!, { title: r.title.trim() })
                      setRenaming(null)
                    }
                  }}
                />
                <Button
                  small
                  variant="primary"
                  disabled={!r.title.trim()}
                  onClick={async () => {
                    await db.milestones.update(m.id!, { title: r.title.trim() })
                    setRenaming(null)
                  }}
                >
                  Save
                </Button>
              </div>
            ) : (
              <p className={m.done ? 'text-mute line-through' : ''}>
                {m.title}
                {kids.length > 0 && (
                  <span className="ml-2 text-xs text-mute no-underline">
                    {kids.filter((k) => k.done).length}/{kids.length}
                  </span>
                )}
              </p>
            )}
            {editMode && !r && (
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <input
                  type="date"
                  aria-label="Due date"
                  className="py-0.5 text-xs"
                  value={m.dueDate ?? ''}
                  onChange={(e) => db.milestones.update(m.id!, { dueDate: e.target.value || undefined })}
                />
                <Button small variant="ghost" onClick={() => setRenaming({ id: m.id!, title: m.title })}>
                  Rename
                </Button>
                <Button small variant="ghost" disabled={i === 0} onClick={() => move(m, -1)}>
                  Up
                </Button>
                <Button small variant="ghost" disabled={i === siblings.length - 1} onClick={() => move(m, 1)}>
                  Down
                </Button>
                {!child && (
                  <Button small variant="ghost" onClick={() => setTaskFor(taskFor === m.id ? null : m.id!)}>
                    Add task
                  </Button>
                )}
                <Button small variant="ghost" onClick={() => (kids.length ? setToDelete(m) : remove(m))}>
                  Delete
                </Button>
              </div>
            )}
            {!editMode && m.dueDate && !m.done && <p className="text-xs text-mute">Due {formatLong(m.dueDate)}</p>}
          </div>
        </div>
        {kids.length > 0 && <ul>{kids.map((k) => <Row key={k.id} m={k} child />)}</ul>}
        {taskFor === m.id && (
          <div className="ml-7 flex gap-2 pb-2">
            <input
              className="min-w-0 flex-1"
              placeholder="Task under this milestone"
              value={taskText}
              autoFocus
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add(m.id!)}
            />
            <Button small variant="primary" disabled={!taskText.trim()} onClick={() => add(m.id!)}>
              Add
            </Button>
          </div>
        )}
      </li>
    )
  }

  return (
    <Card>
      <SectionTitle
        action={
          top.length > 0 && (
            <Button small variant="ghost" onClick={() => setEditMode((v) => !v)}>
              {editMode ? 'Done editing' : 'Edit list'}
            </Button>
          )
        }
      >
        Milestones
      </SectionTitle>
      {top.length === 0 && (
        <p className="mb-3 text-sm text-mute">
          Break this goal into steps. For a manga: outline, character designs, thumbnails, pages, publish.
        </p>
      )}
      <ul>{top.map((m) => <Row key={m.id} m={m} />)}</ul>
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1"
          placeholder="Add a milestone"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button variant="primary" disabled={!text.trim()} onClick={() => add()}>
          Add
        </Button>
      </div>
      {allDone && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <span className="text-sm">All milestones are done.</span>
          <Button small variant="primary" onClick={() => db.goals.update(goal.id!, { status: 'completed', updatedAt: Date.now() })}>
            Mark goal complete
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.title}"?`}
        message="Its tasks are deleted too."
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await remove(toDelete)
          setToDelete(null)
        }}
      />
    </Card>
  )
}

/* ---------- Manual progress ---------- */

function ManualProgress({ goal }: { goal: Goal }) {
  const [mode, setMode] = useState<'add' | 'set'>('add')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    const n = Number(amount)
    if (amount.trim() === '' || !Number.isFinite(n)) return setError('Enter a number.')
    const value = mode === 'add' ? goal.currentValue + n : n
    await db.transaction('rw', db.goals, db.progressLogs, async () => {
      await db.goals.update(goal.id!, { currentValue: value, updatedAt: Date.now() })
      await db.progressLogs.add({ goalId: goal.id!, date: todayISO(), value, note: note.trim() })
    })
    setAmount('')
    setNote('')
    setError('')
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-2 text-sm font-medium">Update progress</p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Update mode"
          className="py-1.5"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'add' | 'set')}
        >
          <option value="add">Add</option>
          <option value="set">Set total to</option>
        </select>
        <input
          inputMode="decimal"
          className="w-28"
          placeholder={goal.unit ? goal.unit : 'amount'}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <input
          className="min-w-0 flex-1"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button variant="primary" onClick={submit}>
          Save
        </Button>
      </div>
      {error && <p className="mt-2 text-sm">{error}</p>}
    </div>
  )
}

/* ---------- Notes ---------- */

function NotesBox({ goal }: { goal: Goal }) {
  const [value, setValue] = useState(goal.notes)
  const [saved, setSaved] = useState(false)
  return (
    <Card>
      <SectionTitle action={saved && <span className="text-xs text-mute">Saved</span>}>Notes</SectionTitle>
      <textarea
        className="w-full"
        rows={4}
        value={value}
        placeholder="Anything worth remembering about this goal"
        onChange={(e) => {
          setValue(e.target.value)
          setSaved(false)
        }}
        onBlur={async () => {
          if (value !== goal.notes) {
            await db.goals.update(goal.id!, { notes: value, updatedAt: Date.now() })
            setSaved(true)
          }
        }}
      />
    </Card>
  )
}

/* ---------- Time ---------- */

function TimeSection({ goal, stats }: { goal: Goal; stats: GoalStats }) {
  const entries = useLiveQuery(() => db.timeEntries.where('goalId').equals(goal.id!).toArray(), [goal.id])
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const [logging, setLogging] = useState(false)

  const recent = useMemo(
    () => [...(entries ?? [])].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 8),
    [entries],
  )
  const byActivity = useMemo(() => {
    const m = new Map<number, number>()
    for (const e of entries ?? []) m.set(e.activityId, (m.get(e.activityId) ?? 0) + e.durationSeconds)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [entries])
  const name = (id: number) => activities?.find((a) => a.id === id)?.name ?? 'Deleted activity'
  const planned = goal.weeklyTargetMinutes ? goal.weeklyTargetMinutes * 60 : undefined

  return (
    <Card>
      <SectionTitle
        action={
          <Button small onClick={() => setLogging(true)}>
            Log time
          </Button>
        }
      >
        Time invested
      </SectionTitle>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-mute">Total</p>
          <p className="font-serif text-2xl">{formatDuration(stats.timeSeconds)}</p>
        </div>
        <div>
          <p className="text-xs text-mute">This week{planned ? ` (plan ${formatDuration(planned)})` : ''}</p>
          <p className="font-serif text-2xl">{formatDuration(stats.weekSeconds)}</p>
        </div>
      </div>
      {byActivity.length > 1 && (
        <p className="mb-3 text-sm text-mute">
          {byActivity.map(([id, s]) => `${name(id)} ${formatDuration(s)}`).join(' · ')}
        </p>
      )}
      {recent.length === 0 ? (
        <p className="text-sm text-mute">No time linked yet. Link sessions to this goal from the Time screen.</p>
      ) : (
        <ul className="divide-y divide-line">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="text-mute">{formatLong(e.date)} · </span>
                {name(e.activityId)}
                {e.notes && <span className="text-mute"> · {e.notes}</span>}
              </span>
              <span className="shrink-0 tabular-nums">{formatDuration(e.durationSeconds)}</span>
            </li>
          ))}
        </ul>
      )}
      {logging && (
        <Modal title="Log time" onClose={() => setLogging(false)}>
          <TimeEntryForm defaultGoalId={goal.id} onDone={() => setLogging(false)} />
        </Modal>
      )}
    </Card>
  )
}

/* ---------- History ---------- */

function HistorySection({ goal }: { goal: Goal }) {
  const logs = useLiveQuery(() => db.progressLogs.where('goalId').equals(goal.id!).toArray(), [goal.id])
  const miles = useLiveQuery(() => db.milestones.where('goalId').equals(goal.id!).toArray(), [goal.id])

  const events = useMemo(() => {
    const out: { date: string; order: number; text: string }[] = [
      { date: toISODate(new Date(goal.createdAt)), order: goal.createdAt, text: 'Goal created' },
    ]
    for (const l of logs ?? []) {
      out.push({
        date: l.date,
        order: l.id ?? 0,
        text: `Progress set to ${formatValue(l.value, goal.unit)}${l.note ? ` · ${l.note}` : ''}`,
      })
    }
    for (const m of miles ?? []) {
      if (m.done && m.doneAt) {
        out.push({
          date: toISODate(new Date(m.doneAt)),
          order: m.doneAt,
          text: `${m.parentId === undefined ? 'Milestone' : 'Task'} completed: ${m.title}`,
        })
      }
    }
    // Newest first. Logs sort by id inside a day, others by time; fine for reading.
    return out.sort((a, b) => (a.date === b.date ? b.order - a.order : a.date < b.date ? 1 : -1))
  }, [goal, logs, miles])

  return (
    <Card>
      <SectionTitle>Progress history</SectionTitle>
      <ul className="divide-y divide-line">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3 py-2 text-sm">
            <span className="w-28 shrink-0 text-mute">{formatLong(e.date)}</span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* ---------- Page ---------- */

export function GoalDetail() {
  const { id } = useParams()
  const goalId = Number(id)
  const navigate = useNavigate()
  const data = useGoalData()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pinError, setPinError] = useState('')

  const goal = data?.goals.find((g) => g.id === goalId)

  if (!data) return null
  if (!goal) {
    return (
      <Card>
        <p className="mb-3">This goal no longer exists.</p>
        <Link to="/goals" className="underline underline-offset-4">
          Back to goals
        </Link>
      </Card>
    )
  }

  const stats = data.statsOf(goalId)
  const info = deadlineInfo(goal, data.today)
  const progress = computeProgress(goal, stats)
  const date = deadlineText(goal)

  async function togglePin() {
    setPinError('')
    if (!goal!.pinned) {
      const others = data!.goals.filter((g) => g.pinned && !g.archived && g.id !== goalId).length
      if (others >= 3) return setPinError('You can pin at most 3 goals. Unpin another one first.')
    }
    await db.goals.update(goalId, { pinned: !goal!.pinned, updatedAt: Date.now() })
  }

  const setStatus = (status: Goal['status']) => db.goals.update(goalId, { status, updatedAt: Date.now() })

  return (
    <>
      <Link to="/goals" className="mb-4 inline-block text-sm text-mute hover:text-ink">
        ← Goals
      </Link>
      <header className="mb-6 border-b border-line pb-5">
        <p className="label-caps mb-1">
          {data.categoryName(goal.categoryId)} · {TYPE_LABEL[goal.type]} · {STATUS_LABEL[goal.status]}
          {goal.archived && ' · Archived'}
        </p>
        <h1 className="text-3xl md:text-4xl">{goal.title}</h1>
        {goal.description && <p className="mt-2 text-mute">{goal.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button small onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button small onClick={togglePin}>
            {goal.pinned ? 'Unpin' : 'Pin to Home'}
          </Button>
          {goal.status === 'completed' ? (
            <Button small onClick={() => setStatus('active')}>
              Reopen
            </Button>
          ) : (
            <Button small variant="primary" onClick={() => setStatus('completed')}>
              Mark complete
            </Button>
          )}
          {goal.status === 'active' && (
            <Button small onClick={() => setStatus('paused')}>
              Pause
            </Button>
          )}
          {goal.status === 'paused' && (
            <Button small onClick={() => setStatus('active')}>
              Resume
            </Button>
          )}
          <Button small onClick={() => db.goals.update(goalId, { archived: !goal.archived, pinned: false })}>
            {goal.archived ? 'Restore' : 'Archive'}
          </Button>
          <Button small variant="danger" onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </div>
        {pinError && <p className="mt-3 text-sm">{pinError}</p>}
      </header>

      <div className="space-y-6">
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label-caps mb-1">Deadline</p>
              <p className="font-serif text-xl">{date ?? (goal.type === 'ongoing' ? 'Ongoing' : 'None set')}</p>
              <p className="text-sm text-mute">{info.text}</p>
            </div>
            <div>
              <p className="label-caps mb-1">Started</p>
              <p className="font-serif text-xl">{formatLong(goal.startDate)}</p>
            </div>
          </div>
        </Card>

        {(progress.summary || progress.percent !== null || goal.progressSource === 'manual') && (
          <Card>
            <SectionTitle>Progress</SectionTitle>
            <div className="flex items-end justify-between">
              <p className="font-serif text-2xl">{progress.summary || 'In progress'}</p>
              {progress.percent !== null && (
                <p className="font-serif text-2xl">{Math.round(progress.percent)}%</p>
              )}
            </div>
            {progress.percent !== null && (
              <div className="mt-3">
                <ProgressBar percent={progress.percent} />
              </div>
            )}
            {goal.progressSource === 'manual' && <ManualProgress goal={goal} />}
            {goal.progressSource === 'time' && (
              <p className="mt-3 text-sm text-mute">
                Counted automatically from time you link to this goal ({formatNumber(stats.timeSeconds / 3600)} h so far).
              </p>
            )}
            {goal.progressSource === 'weekly' && (
              <p className="mt-3 text-sm text-mute">
                Resets every week. A quiet week is just a quiet week; nothing is carried as a debt.
              </p>
            )}
          </Card>
        )}

        <MilestoneSection goal={goal} />
        <TimeSection goal={goal} stats={stats} />
        <HistorySection goal={goal} />
        <NotesBox key={goal.id} goal={goal} />
      </div>

      {editing && (
        <Modal title="Edit goal" onClose={() => setEditing(false)}>
          <GoalForm goal={goal} onClose={() => setEditing(false)} />
        </Modal>
      )}
      <ConfirmDialog
        open={deleting}
        title={`Delete "${goal.title}"?`}
        message={`Its milestones and progress history are deleted. ${plural(Math.round(stats.timeSeconds / 60), 'minute')} of logged time is kept but no longer linked to a goal. Consider archiving instead.`}
        requireTyping="DELETE"
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          await deleteGoalCascade(goalId)
          navigate('/goals')
        }}
      />
    </>
  )
}
