import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { eraseAllData, exportBackup, isNativeApp, readBackupFile, restoreBackup, type BackupFile } from '../db/backup'
import { setWeekStartsOn, useWeekStartsOn } from '../lib/settings'
import { formatBytes, useLastBackup, useStorageInfo } from '../lib/storage'
import { ActivityManager } from '../components/ActivityManager'
import { LanguagePlanModal } from '../components/LanguagePlanModal'
import { Button } from '../components/ui/Button'
import { Card, SectionTitle } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PageHeader } from '../components/ui/PageHeader'

type Kind = 'categories' | 'units'

/** Editable list used for both categories and units. */
function NameList({ kind, title }: { kind: Kind; title: string }) {
  const rows = useLiveQuery(() => db[kind].orderBy('name').toArray(), [kind])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState<{ id: number; name: string } | null>(null)

  const exists = (name: string, exceptId?: number) =>
    rows?.some((r) => r.id !== exceptId && r.name.toLowerCase() === name.toLowerCase())

  async function add() {
    const name = newName.trim()
    if (!name) return
    if (exists(name)) return setError(`"${name}" already exists.`)
    await db[kind].add({ name })
    setNewName('')
    setError('')
  }

  async function saveEdit(id: number) {
    const name = editName.trim()
    if (!name) return
    if (exists(name, id)) return setError(`"${name}" already exists.`)
    const old = rows?.find((r) => r.id === id)?.name
    await db.transaction('rw', db.categories, db.units, db.goals, async () => {
      await db[kind].update(id, { name })
      // Units are stored by name on goals, so keep those in sync when renamed.
      if (kind === 'units' && old) {
        await db.goals.where('unit').equals(old).modify({ unit: name })
      }
    })
    setEditingId(null)
    setError('')
  }

  // Is this category/unit used by a goal or activity? If so, deleting is blocked.
  async function usageCount(id: number, name: string) {
    if (kind === 'categories') {
      const g = await db.goals.where('categoryId').equals(id).count()
      const a = await db.activities.where('categoryId').equals(id).count()
      return g + a
    }
    return db.goals.filter((g) => g.unit === name).count()
  }

  async function askDelete(id: number, name: string) {
    const used = await usageCount(id, name)
    if (used > 0) {
      setError(`"${name}" is used by ${used} item${used === 1 ? '' : 's'}. Rename it, or change those items first.`)
      return
    }
    setError('')
    setToDelete({ id, name })
  }

  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <ul className="mb-4 divide-y divide-line">
        {rows?.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2">
            {editingId === r.id ? (
              <>
                <input
                  className="min-w-0 flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit(r.id!)}
                  autoFocus
                />
                <Button small variant="primary" onClick={() => saveEdit(r.id!)}>
                  Save
                </Button>
                <Button small variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span>{r.name}</span>
                <span className="flex gap-1">
                  <Button
                    small
                    variant="ghost"
                    onClick={() => {
                      setEditingId(r.id!)
                      setEditName(r.name)
                      setError('')
                    }}
                  >
                    Rename
                  </Button>
                  <Button small variant="ghost" onClick={() => askDelete(r.id!, r.name)}>
                    Delete
                  </Button>
                </span>
              </>
            )}
          </li>
        ))}
        {rows?.length === 0 && <li className="py-2 text-sm text-mute">None yet.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1"
          placeholder={kind === 'categories' ? 'New category' : 'New unit'}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button variant="primary" onClick={add} disabled={!newName.trim()}>
          Add
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-ink">{error}</p>}

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name}"?`}
        message="This cannot be undone."
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await db[kind].delete(toDelete.id)
          setToDelete(null)
        }}
      />
    </Card>
  )
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [erasing, setErasing] = useState(false)
  const lastBackup = useLastBackup()
  const storage = useStorageInfo()

  async function onExport() {
    try {
      const name = await exportBackup()
      setMessage(
        isNativeApp()
          ? `Backup ${name} is ready. Make sure you saved it somewhere safe (Drive, Files, or email it to yourself).`
          : `Saved ${name}. Keep it somewhere safe (cloud drive, email to yourself).`,
      )
    } catch (e) {
      setMessage(e instanceof Error && e.message === 'cancelled' ? 'Backup cancelled. Nothing was saved.' : 'Export failed. Please try again.')
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return
    try {
      setPending(await readBackupFile(file))
      setMessage('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not read that file.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const counts = pending
    ? `${pending.tables.goals?.length ?? 0} goals, ${pending.tables.timeEntries?.length ?? 0} time entries`
    : ''

  return (
    <Card>
      <SectionTitle>Backup and restore</SectionTitle>
      <p className="mb-4 text-sm text-mute">
        Your data lives only on this device. Export a backup regularly, especially before clearing
        browser data or changing phones.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={onExport}>
          Export backup
        </Button>
        <Button onClick={() => fileRef.current?.click()}>Import backup</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
      </div>
      {message && <p className="mt-3 text-sm">{message}</p>}
      <dl className="mt-4 space-y-1 text-sm text-mute">
        <div className="flex justify-between gap-4">
          <dt>Last backup</dt>
          <dd className="text-ink">
            {lastBackup === null ? '' : lastBackup === undefined ? 'Never' : new Date(lastBackup).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Protected from automatic clearing</dt>
          <dd className="text-ink">{storage.persisted === null ? 'Unknown' : storage.persisted ? 'Yes' : 'Not guaranteed'}</dd>
        </div>
        {storage.usedBytes !== undefined && (
          <div className="flex justify-between gap-4">
            <dt>Space used</dt>
            <dd className="text-ink">{formatBytes(storage.usedBytes)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6 border-t border-line pt-4">
        <p className="mb-2 text-sm text-mute">Remove everything and start fresh.</p>
        <Button variant="danger" onClick={() => setErasing(true)}>
          Erase all data
        </Button>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Replace all current data?"
        message={`The backup contains ${counts}. Importing replaces everything currently in Daymark. Export a backup first if you are unsure.`}
        confirmLabel="Replace data"
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return
          try {
            await restoreBackup(pending)
            setMessage('Backup restored.')
          } catch {
            setMessage('Restore failed. Your existing data was not changed.')
          }
          setPending(null)
        }}
      />
      <ConfirmDialog
        open={erasing}
        title="Erase all data?"
        message="All goals, time entries, reviews, categories and units will be deleted from this device."
        confirmLabel="Erase everything"
        requireTyping="ERASE"
        onCancel={() => setErasing(false)}
        onConfirm={async () => {
          await eraseAllData()
          setErasing(false)
          setMessage('All data erased. Starter categories and units were restored.')
        }}
      />
    </Card>
  )
}

function WeekStart() {
  const weekStartsOn = useWeekStartsOn()
  return (
    <Card>
      <SectionTitle>Week</SectionTitle>
      <label className="flex items-center justify-between gap-4 text-sm">
        Week starts on
        <select
          className="py-1.5"
          value={weekStartsOn}
          onChange={(e) => setWeekStartsOn(Number(e.target.value) === 0 ? 0 : 1)}
        >
          <option value={1}>Monday</option>
          <option value={0}>Sunday</option>
        </select>
      </label>
    </Card>
  )
}

function OptionalTools() {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <SectionTitle>Optional tools</SectionTitle>
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-2 text-mute">Add the Japanese and German plans, with monthly milestones. You choose what to add.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpen(true)}>Language plans</Button>
            <Button variant="ghost" onClick={() => db.settings.put({ key: 'hideLanguagePlan', value: false })}>
              Show the card on Goals again
            </Button>
          </div>
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-mute">A four-week experiment to see how you learn, with evidence instead of a score.</p>
          <Link to="/assessment" className="inline-block rounded-full border border-line bg-white px-5 py-2.5 text-sm font-medium hover:border-ink">
            Fast-learner assessment
          </Link>
        </div>
      </div>
      {open && <LanguagePlanModal onClose={() => setOpen(false)} />}
    </Card>
  )
}

export function Settings() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <WeekStart />
        <OptionalTools />
        <NameList kind="categories" title="Categories" />
        <NameList kind="units" title="Units" />
        <ActivityManager />
        <DataSection />
      </div>
    </>
  )
}
