import { useMemo, useState } from 'react'

type DayCount = { 
  date: string
  count: number
  repositories?: { name: string; commits: number; additions: number; deletions: number }[]
}

interface ActivityHeatmapProps {
  data: DayCount[]
  weeks?: number
  size?: number
  gap?: number
  className?: string
  showRepositories?: boolean
  tooltipLabel?: string // 'repositories' or 'contributors'
}

function getColor(count: number) {
  if (count <= 0) return 'bg-muted'
  if (count === 1) return 'bg-emerald-100'
  if (count <= 3) return 'bg-emerald-200'
  if (count <= 6) return 'bg-emerald-300'
  return 'bg-emerald-500'
}

export function ActivityHeatmap({ data, weeks = 53, size = 10, gap = 2, className = '', showRepositories = false, tooltipLabel = 'repositories' }: ActivityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<DayCount | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const map = useMemo(() => {
    const m = new Map<string, DayCount>()
    for (const d of data) {
      const existing = m.get(d.date)
      if (existing) {
        m.set(d.date, {
          date: d.date,
          count: existing.count + d.count,
          repositories: [...(existing.repositories || []), ...(d.repositories || [])]
        })
      } else {
        m.set(d.date, d)
      }
    }
    return m
  }, [data])

  const days = useMemo(() => {
    const today = new Date()
    const cells: DayCount[] = []
    const totalDays = weeks * 7
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      cells.push(map.get(key) || { date: key, count: 0, repositories: [] })
    }
    return cells
  }, [map, weeks])

  const tooltipLabelText = tooltipLabel === 'contributors' ? 'Contributors' : 'By Repository'

  return (
    <div className={`overflow-x-auto w-full ${className}`} aria-label="activity heatmap">
      <div className="flex gap-[2px] pb-2 min-w-fit relative">
        {/* columns by weeks */}
        {Array.from({ length: weeks }).map((_, col) => (
          <div key={col} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }).map((__, row) => {
              const idx = col * 7 + row
              const cell = days[idx]
              return (
                <div
                  key={row}
                  className={`rounded-sm cursor-pointer transition-opacity hover:opacity-80 ${getColor(cell?.count || 0)}`}
                  style={{ width: size, height: size }}
                  onMouseEnter={(e) => {
                    if (showRepositories && cell?.repositories && cell.repositories.length > 0) {
                      setHoveredCell(cell)
                      const rect = e.currentTarget.getBoundingClientRect()
                      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
                    }
                  }}
                  onMouseLeave={() => setHoveredCell(null)}
                  title={!showRepositories ? `${cell?.date || ''}: ${cell?.count || 0} commits` : undefined}
                />
              )
            })}
          </div>
        ))}
        
        {/* Tooltip */}
        {hoveredCell && showRepositories && hoveredCell.repositories && hoveredCell.repositories.length > 0 && (
          <div 
            className="fixed bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-gray-700 z-50 pointer-events-none"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y - 10}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <p className="font-semibold mb-1">{hoveredCell.date}</p>
            <p className="text-sm mb-1">{hoveredCell.count} commit{hoveredCell.count !== 1 ? 's' : ''}</p>
            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400 mb-1">{tooltipLabelText}:</p>
              {hoveredCell.repositories.map((repo, idx) => (
                <p key={idx} className="text-xs">
                  <span className="text-gray-300">{repo.name}:</span>{' '}
                  <span className="text-blue-400">{repo.commits} commit{repo.commits !== 1 ? 's' : ''}</span>
                  {repo.additions > 0 || repo.deletions > 0 ? (
                    <>
                      {' '}(<span className="text-green-400">+{repo.additions}</span>{' '}
                      <span className="text-red-400">-{repo.deletions}</span>)
                    </>
                  ) : null}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityHeatmap
