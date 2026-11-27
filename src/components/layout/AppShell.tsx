import { NavLink, Outlet } from 'react-router-dom'
import { TimerBar } from '../TimerBar'
import { UpdateBanner } from '../UpdateBanner'

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/goals', label: 'Goals' },
  { to: '/time', label: 'Time' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell() {
  return (
    <div className="min-h-screen md:flex">
      {/* Desktop: compact sidebar */}
      <aside className="hidden w-48 shrink-0 md:block">
        <div className="sticky top-0 flex h-screen flex-col px-5 py-8">
          <div className="mb-10 text-2xl font-bold tracking-tight">Daymark</div>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-ink text-paper' : 'text-mute hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-6 md:px-10 md:pb-16 md:pt-12">
        <TimerBar />
        <Outlet />
      </main>

      <UpdateBanner />

      {/* Mobile: floating bottom navigation */}
      <nav
        className="fixed inset-x-3 z-40 grid grid-cols-6 gap-0.5 rounded-full bg-ink p-1.5 shadow-xl md:hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `rounded-full py-2.5 text-center text-[11px] font-semibold transition-colors ${
                isActive ? 'bg-paper text-ink' : 'text-white/65'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
