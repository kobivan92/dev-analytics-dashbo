import type { Developer, DeveloperMetrics, Repository, TeamMetrics, CommitData } from './types'

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
