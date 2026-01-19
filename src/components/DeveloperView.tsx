import { MetricCard } from '@/components/MetricCard'
import { CommitChart } from '@/components/CommitChart'
import { ActivityHeatmap } from '@/components/ActivityHeatmap'
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'

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
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('week')
  
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const daysMap = { day: 1, week: 7, month: 30 }
        const days = daysMap[timePeriod]
        const res = await fetch(`http://localhost:3001/api/developers/${encodeURIComponent(developer.id)}/metrics?days=${days}`)
        const data = await res.json()
        setApiMetrics(data)
      } catch (err) {
        console.error('Failed to fetch developer metrics:', err)
      }
    }
    fetchMetrics()
  }, [developer.id, timePeriod])

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
          value={(apiMetrics?.totalCommits || metrics?.totalCommits || 0).toLocaleString()}
          icon={<Code size={20} />}
          delay={0.1}
        />
        <MetricCard
          title="Pull Requests"
          value={(apiMetrics?.pullRequests || metrics?.pullRequests || 0).toLocaleString()}
          icon={<GitPullRequest size={20} />}
          delay={0.2}
        />
        <MetricCard
          title="Reviews Given"
          value={(apiMetrics?.reviewsGiven || metrics?.reviewsGiven || 0).toLocaleString()}
          icon={<Users size={20} />}
          delay={0.3}
        />
        <MetricCard
          title="Active Repos"
          value={apiMetrics?.activeRepos || metrics?.activeRepos || 0}
          icon={<GitBranch size={20} />}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code Statistics</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={timePeriod === 'day' ? 'default' : 'outline'}
                    onClick={() => setTimePeriod('day')}
                  >
                    1 Day
                  </Button>
                  <Button
                    size="sm"
                    variant={timePeriod === 'week' ? 'default' : 'outline'}
                    onClick={() => setTimePeriod('week')}
                  >
                    1 Week
                  </Button>
                  <Button
                    size="sm"
                    variant={timePeriod === 'month' ? 'default' : 'outline'}
                    onClick={() => setTimePeriod('month')}
                  >
                    1 Month
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Lines Added</div>
                  <div className="text-2xl font-mono font-bold text-green-600">
                    +{(apiMetrics?.linesAdded || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Lines Deleted</div>
                  <div className="text-2xl font-mono font-bold text-red-600">
                    -{(apiMetrics?.linesDeleted || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Net Change</div>
                  <div className="text-2xl font-mono font-bold">
                    {((apiMetrics?.linesAdded || 0) - (apiMetrics?.linesDeleted || 0)).toLocaleString()}
                  </div>
                </div>
              </div>
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
              <CardTitle>Contribution Heatmap (Last Year)</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap 
                data={(apiMetrics?.commitHistory || []).map((d: any) => ({ 
                  date: d.date, 
                  count: d.commits,
                  repositories: d.repositories 
                }))}
                weeks={26}
                size={8}
                showRepositories={true}
              />
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
            <CardTitle>Code Activity (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {(apiMetrics?.monthlyActivity || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={apiMetrics.monthlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const data = payload[0].payload
                      return (
                        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg border border-gray-700">
                          <p className="font-semibold mb-2">{data.month}</p>
                          <p className="text-green-400">+{data.additions?.toLocaleString()} added</p>
                          <p className="text-red-400">-{data.deletions?.toLocaleString()} deleted</p>
                          {data.repositories && data.repositories.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-700">
                              <p className="text-xs text-gray-400 mb-1">By Repository:</p>
                              {data.repositories.map((repo: any, idx: number) => (
                                <p key={idx} className="text-xs">
                                  <span className="text-gray-300">{repo.name}:</span>{' '}
                                  <span className="text-green-400">+{repo.additions}</span>{' '}
                                  <span className="text-red-400">-{repo.deletions}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  <Legend />
                  <Bar dataKey="additions" name="Lines Added" stackId="a" fill="#10b981" />
                  <Bar dataKey="deletions" name="Lines Deleted" stackId="a" fill="#ef4444" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-12">No monthly activity data</div>
            )}
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
            <CardTitle>Commit History (Last 90 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {(apiMetrics?.commitHistory || []).length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {apiMetrics.commitHistory
                  .slice()
                  .reverse()
                  .slice(0, 30)
                  .map((entry: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted transition-colors">
                      <span className="text-sm font-mono">{entry.date}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{entry.commits} commit{entry.commits !== 1 ? 's' : ''}</span>
                        <span className="text-xs text-green-600">+{entry.additions || 0}</span>
                        <span className="text-xs text-red-600">-{entry.deletions || 0}</span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No commit history available</div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
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
