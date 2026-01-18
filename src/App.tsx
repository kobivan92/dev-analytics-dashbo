import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeamDashboard } from '@/components/TeamDashboard'
import { DeveloperView } from '@/components/DeveloperView'
import { RepositoriesView } from '@/components/RepositoriesView'
import { TasksView } from '@/components/TasksView'
import { 
  generateDevelopers, 
  generateDeveloperMetrics, 
  generateRepositories, 
  generateTeamMetrics,
  generateSharePointTasks,
  generateDeveloperTaskMetrics,
  generateTeamTaskMetrics
} from '@/lib/mockData'
import { ChartBar, User, GitBranch, CheckCircle } from '@phosphor-icons/react'
import type { Developer, DeveloperMetrics, Repository } from '@/lib/types'

function App() {
  const [developers] = useState<Developer[]>(() => generateDevelopers())
  const [selectedDevId, setSelectedDevId] = useKV<string | null>('selected-developer', null)
  const [activeTab, setActiveTab] = useKV<string>('active-tab', 'team')

  const devMetrics = useMemo(() => {
    const metrics = new Map<string, DeveloperMetrics>()
    developers.forEach(dev => {
      metrics.set(dev.id, generateDeveloperMetrics(dev.id))
    })
    return metrics
  }, [developers])

  const repositories = useMemo(() => generateRepositories(developers), [developers])

  const teamMetrics = useMemo(() => 
    generateTeamMetrics(developers, devMetrics), 
    [developers, devMetrics]
  )

  const sharePointTasks = useMemo(() => 
    generateSharePointTasks(developers), 
    [developers]
  )

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