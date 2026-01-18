import { MetricCard } from '@/components/MetricCard'
import { CommitChart } from '@/components/CommitChart'
import { LanguageChart } from '@/components/LanguageChart'
import { TaskMetrics } from '@/components/TaskMetrics'
import { TaskCompletionChart } from '@/components/TaskCompletionChart'
import { DeveloperTaskDrilldown } from '@/components/DeveloperTaskDrilldown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Code, GitPullRequest, Users, GitBranch, ArrowLeft } from '@phosphor-icons/react'
import type { Developer, DeveloperMetrics, DeveloperTaskMetrics, SharePointTask } from '@/lib/types'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface DeveloperViewProps {
  developer: Developer
  metrics: DeveloperMetrics
  taskMetrics: DeveloperTaskMetrics
  tasks: SharePointTask[]
  developers: Developer[]
  onBack: () => void
}

export function DeveloperView({ developer, metrics, taskMetrics, tasks, developers, onBack }: DeveloperViewProps) {
  const [apiMetrics, setApiMetrics] = useState<any>(null)
  
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/developers/${encodeURIComponent(developer.id)}/metrics`)
        const data = await res.json()
        setApiMetrics(data)
      } catch (err) {
        console.error('Failed to fetch developer metrics:', err)
      }
    }
    fetchMetrics()
  }, [developer.id])

  const maxWeekdayCommits = metrics.weekdayActivity?.length > 0 
    ? Math.max(...metrics.weekdayActivity.map(d => d.commits))
    : 1

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft size={16} />
        Back to Team
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={developer.avatar} alt={developer.name} />
                <AvatarFallback>
                  {developer.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-3xl font-bold">{developer.name}</h2>
                <p className="text-muted-foreground">{developer.role}</p>
                <p className="text-sm text-muted-foreground">{developer.email}</p>
              </div>
              <Badge variant="secondary" className="text-sm">
                Member since {new Date(developer.joinedDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h3 className="text-xl font-bold mb-4">Git Activity Metrics</h3>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Commits"
          value={(apiMetrics?.totalCommits || metrics.totalCommits).toLocaleString()}
          icon={<Code size={20} />}
          delay={0.1}
        />
        <MetricCard
          title="Pull Requests"
          value={(apiMetrics?.pullRequests || metrics.pullRequests).toLocaleString()}
          icon={<GitPullRequest size={20} />}
          delay={0.2}
        />
        <MetricCard
          title="Reviews Given"
          value={(apiMetrics?.reviewsGiven || metrics.reviewsGiven).toLocaleString()}
          icon={<Users size={20} />}
          delay={0.3}
        />
        <MetricCard
          title="Active Repos"
          value={apiMetrics?.activeRepos || metrics.activeRepos}
          icon={<GitBranch size={20} />}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Commit History</CardTitle>
            </CardHeader>
            <CardContent>
              <CommitChart data={metrics.commitHistory} height={200} />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Language Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <LanguageChart data={metrics.languageBreakdown} size={200} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Activity by Day of Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.weekdayActivity.map(day => (
                <div key={day.day} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium">{day.day}</div>
                  <div className="flex-1">
                    <div className="relative h-8 bg-muted rounded-md overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-accent rounded-md"
                        initial={{ width: 0 }}
                        animate={{ width: `${(day.commits / maxWeekdayCommits) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.8, ease: 'easeOut' }}
                      />
                      <div className="relative h-full flex items-center px-3 text-sm font-mono font-semibold">
                        {day.commits}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Code Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Lines Added</div>
                <div className="text-2xl font-mono font-bold text-green-600">
                  +{metrics.linesAdded.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Lines Deleted</div>
                <div className="text-2xl font-mono font-bold text-red-600">
                  -{metrics.linesDeleted.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Net Change</div>
                <div className="text-2xl font-mono font-bold">
                  {(metrics.linesAdded - metrics.linesDeleted).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.9 }}
      >
        <h3 className="text-xl font-bold mb-4">SharePoint Task Metrics</h3>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.0 }}
      >
        <TaskMetrics metrics={taskMetrics} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.1 }}
      >
        <TaskCompletionChart 
          data={taskMetrics.tasksOverTime}
          title="Task Resolution Timeline"
          description="Tasks resolved over time period"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.2 }}
      >
        <DeveloperTaskDrilldown
          tasks={tasks}
          developerId={developer.id}
          developers={developers}
        />
      </motion.div>
    </div>
  )
}
