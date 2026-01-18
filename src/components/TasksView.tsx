import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { SharePointTask, TaskPriority, TaskStatus, Developer } from '@/lib/types'
import { MagnifyingGlass, CheckCircle, Calendar, Clock, Hourglass, Warning } from '@phosphor-icons/react'
import { formatDistanceToNow, differenceInDays } from 'date-fns'

interface TasksViewProps {
  tasks: SharePointTask[]
  developers: Developer[]
}

const priorityColors: Record<TaskPriority, string> = {
  Low: 'bg-blue-500/10 text-blue-700 border-blue-200',
  Normal: 'bg-slate-500/10 text-slate-700 border-slate-200',
  High: 'bg-orange-500/10 text-orange-700 border-orange-200',
  Critical: 'bg-red-500/10 text-red-700 border-red-200',
}

const statusColors: Record<TaskStatus, string> = {
  'Active': 'bg-blue-500/10 text-blue-700 border-blue-200',
  'In Progress': 'bg-purple-500/10 text-purple-700 border-purple-200',
  'Blocked': 'bg-red-500/10 text-red-700 border-red-200',
  'Under Review': 'bg-amber-500/10 text-amber-700 border-amber-200',
  'Resolved': 'bg-green-500/10 text-green-700 border-green-200',
  'Closed': 'bg-slate-500/10 text-slate-700 border-slate-200',
  'Completed': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
}

export function TasksView({ tasks, developers }: TasksViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  const activeTasks = useMemo(() => tasks.filter(t => !t.resolvedDate), [tasks])
  const resolvedTasks = useMemo(() => tasks.filter(t => t.resolvedDate), [tasks])

  const categories = useMemo(() => {
    return [...new Set(tasks.map(t => t.category))].sort()
  }, [tasks])

  const filterTasks = (taskList: SharePointTask[]) => {
    return taskList.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           task.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
      const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      return matchesSearch && matchesPriority && matchesCategory && matchesStatus
    })
  }

  const filteredActiveTasks = useMemo(() => filterTasks(activeTasks), [activeTasks, searchQuery, priorityFilter, categoryFilter, statusFilter])
  const filteredResolvedTasks = useMemo(() => filterTasks(resolvedTasks), [resolvedTasks, searchQuery, priorityFilter, categoryFilter, statusFilter])

  const getDeveloper = (developerId: string) => {
    return developers.find(d => d.id === developerId)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('')
  }
  
  const getDaysUntilDue = (dueDate: string) => {
    return differenceInDays(new Date(dueDate), new Date())
  }
  
  const renderTaskCard = (task: SharePointTask) => {
    const assignedDev = getDeveloper(task.assignedTo)
    const isOverdue = !task.resolvedDate && getDaysUntilDue(task.dueDate) < 0
    const daysUntilDue = getDaysUntilDue(task.dueDate)
    
    return (
      <Card key={task.id} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <CardTitle className="text-base">{task.title}</CardTitle>
              <CardDescription className="text-sm">{task.description}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className={priorityColors[task.priority]}>
                {task.priority}
              </Badge>
              <Badge variant="outline" className={statusColors[task.status]}>
                {task.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={assignedDev?.avatar} />
                <AvatarFallback className="text-xs">
                  {assignedDev ? getInitials(assignedDev.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground">
                Assigned to <span className="font-medium text-foreground">{assignedDev?.name}</span>
              </span>
            </div>
            
            {task.resolvedDate ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CheckCircle size={16} weight="fill" className="text-green-600" />
                <span>Resolved {formatDistanceToNow(new Date(task.resolvedDate), { addSuffix: true })}</span>
              </div>
            ) : (
              <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                {isOverdue ? (
                  <>
                    <Warning size={16} weight="fill" />
                    <span className="font-medium">Overdue by {Math.abs(daysUntilDue)} days</span>
                  </>
                ) : (
                  <>
                    <Hourglass size={16} />
                    <span>Due in {daysUntilDue} days</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar size={16} />
              <span>Created {new Date(task.createdDate).toLocaleDateString()}</span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock size={16} />
              <span>{task.actualHours}h / {task.estimatedHours}h est.</span>
            </div>

            <Badge variant="secondary" className="ml-auto">
              {task.category}
            </Badge>
          </div>

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {task.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
            size={18} 
          />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Normal">Normal</SelectItem>
            <SelectItem value="High">High</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Blocked">Blocked</SelectItem>
            <SelectItem value="Under Review">Under Review</SelectItem>
            <SelectItem value="Resolved">Resolved</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active" className="gap-2">
            <Hourglass size={16} />
            Active ({activeTasks.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <CheckCircle size={16} />
            Resolved ({resolvedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredActiveTasks.length} of {activeTasks.length} active tasks
            </p>
          </div>

          <div className="grid gap-4">
            {filteredActiveTasks.map(renderTaskCard)}
          </div>

          {filteredActiveTasks.length === 0 && (
            <Card className="py-12">
              <CardContent className="text-center">
                <Hourglass size={64} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Active Tasks Found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or search query
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredResolvedTasks.length} of {resolvedTasks.length} resolved tasks
            </p>
          </div>

          <div className="grid gap-4">
            {filteredResolvedTasks.map(renderTaskCard)}
          </div>

          {filteredResolvedTasks.length === 0 && (
            <Card className="py-12">
              <CardContent className="text-center">
                <CheckCircle size={64} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Resolved Tasks Found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters or search query
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
