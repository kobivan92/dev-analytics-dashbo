import { MetricCard } from '@/components/MetricCard'
import { CommitChart } from '@/components/CommitChart'
import { TaskCompletionChart } from '@/components/TaskCompletionChart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Code, Users, GitPullRequest, GitBranch, CheckCircle, Clock, Target, Hourglass, Funnel } from '@phosphor-icons/react'
import type { TeamMetrics, Developer, DeveloperMetrics, TeamTaskMetrics, TaskPriority } from '@/lib/types'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

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
  const [commitActivityDays, setCommitActivityDays] = useState<number>(90)
  const [commitActivityData, setCommitActivityData] = useState<{ date: string; commits: number }[]>([])
  const [showAllContributors, setShowAllContributors] = useState<boolean>(false)
  const [contributorSortBy, setContributorSortBy] = useState<'commits' | 'name'>('commits')
  
  const currentTeamMembers = ['grammaton88', 'kobivan', 'Ilia', 'Ilia Lomsadze', 'abezhitashvili', 'gchutlashvili', 'vumpy']
  
  // Initialize with current team members only
  const [selectedDevelopers, setSelectedDevelopers] = useState<Set<string>>(() => {
    const currentTeamIds = developers.filter(d => currentTeamMembers.includes(d.id)).map(d => d.id)
    return new Set(currentTeamIds)
  })

  // Update selected developers to current team when developers list changes
  useEffect(() => {
    const currentTeamIds = developers.filter(d => currentTeamMembers.includes(d.id)).map(d => d.id)
    setSelectedDevelopers(new Set(currentTeamIds))
  }, [developers])

  useEffect(() => {
    const fetchCommitActivity = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/team/activity?days=${commitActivityDays}`)
        const data = await res.json()
        setCommitActivityData(data)
      } catch (err) {
        console.error('Failed to fetch commit activity:', err)
      }
    }
    fetchCommitActivity()
  }, [commitActivityDays])

  const topContributors = developers
    .filter(dev => selectedDevelopers.has(dev.id))
    .map(dev => ({
      ...dev,
      commits: dev.totalCommits || 0,
    }))
    .sort((a, b) => {
      if (contributorSortBy === 'commits') {
        return b.commits - a.commits
      } else {
        return a.name.localeCompare(b.name)
      }
    })
    .slice(0, showAllContributors ? developers.length : 5)

  const toggleDeveloper = (devId: string) => {
    const newSelected = new Set(selectedDevelopers)
    if (newSelected.has(devId)) {
      newSelected.delete(devId)
    } else {
      newSelected.add(devId)
    }
    setSelectedDevelopers(newSelected)
  }

  const toggleAllDevelopers = () => {
    if (selectedDevelopers.size === developers.length) {
      setSelectedDevelopers(new Set())
    } else {
      setSelectedDevelopers(new Set(developers.map(d => d.id)))
    }
  }

  const filterCurrentTeam = () => {
    const currentTeam = new Set(
      developers
        .filter(dev => currentTeamMembers.includes(dev.id))
        .map(dev => dev.id)
    )
    setSelectedDevelopers(currentTeam)
  }

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
          change={teamMetrics.comparison?.commits?.changePercent}
          delay={0}
        />
        <MetricCard
          title="Pull Requests"
          value={teamMetrics.totalPullRequests.toLocaleString()}
          icon={<GitPullRequest size={20} />}
          change={teamMetrics.comparison?.pullRequests?.changePercent}
          delay={0.1}
        />
        <MetricCard
          title="Code Reviews"
          value={teamMetrics.totalReviews.toLocaleString()}
          icon={<Users size={20} />}
          change={teamMetrics.comparison?.reviews?.changePercent}
          delay={0.2}
        />
        <MetricCard
          title="Active Repos"
          value={teamMetrics.activeRepositories}
          icon={<GitBranch size={20} />}
          change={teamMetrics.comparison?.activeRepos?.changePercent}
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
            <div className="flex items-center justify-between">
              <CardTitle>Commit Activity</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={commitActivityDays === 7 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(7)}
                >
                  7 Days
                </Button>
                <Button
                  size="sm"
                  variant={commitActivityDays === 30 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(30)}
                >
                  30 Days
                </Button>
                <Button
                  size="sm"
                  variant={commitActivityDays === 90 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(90)}
                >
                  90 Days
                </Button>
                <Button
                  size="sm"
                  variant={commitActivityDays === 180 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(180)}
                >
                  180 Days
                </Button>
                <Button
                  size="sm"
                  variant={commitActivityDays === 365 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(365)}
                >
                  1 Year
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CommitChart data={commitActivityData} height={250} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lines of Code Added</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={commitActivityDays === 7 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(7)}
                >
                  7 Days
                </Button>
                <Button
                  size="sm"
                  variant={commitActivityDays === 30 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(30)}
                >
                  30 Days
                </Button>
                <Button
                  size="sm"
                  variant={commitActivityDays === 90 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(90)}
                >
                  90 Days
                </Button>
                <Button
                  size="sm"
                  variant={commitActivityDays === 180 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(180)}
                >
                  180 Days
                </Button>
                <Button
                  size="sm"
                  variant={commitActivityDays === 365 ? 'default' : 'outline'}
                  onClick={() => setCommitActivityDays(365)}
                >
                  1 Year
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CommitChart data={commitActivityData} height={250} showAdditions={true} />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        <h2 className="text-2xl font-bold mb-4">SharePoint Task Metrics</h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Tasks"
          value={teamTaskMetrics.totalTasksActive.toLocaleString()}
          icon={<Hourglass size={20} />}
          delay={0.7}
        />
        <MetricCard
          title="Tasks Resolved"
          value={teamTaskMetrics.totalTasksResolved.toLocaleString()}
          icon={<CheckCircle size={20} />}
          delay={0.8}
        />
        <MetricCard
          title="Avg Resolution Time"
          value={`${teamTaskMetrics.avgResolutionTime}d`}
          icon={<Clock size={20} />}
          delay={0.9}
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
            <div className="flex items-center justify-between">
              <CardTitle>Top Contributors</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={contributorSortBy === 'commits' ? 'default' : 'outline'}
                  onClick={() => setContributorSortBy('commits')}
                >
                  By Commits
                </Button>
                <Button
                  size="sm"
                  variant={contributorSortBy === 'name' ? 'default' : 'outline'}
                  onClick={() => setContributorSortBy('name')}
                >
                  By Name
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Funnel size={16} className="mr-1" />
                      Filter ({selectedDevelopers.size}/{developers.length})
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64" align="end">
                    <div className="space-y-4">
                      <div className="font-semibold text-sm">Select Developers</div>
                      <div className="flex flex-col gap-2 pb-2 border-b">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="select-all"
                            checked={selectedDevelopers.size === developers.length}
                            onCheckedChange={toggleAllDevelopers}
                          />
                          <label
                            htmlFor="select-all"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            Select All
                          </label>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={filterCurrentTeam}
                          className="w-full"
                        >
                          Current Team ({currentTeamMembers.length})
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {developers
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(dev => (
                            <div key={dev.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`dev-${dev.id}`}
                                checked={selectedDevelopers.has(dev.id)}
                                onCheckedChange={() => toggleDeveloper(dev.id)}
                              />
                              <label
                                htmlFor={`dev-${dev.id}`}
                                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                              >
                                {dev.name} ({dev.totalCommits || 0})
                              </label>
                            </div>
                          ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  size="sm"
                  variant={showAllContributors ? 'default' : 'outline'}
                  onClick={() => setShowAllContributors(!showAllContributors)}
                >
                  {showAllContributors ? `All (${topContributors.length})` : 'Top 5'}
                </Button>
              </div>
            </div>
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
                      {contributorSortBy === 'commits' && (
                        <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </div>
                      )}
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
