import { useMemo } from 'react'

type DayCount = { date: string; count: number }

interface ActivityHeatmapProps {
  data: DayCount[]
  weeks?: number
  size?: number
  gap?: number
  className?: string
}

function getColor(count: number) {
  if (count <= 0) return 'bg-muted'
  if (count === 1) return 'bg-emerald-100'
  if (count <= 3) return 'bg-emerald-200'
  if (count <= 6) return 'bg-emerald-300'
  return 'bg-emerald-500'
}

export function ActivityHeatmap({ data, weeks = 53, size = 10, gap = 2, className = '' }: ActivityHeatmapProps) {
  const map = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of data) {
      m.set(d.date, (m.get(d.date) || 0) + d.count)
    }
    return m
  }, [data])

  const days = useMemo(() => {
    const today = new Date()
    const cells: { date: string; count: number }[] = []
    const totalDays = weeks * 7
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      cells.push({ date: key, count: map.get(key) || 0 })
    }
    return cells
  }, [map, weeks])

  return (
    <div className={`flex gap-${gap} ${className}`} aria-label="activity heatmap">
      {/* columns by weeks */}
      {Array.from({ length: weeks }).map((_, col) => (
        <div key={col} className="flex flex-col gap-[2px]">
          {Array.from({ length: 7 }).map((__, row) => {
            const idx = col * 7 + row
            const cell = days[idx]
            const title = `${cell?.date || ''}: ${cell?.count || 0} commits`
            return (
              <div
                key={row}
                title={title}
                className={`rounded-sm ${getColor(cell?.count || 0)}`}
                style={{ width: size, height: size }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default ActivityHeatmap
