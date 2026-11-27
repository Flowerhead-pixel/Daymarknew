import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Assessment as AssessmentRow, AssessmentEntry } from '../db/schema'
import { evidence, gain, gainPerHour, METRICS, parsePct, pendingChecks, weekOf, weekStats, WEEKS, type MetricKey } from '../lib/assessment'
import { formatLong, formatShort, todayISO } from '../lib/dates'
import { formatNumber } from '../lib/format'
import { formatDuration } from '../lib/time'
import { useToday } from '../lib/useToday'
import { AssessmentChart } from '../components/charts'
import { Button } from '../components/ui/Button'
import { Card, SectionTitle } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'

/* ---------- Create / edit an assessment ---------- */

function AssessmentForm({ item, onClose, onSaved }: { item?: AssessmentRow; onClose: () => void; onSaved: (id: number) => void }) {
  const goals = useLiveQuery(() => db.goals.filter((g) => !g.archived).toArray(), [])
  const [title, setTitle] = useState(item?.title ?? '')
  const [startDate, setStartDate] = useState(item?.startDate ?? todayISO())
  const [goalId, setGoalId] = useState(item?.goalId !== undefined ? String(item.goalId) : '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Give the assessment a name, e.g. "German A1 chapters 4–7".')
    if (!startDate) return setError('Choose a start date.')
    const data = { title: title.trim(), startDate, goalId: goalId ? Number(goalId) : undefined, notes: notes.trim() }
    if (item?.id !== undefined) {
      await db.assessments.put({ ...item, ...data })
      onSaved(item.id)
    } else {
      onSaved((await db.assessments.add(data)) as number)
    }
    onClose()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name">
        <input className="w-full" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. German A1 chapters 4–7" />
      </Field>
      <Field label="Week 1 starts on" hint="The four weeks are counted from this date.">
        <input type="date" className="w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </Field>
      <Field label="Linked goal (optional)">
        <select className="w-full" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">None</option>
          {goals?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes (optional)">
        <textarea className="w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="rounded-2xl border border-ink bg-white px-3 py-2 text-sm">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {item ? 'Save' : 'Create assessment'}
        </Button>
      </div>
    </form>
  )
}

/* ---------- Add / edit a learning cycle ---------- */

function CycleForm({ assessment, entry, onClose }: { assessment: AssessmentRow; entry?: AssessmentEntry; onClose: () => void }) {
  const clampWeek = (d: string) => Math.min(4, Math.max(1, weekOf(d, assessment.startDate)))
  const [topic, setTopic] = useState(entry?.topic ?? '')
  const [date, setDate] = useState(entry?.date ?? todayISO())
  const [week, setWeek] = useState(entry?.week ?? clampWeek(todayISO()))
  const [minutes, setMinutes] = useState(entry?.learningMinutes !== undefined ? String(entry.learningMinutes) : '')
  const [vals, setVals] = useState<Record<MetricKey, string>>(() =>
    Object.fromEntries(METRICS.map((m) => [m.key, entry?.[m.key] !== undefined ? String(entry[m.key]) : ''])) as Record<MetricKey, string>,
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return setError('What did you study? Give the topic a short name.')
    if (!date) return setError('Choose the date you studied it.')
    if (date > todayISO()) return setError('That date is in the future.')
    const mins = minutes.trim() === '' ? undefined : Number(minutes)
    if (mins !== undefined && (!Number.isFinite(mins) || mins <= 0 || mins > 6000)) return setError('Learning time must be minutes above 0.')

    const pcts: Partial<Record<MetricKey, number>> = {}
    for (const m of METRICS) {
      const v = parsePct(vals[m.key])
      if (Number.isNaN(v)) return setError(`${m.label} must be a number from 0 to 100, or left empty.`)
      if (v !== undefined) pcts[m.key] = v
    }
    const data = { assessmentId: assessment.id!, week, topic: topic.trim(), date, learningMinutes: mins, ...pcts, notes: notes.trim() }
    if (entry?.id !== undefined) await db.assessmentEntries.put({ ...data, id: entry.id })
    else await db.assessmentEntries.add(data)
    onClose()
  }

  const outside = weekOf(date, assessment.startDate) > 4 || weekOf(date, assessment.startDate) < 1

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Topic studied">
        <input className="w-full" value={topic} onChange={(e) => setTopic(e.target.value)} autoFocus placeholder="e.g. Chapter 5: Akkusativ" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date studied">
          <input
            type="date"
            className="w-full"
            value={date}
            max={todayISO()}
            onChange={(e) => {
              setDate(e.target.value)
              if (e.target.value) setWeek(clampWeek(e.target.value))
            }}
          />
        </Field>
        <Field label="Week">
          <select className="w-full" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {WEEKS.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {outside && <p className="text-xs text-mute">This date is outside the four weeks. You can still record it under the week you choose.</p>}
      <Field label="Learning time (minutes)" hint="Time actually spent learning this topic.">
        <input inputMode="numeric" className="w-full" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="e.g. 90" />
      </Field>
      <p className="text-sm text-mute">Scores are percentages from 0 to 100. Leave a check empty until you have done it.</p>
      {METRICS.map((m) => (
        <Field key={m.key} label={m.label} hint={m.hint}>
          <input inputMode="decimal" className="w-full" value={vals[m.key]} onChange={(e) => setVals((v) => ({ ...v, [m.key]: e.target.value }))} placeholder="0–100" />
        </Field>
      ))}
      <Field label="Notes (optional)">
        <textarea className="w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="rounded-2xl border border-ink bg-white px-3 py-2 text-sm">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {entry ? 'Save cycle' : 'Add cycle'}
        </Button>
      </div>
    </form>
  )
}

/* ---------- Page ---------- */

const SHORT: Record<MetricKey, string> = {
  baselinePct: 'Baseline',
  initialPct: 'Initial accuracy',
  recall24Pct: '24h recall',
  retention7Pct: '7-day retention',
  unfamiliarPct: 'New questions',
  applicationPct: 'Application',
}

const fmt = (n?: number, suffix = '') => (n === undefined ? '–' : `${formatNumber(n)}${suffix}`)

export function Assessment() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const items = useLiveQuery(() => db.assessments.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const selectedId = Number(params.get('id')) || items?.[0]?.id
  const selected = items?.find((a) => a.id === selectedId)
  const entries = useLiveQuery(() => (selectedId ? db.assessmentEntries.where('assessmentId').equals(selectedId).toArray() : []), [selectedId])

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [cycleModal, setCycleModal] = useState<AssessmentEntry | 'new' | null>(null)
  const [deleteAssessment, setDeleteAssessment] = useState(false)
  const [deleteCycle, setDeleteCycle] = useState<AssessmentEntry | null>(null)

  const stats = useMemo(() => weekStats(entries ?? []), [entries])
  const ev = useMemo(() => evidence(stats), [stats])
  const totalMinutes = (entries ?? []).reduce((t, e) => t + (e.learningMinutes ?? 0), 0)
  const chartData = stats.map((s) => ({ label: `Week ${s.week}`, ...s.avg }))
  const hasChartData = stats.some((s) => Object.entries(s.avg).some(([k]) => k !== 'baselinePct'))
  const goalTitle = selected?.goalId !== undefined ? goals?.find((g) => g.id === selected.goalId)?.title : undefined
  const select = (id: number) => setParams({ id: String(id) })

  const sortedEntries = [...(entries ?? [])].sort((a, b) => (a.week === b.week ? (a.date < b.date ? 1 : -1) : a.week - b.week))

  return (
    <>
      <Link to="/settings" className="mb-4 inline-block text-sm text-mute hover:text-ink">
        ← Settings
      </Link>
      <PageHeader
        title="Learning assessment"
        subtitle="Optional · four weeks"
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New
          </Button>
        }
      />

      <Card className="mb-6">
        <p className="text-sm">
          A four-week experiment on how you learn. For each topic you record what you knew before, how long you studied, and
          how much you kept a day and a week later.
        </p>
        <p className="mt-2 text-sm text-mute">
          There is no score. You get the evidence: whether you are gaining more per hour, and whether it sticks. Time spent
          and speed of learning are shown separately.
        </p>
      </Card>

      {items && items.length === 0 && (
        <Card>
          <p className="mb-3 text-sm text-mute">No assessments yet. Create one for a topic you are about to study, such as German A1 chapters 4–7.</p>
          <Button variant="primary" onClick={() => setCreating(true)}>
            Create an assessment
          </Button>
        </Card>
      )}

      {items && items.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-1">
          {items.map((a) => (
            <Button key={a.id} small variant={a.id === selectedId ? 'primary' : 'ghost'} onClick={() => select(a.id!)}>
              {a.title}
            </Button>
          ))}
        </div>
      )}

      {selected && entries && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-2xl">{selected.title}</h2>
            <p className="mt-1 text-sm text-mute">
              Week 1 starts {formatLong(selected.startDate)}
              {goalTitle && <> · Goal: {goalTitle}</>}
            </p>
            {selected.notes && <p className="mt-2 text-sm">{selected.notes}</p>}
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
              <div>
                <p className="label-caps mb-1">Cycles</p>
                <p className="font-serif text-2xl">{entries.length}</p>
              </div>
              <div>
                <p className="label-caps mb-1">Learning time</p>
                <p className="font-serif text-2xl">{formatDuration(totalMinutes * 60)}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" small onClick={() => setCycleModal('new')}>
                Add learning cycle
              </Button>
              <Button small onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button small variant="danger" onClick={() => setDeleteAssessment(true)}>
                Delete
              </Button>
            </div>
          </Card>

          <Card>
            <SectionTitle>What the evidence shows</SectionTitle>
            {ev.length === 0 ? (
              <p className="text-sm text-mute">
                Not enough to compare yet. Once two different weeks have results, this compares your first and latest week.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {ev.map((x) => (
                  <li key={x.label} className="py-3">
                    <p className="text-sm font-medium">{x.label}</p>
                    <p className="text-sm">
                      {formatNumber(x.from)}
                      {x.unit} in week {x.fromWeek} → {formatNumber(x.to)}
                      {x.unit} in week {x.toWeek}
                      <span className="text-mute">
                        {' '}
                        · {x.verdict === 'similar' ? 'about the same' : x.verdict}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-line pt-3 text-xs text-mute">
              Topics differ in difficulty and each week has few cycles, so treat this as a pattern to watch, not a verdict.
            </p>
          </Card>

          {hasChartData && (
            <Card>
              <SectionTitle>Weekly averages</SectionTitle>
              <AssessmentChart data={chartData} />
            </Card>
          )}

          {entries.length > 0 && (
            <Card>
              <SectionTitle>By week</SectionTitle>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left text-[13px] sm:text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-mute">
                      <th className="w-[34%] py-2 pr-1 font-normal"> </th>
                      {WEEKS.map((w) => (
                        <th key={w} className="px-1 py-2 text-right font-normal">
                          Wk {w}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr>
                      <td className="py-2 pr-1">Cycles</td>
                      {stats.map((s) => (
                        <td key={s.week} className="px-1 py-2 text-right tabular-nums">
                          {s.cycles || '–'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 pr-1">Time studied</td>
                      {stats.map((s) => (
                        <td key={s.week} className="px-1 py-2 text-right tabular-nums">
                          {s.minutes ? formatDuration(s.minutes * 60) : '–'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 pr-1 font-medium">Gain per hour</td>
                      {stats.map((s) => (
                        <td key={s.week} className="px-1 py-2 text-right font-medium tabular-nums">
                          {fmt(s.gainPerHour)}
                        </td>
                      ))}
                    </tr>
                    {METRICS.map((m) => (
                      <tr key={m.key}>
                        <td className="py-2 pr-1">{SHORT[m.key]}</td>
                        {stats.map((s) => (
                          <td key={s.week} className="px-1 py-2 text-right tabular-nums">
                            {s.avg[m.key] === undefined ? '–' : `${formatNumber(s.avg[m.key]!)}%`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-mute">
                Gain per hour = points gained between baseline and initial accuracy, divided by hours studied. It measures speed,
                separately from how many hours you put in.
              </p>
            </Card>
          )}

          <section>
            <SectionTitle>Cycles</SectionTitle>
            {sortedEntries.length === 0 && (
              <Card>
                <p className="text-sm text-mute">
                  A cycle is one topic. Before studying, take a short quiz for the baseline. After studying, quiz again. Then
                  come back for the 24-hour and 7-day checks.
                </p>
              </Card>
            )}
            <div className="space-y-3">
              {sortedEntries.map((e) => {
                const pending = pendingChecks(e, today)
                const g = gain(e)
                const gph = gainPerHour(e)
                return (
                  <Card key={e.id} className="!p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="label-caps">
                          Week {e.week} · {formatShort(e.date)}
                        </p>
                        <p className="truncate font-serif text-lg">{e.topic}</p>
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-mute">{e.learningMinutes ? formatDuration(e.learningMinutes * 60) : ''}</p>
                    </div>
                    <p className="mt-2 text-sm text-mute">
                      {[
                        e.baselinePct !== undefined && `Before ${e.baselinePct}%`,
                        e.initialPct !== undefined && `After ${e.initialPct}%`,
                        e.recall24Pct !== undefined && `24h ${e.recall24Pct}%`,
                        e.retention7Pct !== undefined && `7d ${e.retention7Pct}%`,
                        e.unfamiliarPct !== undefined && `New questions ${e.unfamiliarPct}%`,
                        e.applicationPct !== undefined && `Applied ${e.applicationPct}%`,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No scores yet'}
                    </p>
                    {g !== undefined && (
                      <p className="mt-1 text-sm">
                        Gain {g >= 0 ? '+' : ''}
                        {formatNumber(g)} pts{gph !== undefined && <span className="text-mute"> · {formatNumber(gph)} pts per hour</span>}
                      </p>
                    )}
                    {pending.length > 0 && (
                      <p className="mt-2 text-sm">
                        {pending.map((p) => (
                          <span key={p.label} className="mr-3">
                            {p.due ? `${p.label} is due` : `${p.label} on ${formatShort(p.date)}`}
                          </span>
                        ))}
                      </p>
                    )}
                    {e.notes && <p className="mt-1 text-sm text-mute">{e.notes}</p>}
                    <div className="mt-2 flex gap-1">
                      <Button small variant="ghost" onClick={() => setCycleModal(e)}>
                        Edit / add results
                      </Button>
                      <Button small variant="ghost" onClick={() => setDeleteCycle(e)}>
                        Delete
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {creating && (
        <Modal title="New assessment" onClose={() => setCreating(false)}>
          <AssessmentForm onClose={() => setCreating(false)} onSaved={select} />
        </Modal>
      )}
      {editing && selected && (
        <Modal title="Edit assessment" onClose={() => setEditing(false)}>
          <AssessmentForm item={selected} onClose={() => setEditing(false)} onSaved={select} />
        </Modal>
      )}
      {cycleModal && selected && (
        <Modal title={cycleModal === 'new' ? 'Add learning cycle' : 'Edit learning cycle'} onClose={() => setCycleModal(null)}>
          <CycleForm assessment={selected} entry={cycleModal === 'new' ? undefined : cycleModal} onClose={() => setCycleModal(null)} />
        </Modal>
      )}
      <ConfirmDialog
        open={deleteAssessment}
        title={`Delete "${selected?.title}"?`}
        message="All its learning cycles are deleted too. This cannot be undone."
        requireTyping="DELETE"
        onCancel={() => setDeleteAssessment(false)}
        onConfirm={async () => {
          if (selected?.id !== undefined) {
            await db.transaction('rw', db.assessments, db.assessmentEntries, async () => {
              await db.assessmentEntries.where('assessmentId').equals(selected.id!).delete()
              await db.assessments.delete(selected.id!)
            })
          }
          setDeleteAssessment(false)
          setParams({})
        }}
      />
      <ConfirmDialog
        open={deleteCycle !== null}
        title={`Delete "${deleteCycle?.topic}"?`}
        message="This learning cycle and its results are deleted."
        onCancel={() => setDeleteCycle(null)}
        onConfirm={async () => {
          if (deleteCycle?.id !== undefined) await db.assessmentEntries.delete(deleteCycle.id)
          setDeleteCycle(null)
        }}
      />
    </>
  )
}
