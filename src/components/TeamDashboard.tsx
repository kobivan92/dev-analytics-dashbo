import { MetricCard } from '@/components/MetricCard'
import { CommitChart } from '@/components/CommitChart'
import { TaskCompletionChart } from '@/components/TaskCompletionChart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Code, Users, GitPullRequest, GitBranch, CheckCircle, Clock, Target, Hourglass } from '@phosphor-icons/react'
import type { TeamMetrics, Developer, DeveloperMetrics, TeamTaskMetrics, TaskPriority } from '@/lib/types'
import { motion } from 'framer-motion'

interface TeamDashboardProps {
  teamMetrics: TeamMetrics
  teamTaskMetrics: TeamTaskMetrics
  developers: Developer[]
  devMetrics: Map<string, DeveloperMetrics>
  onSelectDeveloper: (devId: string) => void
}

const priorityColors: Record<TaskPriority, string> = {
  Low: 'bg-blue-500/10 text-blue-700 border-blue-200',
  Normal: 'bg-slate-500/10 text-slate-700 border-slate-200',
  High: 'bg-orange-500/10 text-orange-700 border-orange-200',
  Critical: 'bg-red-500/10 text-red-700 border-red-200',
}

export function TeamDashboard({ teamMetrics, teamTaskMetrics, developers, devMetrics, onSelectDeveloper }: TeamDashboardProps) {
  const topContributors = developers
    .map(dev => ({
      ...dev,
      commits: dev.totalCommits || 0,
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 5)

  const efficiencyPercentage = teamTaskMetrics.totalEstimatedHours > 0
    ? Math.round((teamTaskMetrics.totalActualHours / teamTaskMetrics.totalEstimatedHours) * 100)
    : 100

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold mb-4">Git Repository Metrics</h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Commits"
          value={teamMetrics.totalCommits.toLocaleString()}
          icon={<Code size={20} />}
          change={12}
          delay={0}
        />
        <MetricCard
          title="Pull Requests"
          value={teamMetrics.totalPullRequests.toLocaleString()}
          icon={<GitPullRequest size={20} />}
          change={8}
          delay={0.1}
        />
        <MetricCard
          title="Code Reviews"
          value={teamMetrics.totalReviews.toLocaleString()}
          icon={<Users size={20} />}
          change={-3}
          delay={0.2}
        />
        <MetricCard
          title="Active Repos"
          value={teamMetrics.activeRepositories}
          icon={<GitBranch size={20} />}
          delay={0.3}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Commit Activity (Last 90 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <CommitChart data={teamMetrics.commitTrend} height={250} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <h2 className="text-2xl font-bold mb-4">SharePoint Task Metrics</h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Tasks"
          value={teamTaskMetrics.totalTasksActive.toLocaleString()}
          icon={<Hourglass size={20} />}
          delay={0.6}
        />
        <MetricCard
          title="Tasks Resolved"
          value={teamTaskMetrics.totalTasksResolved.toLocaleString()}
          icon={<CheckCircle size={20} />}
          delay={0.7}
        />
        <MetricCard
          title="Avg Resolution Time"
          value={`${teamTaskMetrics.avgResolutionTime}d`}
          icon={<Clock size={20} />}
          delay={0.8}
        />
        <MetricCard
          title="Efficiency"
          value={`${efficiencyPercentage}%`}
          icon={<Target size={20} />}
          delay={0.9}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.0 }}
        >
          <TaskCompletionChart 
            data={teamTaskMetrics.taskCompletionTrend}
            title="Task Completion Trend"
            description="Tasks resolved over time"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Tasks by Priority</CardTitle>
              <CardDescription>Distribution across priority levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamTaskMetrics.tasksByPriority.map(({ priority, count }) => (
                  <div key={priority} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={priorityColors[priority]}>
                        {priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{
                            width: `${(count / teamTaskMetrics.totalTasksResolved) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-12 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Top Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topContributors.map((dev, index) => (
                <button
                  key={dev.id}
                  onClick={() => onSelectDeveloper(dev.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={dev.avatar} alt={dev.name} />
                        <AvatarFallback>
                          {dev.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold group-hover:text-accent transition-colors">
                        {dev.name}
                      </div>
                      <div className="text-sm text-muted-foreground">{dev.role}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-mono font-bold">{dev.commits.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">commits</div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
