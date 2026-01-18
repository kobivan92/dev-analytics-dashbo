import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface LanguageChartProps {
  data: { language: string; percentage: number }[]
  size?: number
}

export function LanguageChart({ data, size = 200 }: LanguageChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = size
    const height = size
    const radius = Math.min(width, height) / 2

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`)

    const color = d3.scaleOrdinal([
      'oklch(0.68 0.15 210)',
      'oklch(0.65 0.18 280)',
      'oklch(0.70 0.15 160)',
      'oklch(0.72 0.18 310)',
      'oklch(0.66 0.16 50)',
      'oklch(0.60 0.12 180)',
    ])

    const pie = d3.pie<{ language: string; percentage: number }>()
      .value(d => d.percentage)
      .sort(null)

    const arc = d3.arc<d3.PieArcDatum<{ language: string; percentage: number }>>()
      .innerRadius(radius * 0.6)
      .outerRadius(radius * 0.9)

    const arcs = g
      .selectAll('arc')
      .data(pie(data))
      .enter()
      .append('g')

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', (_, i) => color(i.toString()))
      .attr('stroke', 'oklch(0.98 0.005 240)')
      .attr('stroke-width', 2)
      .on('mouseenter', function() {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('opacity', 0.8)
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('opacity', 1)
      })

  }, [data, size])

  return (
    <div className="flex flex-col items-center gap-4">
      <svg ref={svgRef} />
      <div className="flex flex-wrap gap-3 justify-center">
        {data.map((item, index) => (
          <div key={item.language} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: [
                  'oklch(0.68 0.15 210)',
                  'oklch(0.65 0.18 280)',
                  'oklch(0.70 0.15 160)',
                  'oklch(0.72 0.18 310)',
                  'oklch(0.66 0.16 50)',
                  'oklch(0.60 0.12 180)',
                ][index % 6],
              }}
            />
            <span className="text-sm">
              {item.language} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
