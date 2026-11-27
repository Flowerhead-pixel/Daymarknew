import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Goal, GoalStatus, GoalType, Priority, ProgressSource } from '../db/schema'
import { todayISO } from '../lib/dates'
import { TYPE_LABEL } from '../lib/deadline'
import { Button } from './ui/Button'
import { Check, Field } from './ui/Field'
import { SelectWithCreate } from './ui/SelectWithCreate'

const TYPE_INFO: Record<GoalType, { hint: string; sources: ProgressSource[] }> = {
  deadline: { hint: 'Get something done by a date. Example: finish an assignment.', sources: ['none', 'milestones', 'manual'] },
  numeric: { hint: 'Reach a number. Example: draw 100 hours, read 20 books, save ₹20,000.', sources: ['manual', 'time'] },
  habit: { hint: 'Repeat something every week. Example: exercise 3 times a week.', sources: ['weekly'] },
  project: { hint: 'Finish a series of steps. Example: publish a manga.', sources: ['milestones', 'none'] },
  ongoing: { hint: 'Keep something going with no fixed end. Example: stay fluent in German.', sources: ['none', 'time', 'manual'] },
}

const SOURCE_LABEL: Record<ProgressSource, string> = {
  none: 'No percentage (just active or done)',
  milestones: 'From milestones I tick off',
  manual: 'I update the number myself',
  time: 'From time I log against it',
  weekly: "This week's sessions or hours",
}

interface FormState {
  title: string
  description: string
  type: GoalType
  categoryId: string
  startDate: string
  deadline: string
  deadlineApprox: boolean
  progressSource: ProgressSource
  targetValue: string
  currentValue: string
  unit: string
  weeklyHours: string
  weeklySessions: string
  priority: Priority
  status: GoalStatus
  pinned: boolean
  notes: string
}

function initial(goal?: Goal): FormState {
  return {
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    type: goal?.type ?? 'deadline',
    categoryId: goal?.categoryId !== undefined ? String(goal.categoryId) : '',
    startDate: goal?.startDate ?? todayISO(),
    deadline: goal?.deadline ?? '',
    deadlineApprox: goal?.deadlineApprox ?? false,
    progressSource: goal?.progressSource ?? 'none',
    targetValue: goal?.targetValue !== undefined ? String(goal.targetValue) : '',
    currentValue: goal ? String(goal.currentValue) : '',
    unit: goal?.unit ?? '',
    weeklyHours: goal?.weeklyTargetMinutes ? String(goal.weeklyTargetMinutes / 60) : '',
    weeklySessions: goal?.weeklyTargetSessions ? String(goal.weeklyTargetSessions) : '',
    priority: goal?.priority ?? 'medium',
    status: goal?.status ?? 'active',
    pinned: goal?.pinned ?? false,
    notes: goal?.notes ?? '',
  }
}

const num = (s: string): number | undefined => {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export function GoalForm({
  goal,
  onClose,
  onSaved,
}: {
  goal?: Goal
  onClose: () => void
  onSaved?: (id: number) => void
}) {
  const [f, setF] = useState<FormState>(() => initial(goal))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])
  const units = useLiveQuery(() => db.units.orderBy('name').toArray(), [])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }))

  function changeType(type: GoalType) {
    setF((p) => {
      const allowed = TYPE_INFO[type].sources
      return {
        ...p,
        type,
        // Each type starts with its natural way of measuring progress; it can be changed below.
        progressSource: allowed[0],
        deadline: type === 'ongoing' ? '' : p.deadline,
      }
    })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const title = f.title.trim()
    if (!title) return setError('Please give the goal a title.')

    const target = num(f.targetValue)
    const current = num(f.currentValue) ?? 0
    const weeklyHours = num(f.weeklyHours)
    const weeklySessions = num(f.weeklySessions)
    if ([target, current, weeklyHours, weeklySessions].some((n) => n !== undefined && Number.isNaN(n))) {
      return setError('Numbers must be plain numbers, like 100 or 2.5.')
    }
    if ([target, weeklyHours, weeklySessions].some((n) => n !== undefined && n <= 0)) {
      return setError('Targets must be greater than zero (or left empty).')
    }
    if (f.deadline && f.deadline < f.startDate) {
      return setError('The deadline is before the start date.')
    }
    if (f.progressSource === 'weekly' && !weeklyHours && !weeklySessions) {
      return setError('For a habit, set sessions per week or hours per week.')
    }
    if (f.progressSource === 'time' && !target) {
      // Allowed, but there will be no percentage. Not an error.
    }

    if (f.pinned && f.status !== 'completed') {
      const others = await db.goals.filter((g) => !!g.pinned && !g.archived && g.id !== goal?.id).count()
      if (others >= 3) return setError('You can pin at most 3 goals. Unpin another goal first.')
    }

    const now = Date.now()
    const usesTarget = f.progressSource === 'manual' || f.progressSource === 'time'
    const data: Omit<Goal, 'id'> = {
      title,
      description: f.description.trim(),
      categoryId: f.categoryId ? Number(f.categoryId) : undefined,
      type: f.type,
      startDate: f.startDate,
      deadline: f.deadline || undefined,
      deadlineApprox: f.deadline ? f.deadlineApprox : false,
      targetValue: usesTarget ? target : undefined,
      currentValue: f.progressSource === 'manual' ? current : (goal?.currentValue ?? 0),
      unit: f.progressSource === 'time' ? 'hours' : f.progressSource === 'manual' ? f.unit || undefined : undefined,
      progressSource: f.progressSource,
      weeklyTargetMinutes: weeklyHours ? Math.round(weeklyHours * 60) : undefined,
      weeklyTargetSessions: f.progressSource === 'weekly' ? weeklySessions : undefined,
      priority: f.priority,
      status: f.status,
      pinned: f.pinned,
      archived: goal?.archived ?? false,
      notes: f.notes,
      createdAt: goal?.createdAt ?? now,
      updatedAt: now,
    }

    setSaving(true)
    try {
      let id: number
      if (goal?.id !== undefined) {
        id = goal.id
        await db.goals.put({ ...data, id })
      } else {
        id = (await db.goals.add(data)) as number
      }
      // Keep a history line when the starting/edited number changes.
      if (f.progressSource === 'manual' && current !== (goal?.currentValue ?? 0)) {
        await db.progressLogs.add({
          goalId: id,
          date: todayISO(),
          value: current,
          note: goal ? 'Edited in goal settings' : 'Starting value',
        })
      }
      onSaved?.(id)
      onClose()
    } catch {
      setError('Could not save. Please try again.')
      setSaving(false)
    }
  }

  const allowed = TYPE_INFO[f.type].sources
  const showTarget = f.progressSource === 'manual' || f.progressSource === 'time'

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title">
        <input
          className="w-full"
          value={f.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Pass JLPT N3"
          autoFocus={!goal}
        />
      </Field>

      <Field label="What kind of goal is it?" hint={TYPE_INFO[f.type].hint}>
        <select className="w-full" value={f.type} onChange={(e) => changeType(e.target.value as GoalType)}>
          {(Object.keys(TYPE_LABEL) as GoalType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <span className="mb-1 block text-sm font-medium">Category</span>
        <SelectWithCreate
          value={f.categoryId}
          onChange={(v) => set('categoryId', v)}
          options={(categories ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          noneLabel="No category"
          createLabel="+ New category…"
          placeholder="New category name"
          onCreate={async (name) => {
            const existing = categories?.find((c) => c.name.toLowerCase() === name.toLowerCase())
            if (existing) return String(existing.id)
            return String(await db.categories.add({ name }))
          }}
        />
      </div>

      <Field label="Description (optional)">
        <textarea className="w-full" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date">
          <input type="date" className="w-full" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        {f.type !== 'ongoing' && (
          <Field label="Deadline (optional)">
            <input type="date" className="w-full" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
          </Field>
        )}
      </div>
      {f.deadline && f.type !== 'ongoing' && (
        <Check checked={f.deadlineApprox} onChange={(v) => set('deadlineApprox', v)}>
          This is only a planned month, not an exact date (shown as “July 2027 (planned)”)
        </Check>
      )}

      <Field label="How is progress measured?">
        <select
          className="w-full"
          value={f.progressSource}
          onChange={(e) => set('progressSource', e.target.value as ProgressSource)}
          disabled={allowed.length === 1}
        >
          {allowed.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>

      {showTarget && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.progressSource === 'time' ? 'Target (hours)' : 'Target (optional)'}>
            <input
              inputMode="decimal"
              className="w-full"
              value={f.targetValue}
              onChange={(e) => set('targetValue', e.target.value)}
              placeholder="e.g. 100"
            />
          </Field>
          {f.progressSource === 'manual' && (
            <Field label="Current progress">
              <input
                inputMode="decimal"
                className="w-full"
                value={f.currentValue}
                onChange={(e) => set('currentValue', e.target.value)}
                placeholder="0"
              />
            </Field>
          )}
        </div>
      )}

      {f.progressSource === 'manual' && (
        <div>
          <span className="mb-1 block text-sm font-medium">Unit</span>
          <SelectWithCreate
            value={f.unit}
            onChange={(v) => set('unit', v)}
            options={(units ?? []).map((u) => ({ value: u.name, label: u.name }))}
            noneLabel="No unit"
            createLabel="+ New unit…"
            placeholder="New unit name"
            onCreate={async (name) => {
              const existing = units?.find((u) => u.name.toLowerCase() === name.toLowerCase())
              if (existing) return existing.name
              await db.units.add({ name })
              return name
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {f.progressSource === 'weekly' && (
          <Field label="Sessions per week">
            <input
              inputMode="numeric"
              className="w-full"
              value={f.weeklySessions}
              onChange={(e) => set('weeklySessions', e.target.value)}
              placeholder="e.g. 3"
            />
          </Field>
        )}
        <Field
          label={f.progressSource === 'weekly' ? 'Or hours per week' : 'Planned hours per week (optional)'}
          hint={f.progressSource === 'weekly' ? undefined : 'Used to compare planned and actual time.'}
        >
          <input
            inputMode="decimal"
            className="w-full"
            value={f.weeklyHours}
            onChange={(e) => set('weeklyHours', e.target.value)}
            placeholder="e.g. 4"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <select className="w-full" value={f.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>
        <Field label="Status">
          <select className="w-full" value={f.status} onChange={(e) => set('status', e.target.value as GoalStatus)}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </Field>
      </div>

      <Check checked={f.pinned} onChange={(v) => set('pinned', v)}>
        Pin to the top of Home (up to 3 goals)
      </Check>

      <Field label="Notes (optional)">
        <textarea className="w-full" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>

      {error && <p className="rounded-2xl border border-ink bg-white px-3 py-2 text-sm">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {goal ? 'Save changes' : 'Create goal'}
        </Button>
      </div>
    </form>
  )
}
