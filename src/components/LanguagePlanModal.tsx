import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addLanguagePlans, existingPlans, PLANS, type LanguageKey } from '../lib/languagePlan'
import { formatLong } from '../lib/dates'
import { Button } from './ui/Button'
import { Check } from './ui/Field'
import { Modal } from './ui/Modal'

export function LanguagePlanModal({ onClose, onAdded }: { onClose: () => void; onAdded?: (ids: number[]) => void }) {
  // Re-checks whenever goals change, so a plan that already exists is shown as such.
  const exists = useLiveQuery(async () => {
    await db.goals.count()
    return existingPlans()
  }, [])
  const [chosen, setChosen] = useState<Record<LanguageKey, boolean>>({ japanese: true, german: true })
  const [hours, setHours] = useState<Record<LanguageKey, string>>({
    japanese: String(PLANS.japanese.weeklyHours),
    german: String(PLANS.german.weeklyHours),
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!exists) return
    setChosen((c) => ({ japanese: c.japanese && !exists.japanese, german: c.german && !exists.german }))
  }, [exists])

  async function submit() {
    setError('')
    const picks: { key: LanguageKey; weeklyHours: number }[] = []
    for (const key of ['japanese', 'german'] as LanguageKey[]) {
      if (!chosen[key]) continue
      const h = Number(hours[key])
      if (!Number.isFinite(h) || h <= 0 || h > 100) return setError('Weekly hours must be a number above 0.')
      picks.push({ key, weeklyHours: h })
    }
    if (picks.length === 0) return setError('Choose at least one plan.')
    setBusy(true)
    try {
      const ids = await addLanguagePlans(picks)
      onAdded?.(ids)
      onClose()
    } catch {
      setError('Could not add the plans. Nothing was changed.')
      setBusy(false)
    }
  }

  return (
    <Modal title="Language plans" onClose={onClose}>
      <p className="mb-5 text-sm text-mute">
        This adds your plans as normal goals with monthly milestones. You can rename, move dates, tick off, or delete
        anything afterwards. No progress is filled in; every milestone starts unticked.
      </p>
      <div className="space-y-5">
        {(['japanese', 'german'] as LanguageKey[]).map((key) => {
          const plan = PLANS[key]
          const already = exists?.[key]
          return (
            <section key={key} className="rounded-3xl bg-white p-4">
              <Check checked={!!chosen[key] && !already} onChange={(v) => setChosen((c) => ({ ...c, [key]: v }))}>
                <span className="font-medium">{plan.goalTitle}</span>
              </Check>
              {already ? (
                <p className="mt-2 text-sm text-mute">Already in your goals.</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-mute">{plan.description}</p>
                  <p className="mt-1 text-sm text-mute">
                    Planned for {formatLong(plan.deadline).replace(/^\d+ /, '')} (a planned month, not an official date).
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    Weekly hours
                    <input
                      inputMode="decimal"
                      className="w-20 py-1"
                      value={hours[key]}
                      onChange={(e) => setHours((h) => ({ ...h, [key]: e.target.value }))}
                    />
                  </label>
                  <ul className="mt-3 space-y-1 text-sm">
                    {plan.milestones.map((m) => (
                      <li key={m.title} className="text-mute">
                        · {m.title}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )
        })}
      </div>
      {error && <p className="mt-4 rounded-2xl border border-ink bg-white px-3 py-2 text-sm">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={busy || (exists?.japanese && exists?.german)} onClick={submit}>
          Add selected plans
        </Button>
      </div>
    </Modal>
  )
}
