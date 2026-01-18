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
