import { Capacitor } from '@capacitor/core'
import { db } from './db'

const FORMAT = 'daymark-backup'
const VERSION = 1

export interface BackupFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

export const isNativeApp = () => Capacitor.isNativePlatform()

/** Collects every table into one object and saves it as a .json file. */
export async function exportBackup(): Promise<string> {
  const tables: Record<string, unknown[]> = {}
  for (const table of db.tables) {
    tables[table.name] = await table.toArray()
  }
  const backup: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    tables,
  }
  const json = JSON.stringify(backup, null, 2)
  const stamp = new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD
  const filename = `daymark-backup-${stamp}.json`

  if (isNativeApp()) {
    // The Android app cannot "download" a file like a web page can, so it opens the
    // share sheet instead (save to Drive, Files, email it to yourself, and so on).
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const written = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try {
      await Share.share({ title: 'Daymark backup', dialogTitle: 'Save your Daymark backup', files: [written.uri] })
    } catch (e) {
      if (/cancel/i.test(String((e as Error)?.message ?? e))) throw new Error('cancelled')
      throw e
    }
  } else {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  await db.settings.put({ key: 'lastBackupAt', value: Date.now() })
  return filename
}

/** Reads and checks a backup file. Throws a readable error if it is not valid. */
export async function readBackupFile(file: File): Promise<BackupFile> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const b = data as Partial<BackupFile>
  if (b?.format !== FORMAT || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('This is not a Daymark backup file.')
  }
  if (typeof b.version !== 'number' || b.version > VERSION) {
    throw new Error('This backup was made by a newer version of Daymark.')
  }
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!Array.isArray(rows)) throw new Error(`Backup table "${name}" is damaged.`)
  }
  return b as BackupFile
}

/** Replaces ALL current data with the backup, in one all-or-nothing transaction. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
      const rows = backup.tables[table.name]
      if (rows && rows.length > 0) await table.bulkPut(rows)
    }
  })
}

/** Deletes everything, then restores the starter categories and units. */
export async function eraseAllData(): Promise<void> {
  await db.delete()
  await db.open()
}
