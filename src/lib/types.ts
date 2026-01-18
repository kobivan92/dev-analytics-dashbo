export interface Developer {
  id: string
  name: string
  email: string
  avatar: string
  role: string
  joinedDate: string
}

export interface CommitData {
  date: string
  commits: number
  additions: number
  deletions: number
}

export interface DeveloperMetrics {
  developerId: string
  totalCommits: number
  linesAdded: number
  linesDeleted: number
  pullRequests: number
  reviewsGiven: number
  activeRepos: number
  commitHistory: CommitData[]
  languageBreakdown: { language: string; percentage: number }[]
  weekdayActivity: { day: string; commits: number }[]
}

export interface Repository {
  id: string
  name: string
  description: string
  primaryLanguage: string
  totalCommits: number
  contributors: number
  lastActivity: string
  healthScore: number
  topContributors: { developerId: string; commits: number }[]
}

export interface TeamMetrics {
  totalCommits: number
  totalPullRequests: number
  totalReviews: number
  activeRepositories: number
  teamSize: number
  avgCommitsPerDev: number
  commitTrend: { date: string; commits: number }[]
}

export type DateRange = '7d' | '30d' | '90d' | 'custom'

export interface DateRangeSelection {
  range: DateRange
  startDate?: Date
  endDate?: Date
}

export type TaskPriority = 'Low' | 'Normal' | 'High' | 'Critical'
export type TaskStatus = 'Resolved' | 'Closed' | 'Completed'

export interface SharePointTask {
  id: string
  title: string
  description: string
  assignedTo: string
  createdBy: string
  priority: TaskPriority
  status: TaskStatus
  createdDate: string
  resolvedDate: string
  dueDate: string
  category: string
  estimatedHours: number
  actualHours: number
  tags: string[]
}

export interface DeveloperTaskMetrics {
  developerId: string
  totalTasksResolved: number
  avgResolutionTime: number
  tasksByPriority: { priority: TaskPriority; count: number }[]
  tasksByCategory: { category: string; count: number }[]
  tasksOverTime: { date: string; count: number }[]
  estimateAccuracy: number
}

export interface TeamTaskMetrics {
  totalTasksResolved: number
  avgResolutionTime: number
  totalEstimatedHours: number
  totalActualHours: number
  tasksByPriority: { priority: TaskPriority; count: number }[]
  taskCompletionTrend: { date: string; count: number }[]
  topPerformers: { developerId: string; tasksResolved: number }[]
}
