import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import type { SharePointTask, TaskPriority, TaskStatus, Developer } from '@/lib/types'
import { MagnifyingGlass, CheckCircle, Calendar, Clock, Hourglass, Warning, Plus, PencilSimple, Trash, Kanban, ListBullets } from '@phosphor-icons/react'
import { API_BASE } from '@/lib/api'
import { formatDistanceToNow, differenceInDays } from 'date-fns'

interface TasksViewProps {
  tasks: SharePointTask[]
  developers: Developer[]
  onTasksChange: () => void
}

interface Subtask {
  id: string
  title: string
  completed: boolean
}

interface TaskFormData {
  title: string
  description: string
  assignedTo: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string
  category: string
  estimatedHours: number
  documentationLink: string
  subtasks: Subtask[]
  attachments: string[]
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

const newStatusColor = 'bg-cyan-500/10 text-cyan-700 border-cyan-200'

export function TasksView({ tasks, developers, onTasksChange }: TasksViewProps) {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<SharePointTask | null>(null)
  const [deletingTask, setDeletingTask] = useState<SharePointTask | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [draggingTask, setDraggingTask] = useState<SharePointTask | null>(null)
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'Normal',
    status: 'Active',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'General',
    estimatedHours: 0,
    documentationLink: '',
    subtasks: [],
    attachments: []
  })

  const currentTeamMembers = ['grammaton88', 'kobivan', 'Ilia', 'Ilia Lomsadze', 'abezhitashvili', 'gchutlashvili', 'vumpy']
  const availableDevelopers = useMemo(() => 
    developers.filter(d => currentTeamMembers.includes(d.id)),
    [developers]
  )
  
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
      const matchesAssignedTo = assignedToFilter === 'all' || task.assignedTo === assignedToFilter
      return matchesSearch && matchesPriority && matchesCategory && matchesStatus && matchesAssignedTo
    })
  }

  const filteredActiveTasks = useMemo(() => filterTasks(activeTasks), [activeTasks, searchQuery, priorityFilter, categoryFilter, statusFilter, assignedToFilter])
  const filteredResolvedTasks = useMemo(() => filterTasks(resolvedTasks), [resolvedTasks, searchQuery, priorityFilter, categoryFilter, statusFilter, assignedToFilter])

  // Kanban columns
  const kanbanColumns: { status: TaskStatus | 'New'; label: string; tasks: SharePointTask[] }[] = useMemo(() => {
    const allFilteredTasks = filterTasks(tasks)
    return [
      { status: 'New', label: 'New', tasks: allFilteredTasks.filter(t => t.status === 'Active') },
      { status: 'In Progress' as TaskStatus, label: 'In Progress', tasks: allFilteredTasks.filter(t => t.status === 'In Progress') },
      { status: 'Completed' as TaskStatus, label: 'Completed', tasks: allFilteredTasks.filter(t => t.status === 'Completed' || t.status === 'Resolved' || t.status === 'Closed') },
      { status: 'Blocked' as TaskStatus, label: 'Blocked', tasks: allFilteredTasks.filter(t => t.status === 'Blocked') },
    ]
  }, [tasks, searchQuery, priorityFilter, categoryFilter, statusFilter, assignedToFilter])

  const getDeveloper = (developerId: string) => {
    return developers.find(d => d.id === developerId)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('')
  }
  
  const getDaysUntilDue = (dueDate: string) => {
    return differenceInDays(new Date(dueDate), new Date())
  }

  const calculateProgress = (task: SharePointTask) => {
    // Extract subtasks from tags
    const subtasks = task.tags.filter(t => t.startsWith('subtask:'))
    if (subtasks.length === 0) return null
    
    const completed = subtasks.filter(t => {
      const [, data] = t.split('subtask:')
      const [, completedFlag] = data.split('|')
      return completedFlag === 'true'
    }).length
    
    return Math.round((completed / subtasks.length) * 100)
  }

  const handleDragStart = (task: SharePointTask) => {
    setDraggingTask(task)
  }

  const handleDragEnd = () => {
    setDraggingTask(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus | 'New') => {
    e.preventDefault()
    if (!draggingTask) return

    // Map UI status to database status
    // Database expects: 'New', 'In progress', 'Completed', 'Blocked'
    let dbStatus: string
    if (newStatus === 'New' || newStatus === 'Active') {
      dbStatus = 'New'
    } else if (newStatus === 'In Progress') {
      dbStatus = 'In progress' // lowercase 'p'
    } else if (newStatus === 'Completed') {
      dbStatus = 'Completed'
    } else if (newStatus === 'Blocked') {
      dbStatus = 'Blocked'
    } else {
      dbStatus = 'New' // fallback
    }
    
    // Check if status is already the same (compare with current task's mapped status)
    let currentDbStatus = draggingTask.status
    if (currentDbStatus === 'Active') currentDbStatus = 'New'
    if (currentDbStatus === 'In Progress') currentDbStatus = 'In progress'
    
    if (currentDbStatus === dbStatus) {
      setDraggingTask(null)
      return
    }

    try {
      const assignedDev = developers.find(d => d.id === draggingTask.assignedTo)
      
      // Ensure deadline is in YYYY-MM-DD format
      let deadlineDate = draggingTask.dueDate
      if (deadlineDate.includes('T')) {
        deadlineDate = deadlineDate.split('T')[0]
      }
      
      const payload = {
        title: draggingTask.title || '',
        description: draggingTask.description || '',
        assigned_to: assignedDev?.email || draggingTask.assignedTo || '',
        priority: draggingTask.priority || 'Normal',
        status: dbStatus,
        deadline: deadlineDate,
        stage: draggingTask.category || 'General',
        resolution_time_hours: draggingTask.estimatedHours || 0,
        issued_by: draggingTask.createdBy || 'Unknown',
        start_date: null,
        related_issue: null,
        parent_task_id: null
      }

      const response = await fetch(`${API_BASE}/tasks/${draggingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Server error:', error)
        throw new Error(error.error || 'Failed to update task status')
      }

      onTasksChange()
    } catch (err) {
      console.error('Failed to update task status:', err)
      alert(`Failed to update task status: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setDraggingTask(null)
    }
  }

  const handleAddSubtask = () => {
    const newSubtask: Subtask = {
      id: Date.now().toString(),
      title: '',
      completed: false
    }
    setFormData({ ...formData, subtasks: [...formData.subtasks, newSubtask] })
  }

  const handleRemoveSubtask = (id: string) => {
    setFormData({ ...formData, subtasks: formData.subtasks.filter(s => s.id !== id) })
  }

  const handleUpdateSubtask = (id: string, updates: Partial<Subtask>) => {
    setFormData({
      ...formData,
      subtasks: formData.subtasks.map(s => s.id === id ? { ...s, ...updates } : s)
    })
  }

  const handleAddAttachment = (fileName: string) => {
    if (fileName && !formData.attachments.includes(fileName)) {
      setFormData({ ...formData, attachments: [...formData.attachments, fileName] })
    }
  }

  const handleRemoveAttachment = (fileName: string) => {
    setFormData({ ...formData, attachments: formData.attachments.filter(f => f !== fileName) })
  }

  const handleCreateNew = () => {
    setEditingTask(null)
    setFormData({
      title: '',
      description: '',
      assignedTo: availableDevelopers[0]?.id || '',
      priority: 'Normal',
      status: 'Active',
      dueDate: new Date().toISOString().split('T')[0],
      category: 'General',
      estimatedHours: 0,
      documentationLink: '',
      subtasks: [],
      attachments: []
    })
    setIsEditDialogOpen(true)
  }

  const handleEdit = (task: SharePointTask) => {
    setEditingTask(task)
    // Parse subtasks and attachments from tags
    const subtasks: Subtask[] = task.tags
      .filter(t => t.startsWith('subtask:'))
      .map(t => {
        const [, data] = t.split('subtask:')
        const parts = data.split('|')
        const id = parts[0]
        const completed = parts[1] === 'true'
        const title = parts.slice(2).join('|') // In case title contains |
        return { id, completed, title }
      })
    const attachments = task.tags.filter(t => t.startsWith('file:')).map(t => t.replace('file:', ''))
    
    setFormData({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate.split('T')[0],
      category: task.category,
      estimatedHours: task.estimatedHours,
      subtasks,
      attachments
    })
    setIsEditDialogOpen(true)
  }

  const handleDelete = (task: SharePointTask) => {
    setDeletingTask(task)
    setIsDeleteDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const assignedDev = developers.find(d => d.id === formData.assignedTo)
      
      // Encode subtasks, attachments, and documentation link in description as JSON metadata
      const metadata = {
        subtasks: formData.subtasks,
        attachments: formData.attachments,
        documentationLink: formData.documentationLink
      }
      const descriptionWithMeta = `${formData.description}\n<!-- META:${JSON.stringify(metadata)} -->`
      
      // Map UI status to database status
      let dbStatus = formData.status
      if (formData.status === 'Active') {
        dbStatus = 'New'
      } else if (formData.status === 'In Progress') {
        dbStatus = 'In progress'
      } else if (formData.status === 'Completed') {
        dbStatus = 'Completed'
      } else if (formData.status === 'Blocked') {
        dbStatus = 'Blocked'
      }
      
      if (editingTask) {
        // For updates, send all existing fields plus the changes
        const payload = {
          title: formData.title,
          description: descriptionWithMeta,
          assigned_to: assignedDev?.email || formData.assignedTo,
          priority: formData.priority,
          status: dbStatus,
          deadline: formData.dueDate,
          stage: formData.category,
          resolution_time_hours: formData.estimatedHours,
          // Preserve existing fields that aren't in the form
          issued_by: editingTask.createdBy,
          start_date: null,
          related_issue: null,
          parent_task_id: null
        }
        
        const response = await fetch(`${API_BASE}/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update task')
        }
      } else {
        // For new tasks
        const payload = {
          title: formData.title,
          description: descriptionWithMeta,
          assigned_to: assignedDev?.email || formData.assignedTo,
          priority: formData.priority,
          status: dbStatus,
          deadline: formData.dueDate,
          stage: formData.category,
          resolution_time_hours: formData.estimatedHours
        }
        
        const response = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create task')
        }
      }

      setIsEditDialogOpen(false)
      onTasksChange()
    } catch (err) {
      console.error('Failed to save task:', err)
      alert(`Failed to save task: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingTask) return
    setIsSaving(true)
    try {
      await fetch(`${API_BASE}/tasks/${deletingTask.id}`, {
        method: 'DELETE'
      })
      setIsDeleteDialogOpen(false)
      setDeletingTask(null)
      onTasksChange()
    } catch (err) {
      console.error('Failed to delete task:', err)
    } finally {
      setIsSaving(false)
    }
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
            <div className="flex gap-2 items-start">
              <Badge variant="outline" className={priorityColors[task.priority]}>
                {task.priority}
              </Badge>
              <Badge variant="outline" className={statusColors[task.status]}>
                {task.status}
              </Badge>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleEdit(task)}
                >
                  <PencilSimple size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(task)}
                >
                  <Trash size={16} />
                </Button>
              </div>
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

          {/* Progress bar for subtasks */}
          {(() => {
            const progress = calculateProgress(task)
            const subtasks = task.tags.filter(t => t.startsWith('subtask:'))
            const attachmentCount = task.tags.filter(t => t.startsWith('file:')).length
            
            return (
              <>
                {subtasks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress || 0} className="h-2" />
                    <div className="space-y-1 pl-2 border-l-2 border-gray-200">
                      {subtasks.map((subtaskTag, idx) => {
                        const [, data] = subtaskTag.split('subtask:')
                        const [, completed, title] = data.split('|')
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <CheckCircle 
                              size={14} 
                              weight={completed === 'true' ? 'fill' : 'regular'}
                              className={completed === 'true' ? 'text-green-600' : 'text-gray-400'}
                            />
                            <span className={completed === 'true' ? 'text-muted-foreground line-through' : ''}>
                              {title}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {attachmentCount > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    📎 {attachmentCount} file{attachmentCount !== 1 ? 's' : ''}
                  </div>
                )}
                {task.tags.find(t => t.startsWith('doclink:')) && (
                  <div className="mt-2">
                    <a 
                      href={task.tags.find(t => t.startsWith('doclink:'))?.replace('doclink:', '')} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      📄 Documentation
                    </a>
                  </div>
                )}
              </>
            )
          })()}

          {task.tags.filter(t => !t.startsWith('subtask:') && !t.startsWith('file:') && !t.startsWith('doclink:')).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {task.tags.filter(t => !t.startsWith('subtask:') && !t.startsWith('file:') && !t.startsWith('doclink:')).map(tag => (
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Tasks</h2>
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-2"
            >
              <ListBullets size={18} />
              List
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="gap-2"
            >
              <Kanban size={18} />
              Kanban
            </Button>
          </div>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus size={20} weight="bold" />
          New Task
        </Button>
      </div>

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
        <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Assigned To" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Developers</SelectItem>
            {availableDevelopers.map(dev => (
              <SelectItem key={dev.id} value={dev.id}>
                {dev.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
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
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {kanbanColumns.map(column => (
              <div 
                key={column.status} 
                className="flex-shrink-0 w-80"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                <Card className={`h-full transition-colors ${draggingTask ? 'border-2 border-dashed' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Badge variant="outline" className={column.status === 'New' ? newStatusColor : statusColors[column.status as TaskStatus]}>
                          {column.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">({column.tasks.length})</span>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {column.tasks.map(task => {
                      const assignedDev = getDeveloper(task.assignedTo)
                      const isOverdue = !task.resolvedDate && getDaysUntilDue(task.dueDate) < 0
                      const daysUntilDue = getDaysUntilDue(task.dueDate)
                      
                      return (
                        <Card 
                          key={task.id} 
                          className={`hover:shadow-md transition-shadow cursor-move ${draggingTask?.id === task.id ? 'opacity-50' : ''}`}
                          draggable
                          onDragStart={() => handleDragStart(task)}
                          onDragEnd={handleDragEnd}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-sm leading-tight">{task.title}</CardTitle>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleEdit(task)}
                                >
                                  <PencilSimple size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(task)}
                                >
                                  <Trash size={14} />
                                </Button>
                              </div>
                            </div>
                            {task.description && (
                              <CardDescription className="text-xs line-clamp-2">
                                {task.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={assignedDev?.avatar} />
                                <AvatarFallback className="text-[10px]">
                                  {assignedDev ? getInitials(assignedDev.name) : '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground truncate">
                                {assignedDev?.name || 'Unassigned'}
                              </span>
                            </div>
                            
                            <Badge variant="outline" className={`${priorityColors[task.priority]} text-xs`}>
                              {task.priority}
                            </Badge>
                            
                            {/* Subtasks in Kanban */}
                            {(() => {
                              const subtasks = task.tags.filter(t => t.startsWith('subtask:'))
                              const progress = calculateProgress(task)
                              
                              if (subtasks.length > 0) {
                                return (
                                  <div className="space-y-1">
                                    <Progress value={progress || 0} className="h-1" />
                                    <div className="space-y-0.5">
                                      {subtasks.slice(0, 3).map((subtaskTag, idx) => {
                                        const [, data] = subtaskTag.split('subtask:')
                                        const [, completed, title] = data.split('|')
                                        return (
                                          <div key={idx} className="flex items-center gap-1 text-[10px]">
                                            <CheckCircle 
                                              size={10} 
                                              weight={completed === 'true' ? 'fill' : 'regular'}
                                              className={completed === 'true' ? 'text-green-600 flex-shrink-0' : 'text-gray-400 flex-shrink-0'}
                                            />
                                            <span className={`truncate ${completed === 'true' ? 'text-muted-foreground line-through' : ''}`}>
                                              {title}
                                            </span>
                                          </div>
                                        )
                                      })}
                                      {subtasks.length > 3 && (
                                        <div className="text-[10px] text-muted-foreground pl-3">
                                          +{subtasks.length - 3} more
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            })()}
                            
                            {/* Documentation link */}
                            {task.tags.find(t => t.startsWith('doclink:')) && (
                              <a 
                                href={task.tags.find(t => t.startsWith('doclink:'))?.replace('doclink:', '')} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                📄 Docs
                              </a>
                            )}
                            
                            {task.resolvedDate ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle size={12} weight="fill" className="text-green-600" />
                                <span>Resolved</span>
                              </div>
                            ) : (
                              <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {isOverdue ? (
                                  <>
                                    <Warning size={12} weight="fill" />
                                    <span>Overdue {Math.abs(daysUntilDue)}d</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock size={12} />
                                    <span>Due in {daysUntilDue}d</span>
                                  </>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                    {column.tasks.length === 0 && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No tasks
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'Update the task details below' : 'Fill in the details for the new task'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Task description"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="assignedTo">Assigned To *</Label>
                <Select value={formData.assignedTo} onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}>
                  <SelectTrigger id="assignedTo">
                    <SelectValue placeholder="Select developer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDevelopers.map(dev => (
                      <SelectItem key={dev.id} value={dev.id}>
                        {dev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as TaskPriority })}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">New</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g. Development, Testing"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="documentationLink">Documentation Link</Label>
              <Input
                id="documentationLink"
                type="url"
                value={formData.documentationLink}
                onChange={(e) => setFormData({ ...formData, documentationLink: e.target.value })}
                placeholder="https://docs.example.com"
              />
            </div>
            
            {/* Subtasks Section */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Subtasks</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSubtask}
                  className="gap-1"
                >
                  <Plus size={14} />
                  Add Subtask
                </Button>
              </div>
              {formData.subtasks.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3">
                  {formData.subtasks.map(subtask => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={(e) => handleUpdateSubtask(subtask.id, { completed: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Input
                        value={subtask.title}
                        onChange={(e) => handleUpdateSubtask(subtask.id, { title: e.target.value })}
                        placeholder="Subtask description"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSubtask(subtask.id)}
                        className="h-8 w-8 text-red-600"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Attachments</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.multiple = true
                      input.onchange = (e: any) => {
                        const files = Array.from(e.target.files || []) as File[]
                        files.forEach(file => handleAddAttachment(file.name))
                      }
                      input.click()
                    }}
                    className="gap-1"
                  >
                    <Plus size={14} />
                    Upload Files
                  </Button>
                </div>
              </div>
              {formData.attachments.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3">
                  {formData.attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 flex-1 truncate">
                        <span className="text-xl">📎</span>
                        <span className="truncate">{file}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAttachment(file)}
                        className="h-6 w-6 text-red-600 flex-shrink-0"
                      >
                        <Trash size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.title}>
              {isSaving ? 'Saving...' : (editingTask ? 'Save Changes' : 'Create Task')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTask?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSaving ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
