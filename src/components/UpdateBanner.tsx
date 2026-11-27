import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui/Button'

/** Tells you when the app can work offline, and when a newer version is waiting. */
export function UpdateBanner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  // The offline notice is only good news, so it goes away by itself.
  useEffect(() => {
    if (!offlineReady || needRefresh) return
    const id = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(id)
  }, [offlineReady, needRefresh, setOfflineReady])

  if (!offlineReady && !needRefresh) return null
  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-full bg-ink px-5 py-3 text-paper text-sm md:bottom-6"
    >
      <span>{needRefresh ? 'A new version of Daymark is ready.' : 'Daymark is ready to work offline.'}</span>
      <span className="flex shrink-0 gap-1">
        {needRefresh && (
          <Button small variant="primary" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
        )}
        <Button small variant="ghost" onClick={close}>
          {needRefresh ? 'Later' : 'Dismiss'}
        </Button>
      </span>
    </div>
  )
}
