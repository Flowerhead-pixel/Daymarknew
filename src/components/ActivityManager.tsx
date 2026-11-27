import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { Button } from './ui/Button'
import { Card, SectionTitle } from './ui/Card'
import { ConfirmDialog } from './ui/ConfirmDialog'

export function ActivityManager() {
  const activities = useLiveQuery(() => db.activities.orderBy('name').toArray(), [])
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState<{ id: number; name: string } | null>(null)

  const dup = (name: string, except?: number) =>
    activities?.some((a) => a.id !== except && a.name.toLowerCase() === name.toLowerCase())

  async function add() {
    const name = newName.trim()
    if (!name) return
    if (dup(name)) return setError(`"${name}" already exists.`)
    await db.activities.add({ name, archived: false })
    setNewName('')
    setError('')
  }

  async function rename(id: number) {
    const name = editName.trim()
    if (!name) return
    if (dup(name, id)) return setError(`"${name}" already exists.`)
    await db.activities.update(id, { name })
    setEditingId(null)
    setError('')
  }

  async function askDelete(id: number, name: string) {
    const used = await db.timeEntries.where('activityId').equals(id).count()
    if (used > 0) {
      setError(`"${name}" has ${used} recorded session${used === 1 ? '' : 's'}. Archive it instead to hide it from lists.`)
      return
    }
    setError('')
    setToDelete({ id, name })
  }

  return (
    <Card>
      <SectionTitle>Activities</SectionTitle>
      <p className="mb-3 text-sm text-mute">
        Things you spend time on. Archiving hides an activity from pickers but keeps its history.
      </p>
      <ul className="mb-4 divide-y divide-line">
        {activities?.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
            {editingId === a.id ? (
              <>
                <input
                  className="min-w-0 flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && rename(a.id!)}
                  autoFocus
                />
                <Button small variant="primary" onClick={() => rename(a.id!)}>
                  Save
                </Button>
                <Button small variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className={`min-w-0 flex-1 truncate ${a.archived ? 'text-mute line-through' : ''}`}>{a.name}</span>
                <select
                  aria-label={`Category for ${a.name}`}
                  className="max-w-[9rem] py-1 text-sm"
                  value={a.categoryId ?? ''}
                  onChange={(e) =>
                    db.activities.update(a.id!, { categoryId: e.target.value ? Number(e.target.value) : undefined })
                  }
                >
                  <option value="">No category</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  small
                  variant="ghost"
                  onClick={() => {
                    setEditingId(a.id!)
                    setEditName(a.name)
                    setError('')
                  }}
                >
                  Rename
                </Button>
                <Button small variant="ghost" onClick={() => db.activities.update(a.id!, { archived: !a.archived })}>
                  {a.archived ? 'Restore' : 'Archive'}
                </Button>
                <Button small variant="ghost" onClick={() => askDelete(a.id!, a.name)}>
                  Delete
                </Button>
              </>
            )}
          </li>
        ))}
        {activities?.length === 0 && (
          <li className="py-2 text-sm text-mute">None yet. Create them from the Time screen or here.</li>
        )}
      </ul>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1"
          placeholder="New activity"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button variant="primary" onClick={add} disabled={!newName.trim()}>
          Add
        </Button>
      </div>
      {error && <p className="mt-3 text-sm">{error}</p>}
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name}"?`}
        message="This activity has no recorded sessions. This cannot be undone."
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await db.activities.delete(toDelete.id)
          setToDelete(null)
        }}
      />
    </Card>
  )
}
