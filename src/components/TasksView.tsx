import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { SharePointTask, TaskPriority, Developer } from '@/lib/types'
import { MagnifyingGlass, CheckCircle, Calendar, Clock } from '@phosphor-icons/react'
import { formatDistanceToNow } from 'date-fns'

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

export function TasksView({ tasks, developers }: TasksViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const categories = useMemo(() => {
    return [...new Set(tasks.map(t => t.category))].sort()
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           task.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
      const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter
      return matchesSearch && matchesPriority && matchesCategory
    })
  }, [tasks, searchQuery, priorityFilter, categoryFilter])

  const getDeveloper = (developerId: string) => {
    return developers.find(d => d.id === developerId)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('')
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
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredTasks.length} of {tasks.length} resolved tasks
        </p>
      </div>

      <div className="grid gap-4">
        {filteredTasks.map(task => {
          const assignedDev = getDeveloper(task.assignedTo)
          const createdByDev = getDeveloper(task.createdBy)
          
          return (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <CardTitle className="text-base">{task.title}</CardTitle>
                    <CardDescription className="text-sm">{task.description}</CardDescription>
                  </div>
                  <Badge variant="outline" className={priorityColors[task.priority]}>
                    {task.priority}
                  </Badge>
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
                  
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle size={16} weight="fill" className="text-green-600" />
                    <span>Resolved {formatDistanceToNow(new Date(task.resolvedDate), { addSuffix: true })}</span>
                  </div>

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
        })}
      </div>

      {filteredTasks.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <CheckCircle size={64} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Tasks Found</h3>
            <p className="text-muted-foreground">
              Try adjusting your filters or search query
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
