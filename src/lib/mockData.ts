import type { 
  Developer, 
  DeveloperMetrics, 
  Repository, 
  TeamMetrics, 
  CommitData,
  SharePointTask,
  TaskPriority,
  TaskStatus,
  DeveloperTaskMetrics,
  TeamTaskMetrics
} from './types'

const DEVELOPER_NAMES = [
  { name: 'Sarah Chen', email: 'sarah.chen@company.com', role: 'Senior Developer' },
  { name: 'Marcus Johnson', email: 'marcus.j@company.com', role: 'Tech Lead' },
  { name: 'Aisha Patel', email: 'aisha.patel@company.com', role: 'Full Stack Developer' },
  { name: 'Dmitri Volkov', email: 'dmitri.v@company.com', role: 'Backend Engineer' },
  { name: 'Yuki Tanaka', email: 'yuki.tanaka@company.com', role: 'Frontend Developer' },
  { name: 'Elena Rodriguez', email: 'elena.r@company.com', role: 'DevOps Engineer' },
]

const REPOSITORIES = [
  { name: 'analytics-platform', description: 'Core analytics engine and data processing', language: 'Python' },
  { name: 'web-dashboard', description: 'Customer-facing dashboard application', language: 'TypeScript' },
  { name: 'mobile-app', description: 'React Native mobile application', language: 'JavaScript' },
  { name: 'api-gateway', description: 'Microservices API gateway', language: 'Go' },
  { name: 'ml-models', description: 'Machine learning model training pipeline', language: 'Python' },
  { name: 'data-pipeline', description: 'ETL and data transformation services', language: 'Scala' },
  { name: 'auth-service', description: 'Authentication and authorization microservice', language: 'Java' },
  { name: 'notification-worker', description: 'Background job processor for notifications', language: 'Ruby' },
]

const LANGUAGES = ['TypeScript', 'Python', 'JavaScript', 'Go', 'Java', 'Rust', 'Ruby']
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TASK_CATEGORIES = [
  'Bug Fix',
  'Feature Development',
  'Code Review',
  'Documentation',
  'Testing',
  'Refactoring',
  'Performance',
  'Security',
  'Infrastructure'
]

const TASK_TITLES = [
  'Fix authentication timeout issue',
  'Implement user profile page',
  'Update API documentation',
  'Add unit tests for payment module',
  'Optimize database queries',
  'Review pull request #234',
  'Refactor legacy code in auth service',
  'Fix memory leak in background worker',
  'Add error handling to file upload',
  'Implement dark mode toggle',
  'Update dependencies to latest versions',
  'Fix responsive layout on mobile',
  'Add logging to critical endpoints',
  'Optimize image loading performance',
  'Fix race condition in cache layer'
]

const TASK_TAGS = [
  ['backend', 'urgent'],
  ['frontend', 'ui'],
  ['database', 'optimization'],
  ['security', 'critical'],
  ['testing', 'qa'],
  ['documentation'],
  ['devops', 'infrastructure'],
  ['bug', 'hotfix'],
  ['feature', 'enhancement']
]

function generateAvatar(name: string): string {
  const initials = name.split(' ').map(n => n[0]).join('')
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`
}

function generateCommitHistory(days: number, variance: number = 0.5): CommitData[] {
  const history: CommitData[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    const baseCommits = Math.floor(3 + Math.random() * 8)
    const commits = Math.max(0, Math.floor(baseCommits * (1 + (Math.random() - 0.5) * variance)))
    
    history.push({
      date: date.toISOString().split('T')[0],
      commits,
      additions: commits * Math.floor(50 + Math.random() * 200),
      deletions: commits * Math.floor(10 + Math.random() * 80),
    })
  }
  
  return history
}

export function generateDevelopers(): Developer[] {
  return DEVELOPER_NAMES.map((dev, index) => ({
    id: `dev-${index + 1}`,
    name: dev.name,
    email: dev.email,
    avatar: generateAvatar(dev.name),
    role: dev.role,
    joinedDate: new Date(2022, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
  }))
}

export function generateDeveloperMetrics(developerId: string, days: number = 90): DeveloperMetrics {
  const commitHistory = generateCommitHistory(days)
  const totalCommits = commitHistory.reduce((sum, day) => sum + day.commits, 0)
  
  const languageBreakdown = LANGUAGES.slice(0, 3 + Math.floor(Math.random() * 3))
    .map(lang => ({ language: lang, percentage: Math.random() }))
  
  const total = languageBreakdown.reduce((sum, l) => sum + l.percentage, 0)
  languageBreakdown.forEach(l => l.percentage = Math.round((l.percentage / total) * 100))
  
  const weekdayActivity = WEEKDAYS.map(day => ({
    day,
    commits: Math.floor(totalCommits / 7 * (0.5 + Math.random())),
  }))
  
  return {
    developerId,
    totalCommits,
    linesAdded: commitHistory.reduce((sum, day) => sum + day.additions, 0),
    linesDeleted: commitHistory.reduce((sum, day) => sum + day.deletions, 0),
    pullRequests: Math.floor(totalCommits * 0.3),
    reviewsGiven: Math.floor(totalCommits * 0.4),
    activeRepos: 2 + Math.floor(Math.random() * 4),
    commitHistory,
    languageBreakdown,
    weekdayActivity,
  }
}

export function generateRepositories(developers: Developer[]): Repository[] {
  return REPOSITORIES.map((repo, index) => {
    const contributorCount = 2 + Math.floor(Math.random() * developers.length)
    const selectedDevs = [...developers]
      .sort(() => Math.random() - 0.5)
      .slice(0, contributorCount)
    
    const topContributors = selectedDevs.map(dev => ({
      developerId: dev.id,
      commits: Math.floor(50 + Math.random() * 300),
    })).sort((a, b) => b.commits - a.commits).slice(0, 3)
    
    const totalCommits = topContributors.reduce((sum, c) => sum + c.commits, 0) + 
                         Math.floor(Math.random() * 200)
    
    const daysAgo = Math.floor(Math.random() * 7)
    const lastActivity = new Date()
    lastActivity.setDate(lastActivity.getDate() - daysAgo)
    
    return {
      id: `repo-${index + 1}`,
      name: repo.name,
      description: repo.description,
      primaryLanguage: repo.language,
      totalCommits,
      contributors: contributorCount,
      lastActivity: lastActivity.toISOString(),
      healthScore: 60 + Math.floor(Math.random() * 40),
      topContributors,
    }
  })
}

export function generateTeamMetrics(
  developers: Developer[],
  devMetrics: Map<string, DeveloperMetrics>,
  days: number = 90
): TeamMetrics {
  const totalCommits = Array.from(devMetrics.values()).reduce((sum, m) => sum + m.totalCommits, 0)
  const totalPullRequests = Array.from(devMetrics.values()).reduce((sum, m) => sum + m.pullRequests, 0)
  const totalReviews = Array.from(devMetrics.values()).reduce((sum, m) => sum + m.reviewsGiven, 0)
  
  const commitTrend: { date: string; commits: number }[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    let dayTotal = 0
    devMetrics.forEach(metrics => {
      const dayData = metrics.commitHistory.find(ch => ch.date === dateStr)
      if (dayData) dayTotal += dayData.commits
    })
    
    commitTrend.push({ date: dateStr, commits: dayTotal })
  }
  
  return {
    totalCommits,
    totalPullRequests,
    totalReviews,
    activeRepositories: REPOSITORIES.length,
    teamSize: developers.length,
    avgCommitsPerDev: Math.round(totalCommits / developers.length),
    commitTrend,
  }
}

export function generateSharePointTasks(developers: Developer[], days: number = 90): SharePointTask[] {
  const tasks: SharePointTask[] = []
  const now = new Date()
  
  const taskCount = 80 + Math.floor(Math.random() * 40)
  
  for (let i = 0; i < taskCount; i++) {
    const assignedDev = developers[Math.floor(Math.random() * developers.length)]
    const createdByDev = developers[Math.floor(Math.random() * developers.length)]
    
    const createdDaysAgo = Math.floor(Math.random() * days)
    const createdDate = new Date(now)
    createdDate.setDate(createdDate.getDate() - createdDaysAgo)
    
    const resolutionDays = 1 + Math.floor(Math.random() * 14)
    const resolvedDate = new Date(createdDate)
    resolvedDate.setDate(resolvedDate.getDate() + resolutionDays)
    
    const dueDate = new Date(createdDate)
    dueDate.setDate(dueDate.getDate() + resolutionDays + Math.floor(Math.random() * 7) - 3)
    
    const priorities: TaskPriority[] = ['Low', 'Normal', 'High', 'Critical']
    const priorityWeights = [0.2, 0.5, 0.25, 0.05]
    const rand = Math.random()
    let cumulative = 0
    let priority: TaskPriority = 'Normal'
    for (let j = 0; j < priorities.length; j++) {
      cumulative += priorityWeights[j]
      if (rand <= cumulative) {
        priority = priorities[j]
        break
      }
    }
    
    const statuses: TaskStatus[] = ['Resolved', 'Closed', 'Completed']
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    
    const category = TASK_CATEGORIES[Math.floor(Math.random() * TASK_CATEGORIES.length)]
    const title = TASK_TITLES[Math.floor(Math.random() * TASK_TITLES.length)]
    const tags = TASK_TAGS[Math.floor(Math.random() * TASK_TAGS.length)]
    
    const estimatedHours = 1 + Math.floor(Math.random() * 16)
    const actualHours = estimatedHours * (0.7 + Math.random() * 0.8)
    
    tasks.push({
      id: `task-${i + 1}`,
      title,
      description: `Task description for ${title}`,
      assignedTo: assignedDev.id,
      createdBy: createdByDev.id,
      priority,
      status,
      createdDate: createdDate.toISOString(),
      resolvedDate: resolvedDate.toISOString(),
      dueDate: dueDate.toISOString(),
      category,
      estimatedHours,
      actualHours: Math.round(actualHours * 10) / 10,
      tags,
    })
  }
  
  return tasks.sort((a, b) => 
    new Date(b.resolvedDate).getTime() - new Date(a.resolvedDate).getTime()
  )
}

export function generateDeveloperTaskMetrics(
  developerId: string,
  tasks: SharePointTask[],
  days: number = 90
): DeveloperTaskMetrics {
  const devTasks = tasks.filter(t => t.assignedTo === developerId)
  
  const totalTasksResolved = devTasks.length
  
  const resolutionTimes = devTasks.map(task => {
    const created = new Date(task.createdDate).getTime()
    const resolved = new Date(task.resolvedDate).getTime()
    return (resolved - created) / (1000 * 60 * 60 * 24)
  })
  const avgResolutionTime = resolutionTimes.length > 0
    ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
    : 0
  
  const priorities: TaskPriority[] = ['Low', 'Normal', 'High', 'Critical']
  const tasksByPriority = priorities.map(priority => ({
    priority,
    count: devTasks.filter(t => t.priority === priority).length,
  }))
  
  const categories = [...new Set(devTasks.map(t => t.category))]
  const tasksByCategory = categories.map(category => ({
    category,
    count: devTasks.filter(t => t.category === category).length,
  })).sort((a, b) => b.count - a.count)
  
  const tasksOverTime: { date: string; count: number }[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    const count = devTasks.filter(task => {
      const resolvedDate = task.resolvedDate.split('T')[0]
      return resolvedDate === dateStr
    }).length
    
    tasksOverTime.push({ date: dateStr, count })
  }
  
  const totalEstimated = devTasks.reduce((sum, t) => sum + t.estimatedHours, 0)
  const totalActual = devTasks.reduce((sum, t) => sum + t.actualHours, 0)
  const estimateAccuracy = totalEstimated > 0 
    ? Math.round((1 - Math.abs(totalActual - totalEstimated) / totalEstimated) * 100)
    : 100
  
  return {
    developerId,
    totalTasksResolved,
    avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
    tasksByPriority,
    tasksByCategory,
    tasksOverTime,
    estimateAccuracy,
  }
}

export function generateTeamTaskMetrics(
  tasks: SharePointTask[],
  developers: Developer[],
  days: number = 90
): TeamTaskMetrics {
  const totalTasksResolved = tasks.length
  
  const resolutionTimes = tasks.map(task => {
    const created = new Date(task.createdDate).getTime()
    const resolved = new Date(task.resolvedDate).getTime()
    return (resolved - created) / (1000 * 60 * 60 * 24)
  })
  const avgResolutionTime = resolutionTimes.length > 0
    ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
    : 0
  
  const totalEstimatedHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0)
  const totalActualHours = tasks.reduce((sum, t) => sum + t.actualHours, 0)
  
  const priorities: TaskPriority[] = ['Low', 'Normal', 'High', 'Critical']
  const tasksByPriority = priorities.map(priority => ({
    priority,
    count: tasks.filter(t => t.priority === priority).length,
  }))
  
  const taskCompletionTrend: { date: string; count: number }[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    const count = tasks.filter(task => {
      const resolvedDate = task.resolvedDate.split('T')[0]
      return resolvedDate === dateStr
    }).length
    
    taskCompletionTrend.push({ date: dateStr, count })
  }
  
  const topPerformers = developers.map(dev => ({
    developerId: dev.id,
    tasksResolved: tasks.filter(t => t.assignedTo === dev.id).length,
  })).sort((a, b) => b.tasksResolved - a.tasksResolved).slice(0, 5)
  
  return {
    totalTasksResolved,
    avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
    totalEstimatedHours,
    totalActualHours: Math.round(totalActualHours * 10) / 10,
    tasksByPriority,
    taskCompletionTrend,
    topPerformers,
  }
}
