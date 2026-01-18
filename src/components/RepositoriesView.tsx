import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { GitBranch, GitMerge } from '@phosphor-icons/react'
import type { Repository, Developer } from '@/lib/types'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from '@phosphor-icons/react'

interface RepositoriesViewProps {
  repositories: Repository[]
  developers: Developer[]
}

interface Branch {
  name: string
  isDefault: boolean
  lastCommitDate: string | null
  commitCount: number
}

export function RepositoriesView({ repositories, developers }: RepositoriesViewProps) {
  const [sortBy, setSortBy] = useState<'commits' | 'health' | 'activity'>('commits')
  const [branches, setBranches] = useState<Record<string, Branch[]>>({})
  const [loadingBranches, setLoadingBranches] = useState<Record<string, boolean>>({})
  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({})

  const fetchBranches = async (repoId: string) => {
    if (branches[repoId] || loadingBranches[repoId]) return
    
    setLoadingBranches(prev => ({ ...prev, [repoId]: true }))
    try {
      const response = await fetch(`http://localhost:3001/api/repositories/${encodeURIComponent(repoId)}/branches`)
      const data = await response.json()
      setBranches(prev => ({ ...prev, [repoId]: data }))
    } catch (error) {
      console.error('Failed to fetch branches:', error)
    } finally {
      setLoadingBranches(prev => ({ ...prev, [repoId]: false }))
    }
  }

  const toggleBranches = (repoId: string) => {
    setOpenBranches(prev => ({ ...prev, [repoId]: !prev[repoId] }))
    if (!branches[repoId]) {
      fetchBranches(repoId)
    }
  }

  const sortedRepos = [...repositories].sort((a, b) => {
    if (sortBy === 'commits') return b.totalCommits - a.totalCommits
    if (sortBy === 'health') return b.healthScore - a.healthScore
    const aDate = new Date(a.lastActivity).getTime()
    const bDate = new Date(b.lastActivity).getTime()
    return bDate - aDate
  })

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getTimeAgo = (date: string) => {
    const past = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - past.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    // Show actual date for clarity
    const formatted = past.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
    
    if (diffDays === 0) return `Today (${formatted})`
    if (diffDays === 1) return `Yesterday (${formatted})`
    if (diffDays < 7) return `${diffDays} days ago (${formatted})`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago (${formatted})`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago (${formatted})`
    return formatted
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Repositories</h2>
        <div className="flex gap-2">
          <Badge
            variant={sortBy === 'commits' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSortBy('commits')}
          >
            By Commits
          </Badge>
          <Badge
            variant={sortBy === 'health' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSortBy('health')}
          >
            By Health
          </Badge>
          <Badge
            variant={sortBy === 'activity' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setSortBy('activity')}
          >
            By Activity
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sortedRepos.map((repo, index) => (
          <motion.div
            key={repo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card className="hover:shadow-lg transition-shadow duration-150">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <GitBranch size={24} className="text-primary" />
                    <div className="flex-1">
                      <CardTitle className="text-lg">{repo.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {repo.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{repo.primaryLanguage}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Total Commits</div>
                      <div className="text-xl font-mono font-bold">
                        {repo.totalCommits.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Contributors</div>
                      <div className="text-xl font-mono font-bold">{repo.contributors}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Last Activity</div>
                      <div className="text-sm font-medium">{getTimeAgo(repo.lastActivity)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Health Score</div>
                      <div className={`text-xl font-mono font-bold ${getHealthColor(repo.healthScore)}`}>
                        {repo.healthScore}%
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Repository Health</div>
                    <Progress value={repo.healthScore} className="h-2" />
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-3">Top Contributors</div>
                    <div className="flex flex-wrap gap-3">
                      {repo.topContributors.map(contributor => {
                        const dev = developers.find(d => d.id === contributor.developerId)
                        if (!dev) return null
                        return (
                          <div
                            key={contributor.developerId}
                            className="flex items-center gap-2 bg-muted rounded-full py-1 px-3"
                          >
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={dev.avatar} alt={dev.name} />
                              <AvatarFallback className="text-xs">
                                {dev.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{dev.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ({contributor.commits})
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <Collapsible open={openBranches[repo.id]} onOpenChange={() => toggleBranches(repo.id)}>
                    <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
                      <GitMerge size={16} />
                      <span>Branch Analytics ({branches[repo.id]?.length || '?'})</span>
                      <ChevronDown 
                        size={16} 
                        className={`transition-transform ${openBranches[repo.id] ? 'rotate-180' : ''}`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3 space-y-2">
                        {loadingBranches[repo.id] && (
                          <div className="text-sm text-muted-foreground">Loading branches...</div>
                        )}
                        {branches[repo.id]?.map(branch => (
                          <div 
                            key={branch.name} 
                            className="flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <GitBranch size={14} className={branch.isDefault ? 'text-primary' : 'text-muted-foreground'} />
                              <span className="text-sm font-mono">{branch.name}</span>
                              {branch.isDefault && (
                                <Badge variant="default" className="text-xs">default</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {branch.lastCommitDate ? new Date(branch.lastCommitDate).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              }) : 'No commits'}
                            </div>
                          </div>
                        ))}
                        {branches[repo.id]?.length === 0 && (
                          <div className="text-sm text-muted-foreground">No branches found</div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
