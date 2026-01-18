import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface CommitChartProps {
  data: { date: string; commits: number }[]
  height?: number
}

export function CommitChart({ data, height = 200 }: CommitChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

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
      .domain([0, d3.max(data, d => d.commits) as number])
      .nice()
      .range([innerHeight, 0])

    const area = d3
      .area<{ date: string; commits: number }>()
      .x(d => x(new Date(d.date)))
      .y0(innerHeight)
      .y1(d => y(d.commits))
      .curve(d3.curveMonotoneX)

    const line = d3
      .line<{ date: string; commits: number }>()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.commits))
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

  }, [data, height])

  return (
    <div className="w-full">
      <svg ref={svgRef} />
    </div>
  )
}
