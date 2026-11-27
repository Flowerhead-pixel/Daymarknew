import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

/** Asks the browser not to clear Daymark's data when the device is low on space. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export interface StorageInfo {
  persisted: boolean | null // null = this browser cannot say
  usedBytes?: number
}

export function useStorageInfo(): StorageInfo {
  const [info, setInfo] = useState<StorageInfo>({ persisted: null })
  useEffect(() => {
    let alive = true
    ;(async () => {
      const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null
      const est = navigator.storage?.estimate ? await navigator.storage.estimate() : undefined
      if (alive) setInfo({ persisted, usedBytes: est?.usage })
    })().catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  return info
}

/** Epoch ms of the last export, or undefined if you never exported. */
export function useLastBackup(): number | undefined | null {
  // null = still loading, undefined = never
  const row = useLiveQuery(async () => (await db.settings.get('lastBackupAt')) ?? null, [])
  if (row === undefined) return null
  return row === null ? undefined : (row.value as number)
}

export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
