import { useState, useMemo, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamDashboard } from '@/components/TeamDashboard'
import { DeveloperView } from '@/components/DeveloperView'
import { RepositoriesView } from '@/components/RepositoriesView'
import { TasksView } from '@/components/TasksView'
import { 
  generateSharePointTasks,
  generateDeveloperTaskMetrics,
  generateTeamTaskMetrics
} from '@/lib/mockData'
import { ChartBar, User, GitBranch, CheckCircle } from '@phosphor-icons/react'
import type { Developer, DeveloperMetrics, Repository } from '@/lib/types'

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
    const totalCommits = repositories.reduce((sum, r) => sum + (r.totalCommits || 0), 0)
    const avgHealthScore = repositories.length > 0 
      ? Math.round(repositories.reduce((sum, r) => sum + r.healthScore, 0) / repositories.length)
      : 0
    
    return {
      totalCommits,
      activeRepositories: totalRepos,
      totalPullRequests: 0,
      totalReviews: 0,
      codeQuality: avgHealthScore,
      commitTrend: []
    }
  }, [repositories])

  const sharePointTasks = useMemo(() => {
    if (developers.length === 0) return []
    return generateSharePointTasks(developers)
  }, [developers])

  const devTaskMetrics = useMemo(() => {
    const metrics = new Map()
    developers.forEach(dev => {
      metrics.set(dev.id, generateDeveloperTaskMetrics(dev.id, sharePointTasks))
    })
    return metrics
  }, [developers, sharePointTasks])

  const teamTaskMetrics = useMemo(() => 
    generateTeamTaskMetrics(sharePointTasks, developers),
    [sharePointTasks, developers]
  )

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <ChartBar size={24} className="text-primary-foreground" weight="bold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">DevMetrics</h1>
              <p className="text-sm text-muted-foreground">Developer Analytics Dashboard</p>
            </div>
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
                tasks={sharePointTasks}
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
            <TasksView tasks={sharePointTasks} developers={developers} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default App