import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { SharePointTask, TaskPriority, TaskStatus, Developer } from '@/lib/types'
import { CheckCircle, Calendar, Clock, Hourglass, Warning } from '@phosphor-icons/react'
import { formatDistanceToNow, differenceInDays } from 'date-fns'
import { motion } from 'framer-motion'

interface DeveloperTaskDrilldownProps {
  tasks: SharePointTask[]
  developerId: string
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

export function DeveloperTaskDrilldown({ tasks, developerId, developers }: DeveloperTaskDrilldownProps) {
  const developerTasks = useMemo(() => 
    tasks.filter(t => t.assignedTo === developerId), 
    [tasks, developerId]
  )

  const activeTasks = useMemo(() => 
    developerTasks.filter(t => !t.resolvedDate).sort((a, b) => {
      const aDue = new Date(a.dueDate).getTime()
      const bDue = new Date(b.dueDate).getTime()
      return aDue - bDue
    }), 
    [developerTasks]
  )

  const resolvedTasks = useMemo(() => 
    developerTasks.filter(t => t.resolvedDate).sort((a, b) => {
      const aResolved = new Date(a.resolvedDate!).getTime()
      const bResolved = new Date(b.resolvedDate!).getTime()
      return bResolved - aResolved
    }), 
    [developerTasks]
  )

  const getDeveloper = (developerId: string) => {
    return developers.find(d => d.id === developerId)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('')
  }
  
  const getDaysUntilDue = (dueDate: string) => {
    return differenceInDays(new Date(dueDate), new Date())
  }
  
  const renderTaskCard = (task: SharePointTask, index: number) => {
    const createdByDev = getDeveloper(task.createdBy)
    const isOverdue = !task.resolvedDate && getDaysUntilDue(task.dueDate) < 0
    const daysUntilDue = getDaysUntilDue(task.dueDate)
    
    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        <Card className="hover:shadow-md transition-shadow">
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
                  <AvatarImage src={createdByDev?.avatar} />
                  <AvatarFallback className="text-xs">
                    {createdByDev ? getInitials(createdByDev.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground">
                  Created by <span className="font-medium text-foreground">{createdByDev?.name}</span>
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
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Task Details</h3>
      
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
              {activeTasks.length} active {activeTasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>

          <div className="grid gap-4">
            {activeTasks.map((task, index) => renderTaskCard(task, index))}
          </div>

          {activeTasks.length === 0 && (
            <Card className="py-12">
              <CardContent className="text-center">
                <Hourglass size={64} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Active Tasks</h3>
                <p className="text-muted-foreground">
                  This developer has no active tasks at the moment
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {resolvedTasks.length} resolved {resolvedTasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>

          <div className="grid gap-4">
            {resolvedTasks.map((task, index) => renderTaskCard(task, index))}
          </div>

          {resolvedTasks.length === 0 && (
            <Card className="py-12">
              <CardContent className="text-center">
                <CheckCircle size={64} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Resolved Tasks</h3>
                <p className="text-muted-foreground">
                  This developer has not resolved any tasks yet
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
