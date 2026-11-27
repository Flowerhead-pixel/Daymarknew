import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { compareGoals } from '../lib/deadline'
import { useGoalData } from '../lib/useGoalData'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { GoalCard } from '../components/GoalCard'
import { GoalForm } from '../components/GoalForm'
import { deleteGoalCascade } from '../lib/goalActions'
import { existingPlans } from '../lib/languagePlan'
import { LanguagePlanModal } from '../components/LanguagePlanModal'

type Tab = 'active' | 'paused' | 'completed' | 'archived'

export function Goals() {
  const data = useGoalData()
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('active')
  const [category, setCategory] = useState('')
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<{ id: number; title: string } | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const planState = useLiveQuery(async () => {
    await db.goals.count()
    const hidden = (await db.settings.get('hideLanguagePlan'))?.value === true
    const exists = await existingPlans()
    return { hidden, missing: !exists.japanese || !exists.german }
  }, [])

  const counts = useMemo(() => {
    const c = { active: 0, paused: 0, completed: 0, archived: 0 }
    for (const g of data?.goals ?? []) {
      if (g.archived) c.archived++
      else c[g.status]++
    }
    return c
  }, [data])

  const list = useMemo(() => {
    if (!data) return []
    return data.goals
      .filter((g) => (tab === 'archived' ? g.archived : !g.archived && g.status === tab))
      .filter((g) => !category || String(g.categoryId ?? '') === category)
      .sort(compareGoals)
  }, [data, tab, category])

  const tabs: [Tab, string][] = [
    ['active', 'Active'],
    ['paused', 'Paused'],
    ['completed', 'Completed'],
    ['archived', 'Archived'],
  ]

  return (
    <>
      <PageHeader
        title="Goals"
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New goal
          </Button>
        }
      />

      {planState && planState.missing && !planState.hidden && (
        <Card className="mb-5">
          <h2 className="mb-1 text-lg">Language plans</h2>
          <p className="mb-3 text-sm text-mute">
            Add your Japanese (JLPT N3) and German (A2 to B1) plans with monthly milestones. You choose what to add and can
            edit everything.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" small onClick={() => setPlanOpen(true)}>
              Review and add
            </Button>
            <Button small variant="ghost" onClick={() => db.settings.put({ key: 'hideLanguagePlan', value: true })}>
              Hide this
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {tabs.map(([t, label]) => (
            <Button key={t} small variant={tab === t ? 'primary' : 'ghost'} onClick={() => setTab(t)}>
              {label} {counts[t] > 0 && <span className="ml-1 opacity-60">{counts[t]}</span>}
            </Button>
          ))}
        </div>
        <select
          aria-label="Filter by category"
          className="py-1.5 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {data && list.length === 0 && (
        <Card>
          <p className="text-sm text-mute">
            {data.goals.length === 0
              ? 'No goals yet. Create your first one: anything from “Pass JLPT N3” to “Read 20 books”.'
              : tab === 'archived'
                ? 'Nothing archived. Archive finished goals from their page to tidy up this list.'
                : `No ${tab} goals${category ? ' in this category' : ''}.`}
          </p>
          {data.goals.length === 0 && (
            <Button className="mt-4" variant="primary" onClick={() => setCreating(true)}>
              Create a goal
            </Button>
          )}
        </Card>
      )}

      <div className="space-y-3">
        {data &&
          list.map((g) => (
            <div key={g.id}>
              <GoalCard
                goal={g}
                stats={data.statsOf(g.id!)}
                categoryName={data.categoryName(g.categoryId)}
                today={data.today}
              />
              {tab === 'archived' && (
                <div className="mt-1 flex gap-1">
                  <Button small variant="ghost" onClick={() => db.goals.update(g.id!, { archived: false })}>
                    Restore
                  </Button>
                  <Button small variant="ghost" onClick={() => setToDelete({ id: g.id!, title: g.title })}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
      </div>

      {planOpen && <LanguagePlanModal onClose={() => setPlanOpen(false)} />}
      {creating && (
        <Modal title="New goal" onClose={() => setCreating(false)}>
          <GoalForm onClose={() => setCreating(false)} onSaved={(id) => navigate(`/goals/${id}`)} />
        </Modal>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.title}"?`}
        message="Its milestones and progress history are deleted. Time sessions you logged are kept, but no longer linked to a goal."
        requireTyping="DELETE"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await deleteGoalCascade(toDelete.id)
          setToDelete(null)
        }}
      />
    </>
  )
}
