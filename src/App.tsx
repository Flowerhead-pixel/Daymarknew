import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Home } from './pages/Home'
import { Goals } from './pages/Goals'
import { GoalDetail } from './pages/GoalDetail'
import { Time } from './pages/Time'
import { Reviews } from './pages/Reviews'
import { Settings } from './pages/Settings'

// The charts library is large, so the Analytics screen loads only when opened.
const Assessment = lazy(() => import('./pages/Assessment').then((m) => ({ default: m.Assessment })))
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })))

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="goals" element={<Goals />} />
          <Route path="goals/:id" element={<GoalDetail />} />
          <Route path="time" element={<Time />} />
          <Route
            path="analytics"
            element={
              <Suspense fallback={null}>
                <Analytics />
              </Suspense>
            }
          />
          <Route path="reviews" element={<Reviews />} />
          <Route
            path="assessment"
            element={
              <Suspense fallback={null}>
                <Assessment />
              </Suspense>
            }
          />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
