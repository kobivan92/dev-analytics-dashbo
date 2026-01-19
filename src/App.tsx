import { useState, useMemo, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamDashboard } from '@/components/TeamDashboard'
import { DeveloperView } from '@/components/DeveloperView'
import { RepositoriesView } from '@/components/RepositoriesView'
import { TasksView } from '@/components/TasksView'
import { ChartBar, User, GitBranch, CheckCircle, ArrowsClockwise } from '@phosphor-icons/react'
import type { Developer, DeveloperMetrics, Repository, SharePointTask, DeveloperTaskMetrics, TeamTaskMetrics, TaskPriority, TaskStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

const API_BASE = 'http://localhost:3001/api'

function App() {
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [selectedDevId, setSelectedDevId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('team')

  const devMetrics = useMemo(() => {
    const metrics = new Map<string, DeveloperMetrics>()
    developers.forEach(dev => {
      metrics.set(dev.id, {
        totalCommits: dev.totalCommits || 0,
        totalReviews: 0,
        pullRequests: 0,
        issuesResolved: 0,
        codeQuality: 85,
        commitTrend: [],
        languages: []
      } as DeveloperMetrics)
    })
    return metrics
  }, [developers])

  const [repositories, setRepositories] = useState<Repository[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<any>(null)
  const [teamCommitTrend, setTeamCommitTrend] = useState<{ date: string; commits: number }[]>([])
  const [teamMetricsComparison, setTeamMetricsComparison] = useState<any>(null)
  const [tasks, setTasks] = useState<SharePointTask[]>([])

  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`)
      const tasksData = await res.json()
      // Map API data to SharePointTask format
      // Try to match assigned_to email to developer ID, fallback to email if not found
      const mappedTasks: SharePointTask[] = tasksData.map((t: any) => {
        const assignedEmail = t.assigned_to || 'Unassigned'
        const assignedDev = developers.find(d => d.email === assignedEmail)
        
        // Map database status to UI status
        let uiStatus: TaskStatus
        if (t.status === 'New') {
          uiStatus = 'Active'
        } else if (t.status === 'In progress') {
          uiStatus = 'In Progress'
        } else if (t.status === 'Completed') {
          uiStatus = 'Completed'
        } else if (t.status === 'Blocked') {
          uiStatus = 'Blocked'
        } else {
          uiStatus = 'Active' // fallback
        }
        
        // Extract subtasks and attachments from description metadata
        let description = t.description || ''
        let tags: string[] = []
        const metaMatch = description.match(/<!-- META:(.+?) -->/)
        if (metaMatch) {
          try {
            const metadata = JSON.parse(metaMatch[1])
            // Encode subtasks as tags
            if (metadata.subtasks && Array.isArray(metadata.subtasks)) {
              metadata.subtasks.forEach((st: any) => {
                tags.push(`subtask:${st.id}|${st.completed}|${st.title}`)
              })
            }
            // Encode attachments as tags
            if (metadata.attachments && Array.isArray(metadata.attachments)) {
              metadata.attachments.forEach((file: string) => {
                tags.push(`file:${file}`)
              })
            }
            // Encode documentation link as tag
            if (metadata.documentationLink && typeof metadata.documentationLink === 'string') {
              tags.push(`doclink:${metadata.documentationLink}`)
            }
            // Remove metadata from description
            description = description.replace(/\n?<!-- META:.+? -->/, '').trim()
          } catch (e) {
            console.error('Failed to parse task metadata:', e)
          }
        }
        
        return {
          id: t.id.toString(),
          title: t.title,
          description: description,
          assignedTo: assignedDev?.id || assignedEmail,
          createdBy: t.issued_by || 'Unknown',
          priority: (t.priority || 'Normal') as TaskPriority,
          status: uiStatus,
          createdDate: t.created_at || new Date().toISOString(),
          resolvedDate: t.status === 'Completed' ? t.updated_at : undefined,
          dueDate: t.deadline || new Date().toISOString(),
          category: t.stage || 'General',
          estimatedHours: t.resolution_time_hours || 0,
          actualHours: 0,
          tags: tags
        }
      })
      setTasks(mappedTasks)
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [developers])

  // Fetch sync status periodically
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/sync/status`)
        const status = await res.json()
        setSyncStatus(status)
      } catch (err) {
        console.warn('Failed to fetch sync status:', err)
      }
    }

    fetchSyncStatus()
    const interval = setInterval(fetchSyncStatus, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setIsLoading(true)
        
        // Fetch developers
        const devsRes = await fetch(`${API_BASE}/developers`)
        const devs = await devsRes.json()
        if (Array.isArray(devs) && devs.length > 0) {
          setDevelopers(devs)
        }
        
        // Fetch team commit activity
        const teamActivityRes = await fetch(`${API_BASE}/team/activity?days=90`)
        const teamActivity = await teamActivityRes.json()
        if (!cancelled && Array.isArray(teamActivity)) {
          setTeamCommitTrend(teamActivity)
        }
        
        // Fetch team metrics comparison
        const teamComparisonRes = await fetch(`${API_BASE}/team/metrics-comparison`)
        const teamComparison = await teamComparisonRes.json()
        if (!cancelled) {
          setTeamMetricsComparison(teamComparison)
        }
        
        // Check if we have repositories data
        const reposRes = await fetch(`${API_BASE}/repositories`)
        const repos = await reposRes.json()
        
        if (!cancelled) {
          if (!Array.isArray(repos) || repos.length === 0) {
            // No data yet, trigger initial sync
            console.log('No data found, triggering initial sync...')
            setIsSyncing(true)
            const syncRes = await fetch(`${API_BASE}/sync`, { method: 'POST' })
            const syncResult = await syncRes.json()
            console.log('Sync completed:', syncResult)
            
            // Fetch again after sync
            const reposRes2 = await fetch(`${API_BASE}/repositories`)
            const repos2 = await reposRes2.json()
            
            // Fetch repo details with top contributors
            const enriched = await Promise.all(
              repos2.map(async (r: any) => {
                const detailRes = await fetch(`${API_BASE}/repositories/${encodeURIComponent(r.id)}`)
                return detailRes.json()
              })
            )
            
            setRepositories(enriched)
            setIsSyncing(false)
          } else {
            // Fetch repo details with top contributors
            const enriched = await Promise.all(
              repos.map(async (r: any) => {
                const detailRes = await fetch(`${API_BASE}/repositories/${encodeURIComponent(r.id)}`)
                return detailRes.json()
              })
            )
            
            setRepositories(enriched)
          }
        }
      } catch (err) {
        console.error('Failed to load data from API:', err)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  const teamMetrics = useMemo(() => {
    const totalRepos = repositories.length
    const avgHealthScore = repositories.length > 0 
      ? Math.round(repositories.reduce((sum, r) => sum + r.healthScore, 0) / repositories.length)
      : 0
    
    // Use current month data from comparison API
    const totalCommits = teamMetricsComparison?.commits?.current || 0
    const activeRepositories = teamMetricsComparison?.activeRepos?.current || totalRepos
    const totalPullRequests = teamMetricsComparison?.pullRequests?.current || 0
    const totalReviews = teamMetricsComparison?.reviews?.current || 0
    
    return {
      totalCommits,
      activeRepositories,
      totalPullRequests,
      totalReviews,
      codeQuality: avgHealthScore,
      commitTrend: teamCommitTrend,
      comparison: teamMetricsComparison
    }
  }, [repositories, teamCommitTrend, teamMetricsComparison])

  const devTaskMetrics = useMemo(() => {
    const metrics = new Map<string, DeveloperTaskMetrics>()
    developers.forEach(dev => {
      const devTasks = tasks.filter(t => t.assignedTo === dev.email || t.assignedTo === dev.id)
      metrics.set(dev.id, {
        developerId: dev.id,
        totalTasksActive: devTasks.filter(t => t.status === 'Active' || t.status === 'In Progress' || t.status === 'Blocked').length,
        totalTasksResolved: devTasks.filter(t => t.status === 'Completed' || t.status === 'Resolved').length,
        avgResolutionTime: 0,
        tasksByPriority: [
          { priority: 'Low' as TaskPriority, count: devTasks.filter(t => t.priority === 'Low').length },
          { priority: 'Normal' as TaskPriority, count: devTasks.filter(t => t.priority === 'Normal').length },
          { priority: 'High' as TaskPriority, count: devTasks.filter(t => t.priority === 'High').length },
          { priority: 'Critical' as TaskPriority, count: devTasks.filter(t => t.priority === 'Critical').length },
        ],
        tasksByCategory: [],
        tasksOverTime: [],
        estimateAccuracy: 0
      })
    })
    return metrics
  }, [developers, tasks])

  const teamTaskMetrics = useMemo((): TeamTaskMetrics => ({
    totalTasksActive: tasks.filter(t => t.status === 'Active' || t.status === 'In Progress' || t.status === 'Blocked').length,
    totalTasksResolved: tasks.filter(t => t.status === 'Completed' || t.status === 'Resolved').length,
    avgResolutionTime: 0,
    totalEstimatedHours: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
    totalActualHours: 0,
    tasksByPriority: [
      { priority: 'Low' as TaskPriority, count: tasks.filter(t => t.priority === 'Low').length },
      { priority: 'Normal' as TaskPriority, count: tasks.filter(t => t.priority === 'Normal').length },
      { priority: 'High' as TaskPriority, count: tasks.filter(t => t.priority === 'High').length },
      { priority: 'Critical' as TaskPriority, count: tasks.filter(t => t.priority === 'Critical').length },
    ],
    taskCompletionTrend: [],
    topPerformers: []
  }), [tasks])

  const handleSelectDeveloper = (devId: string) => {
    setSelectedDevId(devId)
    setActiveTab('individual')
  }

  const handleBackToTeam = () => {
    setSelectedDevId(null)
    setActiveTab('team')
  }

  const selectedDeveloper = selectedDevId 
    ? developers.find(d => d.id === selectedDevId) 
    : null

  const selectedMetrics = selectedDevId 
    ? devMetrics.get(selectedDevId) 
    : null

  const selectedTaskMetrics = selectedDevId
    ? devTaskMetrics.get(selectedDevId)
    : null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <ChartBar size={24} className="text-primary-foreground" weight="bold" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">DevMetrics</h1>
                <p className="text-sm text-muted-foreground">Developer Analytics Dashboard</p>
              </div>
            </div>
            
            {/* Sync Status */}
            {syncStatus && (
              <div className="flex items-center gap-3">
                {syncStatus.lastSyncTime && (
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Last sync</div>
                    <div className="text-xs font-mono">
                      {new Date(syncStatus.lastSyncTime).toLocaleString()}
                    </div>
                  </div>
                )}
                <Badge variant="outline" className="gap-2">
                  <ArrowsClockwise 
                    size={14} 
                    className={isSyncing ? 'animate-spin' : ''}
                  />
                  {isSyncing ? 'Syncing...' : 'Auto-sync: 1h'}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)}>
          <TabsList className="grid w-full max-w-2xl grid-cols-4 mb-6">
            <TabsTrigger value="team" className="gap-2">
              <ChartBar size={16} />
              Team
            </TabsTrigger>
            <TabsTrigger value="individual" className="gap-2">
              <User size={16} />
              Individual
            </TabsTrigger>
            <TabsTrigger value="repositories" className="gap-2">
              <GitBranch size={16} />
              Repositories
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <CheckCircle size={16} />
              Tasks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team">
            <TeamDashboard
              teamMetrics={teamMetrics}
              teamTaskMetrics={teamTaskMetrics}
              developers={developers}
              devMetrics={devMetrics}
              onSelectDeveloper={handleSelectDeveloper}
            />
          </TabsContent>

          <TabsContent value="individual">
            {selectedDeveloper && selectedMetrics && selectedTaskMetrics ? (
              <DeveloperView
                developer={selectedDeveloper}
                metrics={selectedMetrics}
                taskMetrics={selectedTaskMetrics}
                tasks={tasks}
                developers={developers}
                onBack={handleBackToTeam}
              />
            ) : (
              <div className="text-center py-12">
                <User size={64} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Developer Selected</h3>
                <p className="text-muted-foreground">
                  Select a developer from the Team tab to view their metrics
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="repositories">
            <RepositoriesView repositories={repositories} developers={developers} />
          </TabsContent>

          <TabsContent value="tasks">
            <TasksView 
              tasks={tasks} 
              developers={developers} 
              onTasksChange={fetchTasks}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default App