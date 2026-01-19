import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface Repository {
  name: string
  commits: number
  additions?: number
}

interface CommitChartProps {
  data: { date: string; commits: number; repositories?: Repository[]; additions?: number }[]
  height?: number
  showAdditions?: boolean
}

export function CommitChart({ data, height = 200, showAdditions = false }: CommitChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: any } | null>(null)

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    const container = svgRef.current.parentElement
    if (!container) return

    const width = container.clientWidth
    const margin = { top: 10, right: 10, bottom: 30, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    svg.selectAll('*').remove()

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, d => new Date(d.date)) as [Date, Date])
      .range([0, innerWidth])

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => showAdditions ? (d.additions || 0) : d.commits) as number])
      .nice()
      .range([innerHeight, 0])

    const area = d3
      .area<{ date: string; commits: number; additions?: number }>()
      .x(d => x(new Date(d.date)))
      .y0(innerHeight)
      .y1(d => y(showAdditions ? (d.additions || 0) : d.commits))
      .curve(d3.curveMonotoneX)

    const line = d3
      .line<{ date: string; commits: number; additions?: number }>()
      .x(d => x(new Date(d.date)))
      .y(d => y(showAdditions ? (d.additions || 0) : d.commits))
      .curve(d3.curveMonotoneX)

    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'areaGradient')
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '0%')
      .attr('y2', '100%')

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'oklch(0.68 0.15 210)')
      .attr('stop-opacity', 0.4)

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'oklch(0.68 0.15 210)')
      .attr('stop-opacity', 0)

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#areaGradient)')
      .attr('d', area)

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'oklch(0.68 0.15 210)')
      .attr('stroke-width', 2)
      .attr('d', line)

    const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d => {
      const date = d as Date
      return d3.timeFormat('%b %d')(date)
    })

    const yAxis = d3.axisLeft(y).ticks(5)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '11px')
      .style('fill', 'oklch(0.50 0.02 240)')

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '11px')
      .style('fill', 'oklch(0.50 0.02 240)')

    g.selectAll('.domain, .tick line')
      .style('stroke', 'oklch(0.88 0.01 240)')

    // Add invisible overlay for tooltip
    const overlay = g.append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .style('fill', 'none')
      .style('pointer-events', 'all')

    const bisect = d3.bisector<any, Date>((d: any) => new Date(d.date)).left

    overlay.on('mousemove', function(event) {
      const [mouseX] = d3.pointer(event)
      const x0 = x.invert(mouseX)
      const i = bisect(data, x0, 1)
      const d0 = data[i - 1]
      const d1 = data[i]
      const d = x0.getTime() - new Date(d0?.date).getTime() > new Date(d1?.date).getTime() - x0.getTime() ? d1 : d0
      
      if (d) {
        const xPos = x(new Date(d.date))
        const yPos = y(showAdditions ? (d.additions || 0) : d.commits)
        setTooltip({
          x: xPos + margin.left,
          y: yPos + margin.top,
          data: d
        })
      }
    })

    overlay.on('mouseleave', () => {
      setTooltip(null)
    })

  }, [data, height, showAdditions])

  return (
    <div className="w-full relative">
      <svg ref={svgRef} />
      {tooltip && (
        <div
          className="absolute bg-slate-900 text-white text-xs rounded-lg p-3 pointer-events-none shadow-lg z-10"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 10}px`,
            transform: 'translate(-50%, -100%)',
            minWidth: '200px'
          }}
        >
          <div className="font-semibold mb-2">{new Date(tooltip.data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div className="font-bold text-blue-400 mb-2">
            {showAdditions ? `${tooltip.data.additions?.toLocaleString() || 0} lines added` : `${tooltip.data.commits} commits`}
          </div>
          {tooltip.data.repositories && tooltip.data.repositories.length > 0 && (
            <div className="border-t border-slate-700 pt-2 mt-2">
              <div className="text-slate-400 text-[10px] uppercase tracking-wide mb-1">By Repository:</div>
              {tooltip.data.repositories.map((repo: Repository, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-0.5">
                  <span className="text-slate-300 truncate max-w-[120px]" title={repo.name}>{repo.name}</span>
                  <span className="text-blue-400 ml-2">
                    {showAdditions ? `+${repo.additions?.toLocaleString() || 0}` : `${repo.commits}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
