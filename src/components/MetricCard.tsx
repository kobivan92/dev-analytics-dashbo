import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendUp, TrendDown } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon?: React.ReactNode
  delay?: number
}

export function MetricCard({ title, value, change, icon, delay = 0 }: MetricCardProps) {
  const hasPositiveChange = change !== undefined && change > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      <Card className="hover:shadow-lg transition-shadow duration-150">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono tracking-tight">{value}</div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${hasPositiveChange ? 'text-green-600' : 'text-red-600'}`}>
              {hasPositiveChange ? (
                <TrendUp size={16} weight="bold" />
              ) : (
                <TrendDown size={16} weight="bold" />
              )}
              <span className="font-medium">
                {Math.abs(change)}% from last period
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
