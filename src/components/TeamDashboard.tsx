import { MetricCard } from '@/components/MetricCard'
import { CommitChart } from '@/components/CommitChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Code, Users, GitPullRequest, GitBranch } from '@phosphor-icons/react'
import type { TeamMetrics, Developer, DeveloperMetrics } from '@/lib/types'
import { motion } from 'framer-motion'

interface TeamDashboardProps {
  teamMetrics: TeamMetrics
  developers: Developer[]
  devMetrics: Map<string, DeveloperMetrics>
  onSelectDeveloper: (devId: string) => void
}

export function TeamDashboard({ teamMetrics, developers, devMetrics, onSelectDeveloper }: TeamDashboardProps) {
  const topContributors = developers
    .map(dev => ({
      ...dev,
      commits: devMetrics.get(dev.id)?.totalCommits || 0,
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 5)

  return (
    <div className="space-y-6">
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
