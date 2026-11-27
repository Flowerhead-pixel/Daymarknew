# DAYMARK — Architecture, Schema, Wireframes, Plan

## 1. Architecture

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS 3 + Dexie (IndexedDB) + React Router (HashRouter) + Recharts (Stage 5) + vite-plugin-pwa (Stage 7).

**Principles**
1. **Local-first.** All data lives in IndexedDB on your device. No backend, no login.
2. **One source of truth.** Time spent on a goal is *never stored on the goal*. It is always calculated by adding up `timeEntries` linked to that goal. This is how double counting is avoided: a session exists once, and every total is derived from it.
3. **Dates are plain local strings** (`"2026-11-27"`) for calendar days, and epoch milliseconds for exact moments (timers). This avoids timezone bugs (e.g. India vs. UTC date shifts).
4. **Everything is data, not code.** Categories, units, activities and goal types are rows in the database, so you never need to edit code to add a new goal.
5. **Hash routing** (`/#/goals`) so the app works offline and on any static host.

**Folder layout**
```
daymark/
├─ index.html
├─ package.json
├─ vite.config.ts / tsconfig*.json / tailwind.config.js / postcss.config.js
├─ public/                 icons + manifest (Stage 7)
└─ src/
   ├─ main.tsx             entry point
   ├─ App.tsx              routes
   ├─ index.css            design tokens + Tailwind
   ├─ db/
   │  ├─ schema.ts         TypeScript types for every record
   │  ├─ db.ts             Dexie database + default categories/units
   │  └─ backup.ts         JSON export / import / erase
   ├─ lib/
   │  ├─ dates.ts          local-date helpers (today, week start, days left)
   │  └─ time.ts           duration formatting
   ├─ components/
   │  ├─ ui/               Button, Card, Modal, ConfirmDialog, Field, PageHeader
   │  └─ layout/AppShell   sidebar (desktop) + bottom nav (mobile)
   └─ pages/               Home, Goals, Time, Analytics, Reviews, Settings
```

## 2. Database schema (IndexedDB via Dexie)

| Table | Purpose | Key fields |
|---|---|---|
| `categories` | Editable categories | id, name |
| `units` | Editable units | id, name (hours, books, ₹…) |
| `goals` | Every goal | id, title, description, categoryId, type (`deadline` \| `numeric` \| `habit` \| `project` \| `ongoing`), startDate, deadline?, targetValue?, currentValue, unit?, progressSource (`manual` \| `time` \| `milestones` \| `none`), weeklyTargetMinutes?, priority, status (`active` \| `paused` \| `completed`), pinned, archived, notes |
| `milestones` | Steps/tasks of a project goal | id, goalId, parentId?, title, dueDate?, done, doneAt?, order |
| `activities` | Things you spend time on | id, name, categoryId?, archived |
| `timeEntries` | One row per work session | id, activityId, goalId?, date, durationSeconds, notes |
| `timers` | The one running timer (survives closing the app) | id=`current`, activityId, goalId?, state, startedAt, accumulatedMs |
| `progressLogs` | Progress history | id, goalId, date, value, note |
| `weeklyReviews` | Weekly reflections | id, weekStart (unique), accomplished, wentWrong, learned, nextFocus |
| `assessments` / `assessmentEntries` | 4-week fast-learner assessment | id, goalId?, startDate / assessmentId, week, metric, value, notes |
| `settings` | Small key/value prefs (e.g. week starts Monday) | key, value |

**How progress is computed (never stored twice)**
- `progressSource = time` → progress = sum of linked `timeEntries` ÷ target (in hours)
- `progressSource = milestones` → progress = done milestones ÷ total
- `progressSource = manual` → latest `currentValue` ÷ target
- `progressSource = none` → no percentage; the goal is simply active or completed (ongoing/habit goals)

## 3. Wireframes

**Mobile Home**
```
┌──────────────────────────┐
│ FRIDAY                   │
│ 27 November 2026         │
│ Tracked today  1h 30m    │
├──────────────────────────┤
│ FOCUS  (pinned, max 3)   │
│ ┌──────────────────────┐ │
│ │ JLPT N3 · Language   │ │
│ │ Jul 2027 · 219 days  │ │
│ │ ▓▓▓▓░░░░░░  35%      │ │
│ └──────────────────────┘ │
├──────────────────────────┤
│ TODAY'S PRIORITIES       │
│ ○ German ch. 5           │
├──────────────────────────┤
│ ALL ACTIVE GOALS         │
│ Draw 100 hours  72/100 h │
│ Overdue · gentle note    │
├──────────────────────────┤
│ Home Goals Time Stats ⋯  │
└──────────────────────────┘
```

**Desktop:** compact left sidebar (text nav) + content column, max ~920px wide, same blocks stacked, Focus goals side by side.

**Goal detail:** title/category/status → deadline + days left → progress → milestones (checklist) → linked time (total + recent sessions) → progress history → notes.

**Time:** big timer (activity picker, optional goal, Start / Pause / Stop) → quick manual entry → list of sessions (edit/delete) → week and month totals.

**Analytics:** date range + category filters → totals per activity (bar) → daily stacked chart → time per goal → planned vs actual.

**Reviews:** auto summary for the week → four reflection prompts → list of past reviews.

## 4. Development plan

| Stage | Content |
|---|---|
| **1** | Project setup, database, design system, app shell, Settings (categories, units, backup/restore) — done |
| 2 | Home dashboard + universal goal create/edit/archive/delete — done |
| 3 | Activities, manual entry, persistent timer — done |
| 4 | Goal details, milestones, linked time, progress history — done |
| 5 | Analytics + weekly reviews — done |
| 6 | Language plans (Japanese, German as optional one-click import) + fast-learner assessment — done |
| 7 | PWA install, offline, icons, backups, final testing — done |

**Decisions to note**
- Your Japanese/German plans are added in Stage 6 through a button you press, so nothing is ever inserted into your data automatically.
- July 2027 will be labelled "planned exam period", not an official date.
- No streaks, XP or quotes anywhere. Missed days are never highlighted as failures.
