import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Series } from '../lib/analytics'
import { formatDuration } from '../lib/time'

// Monochrome ramp, darkest first. "Other" always gets the lightest grey.
const GREYS = ['#111111', '#4a4a46', '#76766f', '#9d9d96', '#bdbdb6', '#d3d3cd', '#e6e6e0']
const tick = { fill: '#6B6B66', fontSize: 12 }

const hoursLabel = (h: number) => formatDuration(h * 3600)

function colorFor(keys: string[], key: string) {
  if (key === 'Other') return GREYS[GREYS.length - 1]
  return GREYS[Math.min(keys.indexOf(key), GREYS.length - 2)]
}

/** Stacked bars: time per day/week/month, split by activity. */
export function StackedTimeChart({ series }: { series: Series }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Stacked bar chart of time per period, split by activity">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series.data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E4E4DE" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: '#E4E4DE' }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}h`} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: '#F1F1EC' }}
            formatter={(v) => hoursLabel(Number(v))}
            contentStyle={{ border: '1px solid #E4E4DE', borderRadius: 6, boxShadow: 'none', fontSize: 13 }}
          />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {series.keys.map((k) => (
            <Bar key={k} dataKey={k} stackId="t" fill={colorFor(series.keys, k)} stroke="#FAFAF7" strokeWidth={1} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const LINES: { key: string; label: string; color: string; dash?: string }[] = [
  { key: 'initialPct', label: 'Initial accuracy', color: '#111111' },
  { key: 'recall24Pct', label: '24-hour recall', color: '#4a4a46', dash: '6 3' },
  { key: 'retention7Pct', label: '7-day retention', color: '#76766f', dash: '2 3' },
  { key: 'unfamiliarPct', label: 'Unfamiliar questions', color: '#111111', dash: '10 4' },
  { key: 'applicationPct', label: 'Practical application', color: '#9d9d96' },
]

/** Weekly averages of the follow-up checks. Lines differ by dash pattern as well as grey. */
export function AssessmentChart({ data }: { data: Record<string, number | string | undefined>[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Line chart of weekly average accuracy, recall and retention">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E4E4DE" />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: '#E4E4DE' }} />
          <YAxis domain={[0, 100]} tick={tick} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip formatter={(v) => `${Math.round(Number(v))}%`} contentStyle={{ border: '1px solid #E4E4DE', borderRadius: 6, boxShadow: 'none', fontSize: 13 }} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {LINES.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeDasharray={l.dash}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
