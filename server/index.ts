import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { initDatabase, getDatabase, getMetadata } from './database'
import { syncFromSCM } from './sync'

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') })

const app = express()
const PORT = process.env.API_PORT || 3001

app.use(cors())
app.use(express.json())

// Initialize database
initDatabase()

// Automatic sync function
async function performSync() {
  try {
    console.log(`[${new Date().toISOString()}] Starting automatic sync...`)
    const stats = await syncFromSCM()
    console.log(`[${new Date().toISOString()}] Sync completed:`, stats)
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] Sync failed:`, error.message)
  }
}

// Initial sync on startup
setTimeout(() => {
  performSync()
}, 5000) // Wait 5 seconds after startup

// Schedule hourly sync (every 3600000 ms = 1 hour)
const SYNC_INTERVAL = 60 * 60 * 1000 // 1 hour in milliseconds
setInterval(() => {
  performSync()
}, SYNC_INTERVAL)

console.log(`Automatic sync scheduled every ${SYNC_INTERVAL / 1000 / 60} minutes`)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Sync from SCM
app.post('/api/sync', async (req, res) => {
  try {
    const stats = await syncFromSCM()
    res.json({ success: true, stats })
  } catch (error: any) {
    console.error('Sync failed:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Get sync status
app.get('/api/sync/status', (req, res) => {
  try {
    const lastSyncTime = getMetadata('last_sync_time')
    const lastSyncStats = getMetadata('last_sync_stats')
    
    const stats = lastSyncStats ? JSON.parse(lastSyncStats) : null
    const nextSyncIn = lastSyncTime 
      ? Math.max(0, SYNC_INTERVAL - (Date.now() - new Date(lastSyncTime).getTime()))
      : 0
    
    res.json({
      lastSyncTime,
      lastSyncStats: stats,
      syncInterval: SYNC_INTERVAL,
      nextSyncIn,
      autoSyncEnabled: true
    })
  } catch (error: any) {
    console.error('Failed to fetch sync status:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get all repositories
app.get('/api/repositories', (req, res) => {
  try {
    const db = getDatabase()
    const repos = db.exec(`
      SELECT 
        r.*,
        COUNT(DISTINCT rc.developer_id) as contributors,
        COUNT(rc.id) as totalCommits
      FROM repositories r
      LEFT JOIN repo_commits rc ON r.id = rc.repo_id
      GROUP BY r.id
      ORDER BY r.name
    `)[0]
    
    const result = repos ? repos.values.map((row: any) => ({
      id: row[0],
      name: row[1],
      namespace: row[2],
      description: row[3],
      primaryLanguage: row[4],
      lastActivity: row[5],
      healthScore: row[6],
      contributors: row[7],
      totalCommits: row[8],
    })) : []
    
    res.json(result)
  } catch (error: any) {
    console.error('Failed to fetch repositories:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get repository with top contributors
app.get('/api/repositories/:id', (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    const repoResult = db.exec(`
      SELECT 
        r.*,
        COUNT(DISTINCT rc.developer_id) as contributors,
        COUNT(rc.id) as totalCommits
      FROM repositories r
      LEFT JOIN repo_commits rc ON r.id = rc.repo_id
      WHERE r.id = ?
      GROUP BY r.id
    `, [id])
    
    if (!repoResult[0] || !repoResult[0].values.length) {
      return res.status(404).json({ error: 'Repository not found' })
    }
    
    const row = repoResult[0].values[0]
    const repo = {
      id: row[0],
      name: row[1],
      namespace: row[2],
      description: row[3],
      primaryLanguage: row[4],
      lastActivity: row[5],
      healthScore: row[6],
      contributors: row[7],
      totalCommits: row[8],
    }
    
    const topContribsResult = db.exec(`
      SELECT 
        d.id,
        d.name,
        COUNT(rc.id) as commits
      FROM repo_commits rc
      JOIN developers d ON rc.developer_id = d.id
      WHERE rc.repo_id = ?
      GROUP BY d.id
      ORDER BY commits DESC
      LIMIT 5
    `, [id])
    
    const topContributors = topContribsResult[0]
      ? topContribsResult[0].values.map((r: any) => ({
          developerId: r[0],
          commits: r[2]
        }))
      : []
    
    res.json({ ...repo, topContributors })
  } catch (error: any) {
    console.error('Failed to fetch repository:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get all developers
app.get('/api/developers', (req, res) => {
  try {
    const db = getDatabase()
    const devsResult = db.exec(`
      SELECT 
        d.*,
        COUNT(DISTINCT rc.repo_id) as activeRepos,
        COUNT(rc.id) as totalCommits
      FROM developers d
      LEFT JOIN repo_commits rc ON d.id = rc.developer_id
      GROUP BY d.id
      ORDER BY d.name
    `)
    
    const result = devsResult[0] ? devsResult[0].values.map((row: any) => ({
      id: row[0],
      name: row[1],
      email: row[2],
      avatar: row[3],
      role: row[4],
      joinedDate: row[5],
      activeRepos: row[6],
      totalCommits: row[7],
    })) : []
    
    res.json(result)
  } catch (error: any) {
    console.error('Failed to fetch developers:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get developer metrics with flexible time range
app.get('/api/developers/:id/metrics', (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    const daysParam = req.query.days || '90'
    const days = parseInt(typeof daysParam === 'string' ? daysParam : '90', 10)
    
    // Get totals filtered by time period
    const totalsResult = db.exec(`
      SELECT 
        COUNT(DISTINCT rc.repo_id) as activeRepos,
        COUNT(rc.id) as totalCommits,
        SUM(c.additions) as linesAdded,
        SUM(c.deletions) as linesDeleted
      FROM repo_commits rc
      LEFT JOIN commits c ON rc.commit_hash = c.hash
      WHERE rc.developer_id = ?
        AND date(c.timestamp) >= date('now', '-' || ? || ' day')
    `, [id, days])
    
    const totals = totalsResult[0] && totalsResult[0].values[0]
      ? {
          activeRepos: totalsResult[0].values[0][0] || 0,
          totalCommits: totalsResult[0].values[0][1] || 0,
          linesAdded: totalsResult[0].values[0][2] || 0,
          linesDeleted: totalsResult[0].values[0][3] || 0,
        }
      : { activeRepos: 0, totalCommits: 0, linesAdded: 0, linesDeleted: 0 }
    
    // Get commit history data filtered by time period (for charts)
    const commitHistoryResult = db.exec(`
      SELECT 
        date(c.timestamp) as date,
        COUNT(*) as commits,
        SUM(c.additions) as additions,
        SUM(c.deletions) as deletions
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      WHERE rc.developer_id = ?
        AND date(c.timestamp) >= date('now', '-' || ? || ' day')
      GROUP BY date(c.timestamp)
      ORDER BY date(c.timestamp)
    `, [id, days])
    
    const commitHistory = commitHistoryResult[0]
      ? commitHistoryResult[0].values.map((r: any) => ({
          date: r[0],
          commits: r[1],
          additions: r[2] || 0,
          deletions: r[3] || 0,
        }))
      : []
    
    // Get commit history with repository breakdown filtered by time period (for charts)
    const commitHistoryByRepoResult = db.exec(`
      SELECT 
        date(c.timestamp) as date,
        r.name as repository,
        COUNT(*) as commits,
        SUM(c.additions) as additions,
        SUM(c.deletions) as deletions
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      JOIN repositories r ON rc.repo_id = r.id
      WHERE rc.developer_id = ?
        AND date(c.timestamp) >= date('now', '-' || ? || ' day')
      GROUP BY date(c.timestamp), r.name
      ORDER BY date(c.timestamp), r.name
    `, [id, days])
    
    // Build repository breakdown map for charts
    const commitHistoryByRepo = new Map<string, any[]>()
    if (commitHistoryByRepoResult[0]) {
      commitHistoryByRepoResult[0].values.forEach((r: any) => {
        const date = r[0]
        const repo = r[1]
        const commits = r[2]
        const additions = r[3] || 0
        const deletions = r[4] || 0
        
        if (!commitHistoryByRepo.has(date)) {
          commitHistoryByRepo.set(date, [])
        }
        commitHistoryByRepo.get(date)!.push({ name: repo, commits, additions, deletions })
      })
    }
    
    // Enhance commitHistory with repository data
    const commitHistoryEnhanced = commitHistory.map(day => ({
      ...day,
      repositories: commitHistoryByRepo.get(day.date) || []
    }))
    
    // Get heatmap data (always last 365 days, independent of filter)
    const heatmapResult = db.exec(`
      SELECT 
        date(c.timestamp) as date,
        COUNT(*) as commits,
        SUM(c.additions) as additions,
        SUM(c.deletions) as deletions
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      WHERE rc.developer_id = ?
        AND date(c.timestamp) >= date('now', '-365 day')
      GROUP BY date(c.timestamp)
      ORDER BY date(c.timestamp)
    `, [id])
    
    const heatmapData = heatmapResult[0]
      ? heatmapResult[0].values.map((r: any) => ({
          date: r[0],
          commits: r[1],
          additions: r[2] || 0,
          deletions: r[3] || 0,
        }))
      : []
    
    // Get heatmap data with repository breakdown (always last 365 days)
    const heatmapByRepoResult = db.exec(`
      SELECT 
        date(c.timestamp) as date,
        r.name as repository,
        COUNT(*) as commits,
        SUM(c.additions) as additions,
        SUM(c.deletions) as deletions
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      JOIN repositories r ON rc.repo_id = r.id
      WHERE rc.developer_id = ?
        AND date(c.timestamp) >= date('now', '-365 day')
      GROUP BY date(c.timestamp), r.name
      ORDER BY date(c.timestamp), r.name
    `, [id])
    
    // Build repository breakdown map for heatmap
    const heatmapByRepo = new Map<string, any[]>()
    if (heatmapByRepoResult[0]) {
      heatmapByRepoResult[0].values.forEach((r: any) => {
        const date = r[0]
        const repo = r[1]
        const commits = r[2]
        const additions = r[3] || 0
        const deletions = r[4] || 0
        
        if (!heatmapByRepo.has(date)) {
          heatmapByRepo.set(date, [])
        }
        heatmapByRepo.get(date)!.push({ name: repo, commits, additions, deletions })
      })
    }
    
    // Enhance heatmap data with repository data
    const heatmapDataEnhanced = heatmapData.map(day => ({
      ...day,
      repositories: heatmapByRepo.get(day.date) || []
    }))
    
    // Aggregate by month with repository breakdown for 12-month view
    const monthlyByRepoResult = db.exec(`
      SELECT 
        strftime('%Y-%m', c.timestamp) as month,
        r.name as repository,
        SUM(c.additions) as additions,
        SUM(c.deletions) as deletions
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      JOIN repositories r ON rc.repo_id = r.id
      WHERE rc.developer_id = ?
        AND date(c.timestamp) >= date('now', '-12 month')
      GROUP BY strftime('%Y-%m', c.timestamp), r.name
      ORDER BY month, r.name
    `, [id])
    
    // Transform to format with repository breakdown
    const monthlyActivityMap = new Map<string, any>()
    if (monthlyByRepoResult[0]) {
      monthlyByRepoResult[0].values.forEach((r: any) => {
        const month = r[0]
        const repo = r[1]
        const additions = r[2] || 0
        const deletions = r[3] || 0
        
        if (!monthlyActivityMap.has(month)) {
          monthlyActivityMap.set(month, { month, additions: 0, deletions: 0, repositories: [] })
        }
        
        const monthData = monthlyActivityMap.get(month)
        monthData.additions += additions
        monthData.deletions += deletions
        monthData.repositories.push({ name: repo, additions, deletions })
      })
    }
    
    const monthlyActivity = Array.from(monthlyActivityMap.values())
    
    // Get weekday activity
    const weekdayResult = db.exec(`
      SELECT 
        CASE CAST(strftime('%w', c.timestamp) AS INTEGER)
          WHEN 0 THEN 'Sunday'
          WHEN 1 THEN 'Monday'
          WHEN 2 THEN 'Tuesday'
          WHEN 3 THEN 'Wednesday'
          WHEN 4 THEN 'Thursday'
          WHEN 5 THEN 'Friday'
          WHEN 6 THEN 'Saturday'
        END as day,
        COUNT(*) as commits
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      WHERE rc.developer_id = ?
      GROUP BY strftime('%w', c.timestamp)
      ORDER BY CAST(strftime('%w', c.timestamp) AS INTEGER)
    `, [id])

    const weekdayActivity = weekdayResult[0]
      ? weekdayResult[0].values.map((r: any) => ({
          day: r[0],
          commits: r[1],
        }))
      : []

    res.json({
      developerId: id,
      ...totals,
      pullRequests: 0,
      reviewsGiven: 0,
      commitHistory: commitHistoryEnhanced,
      heatmapData: heatmapDataEnhanced,
      monthlyActivity,
      languageBreakdown: [],
      weekdayActivity,
    })
  } catch (error: any) {
    console.error('Failed to fetch developer metrics:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get branches for a repository
app.get('/api/repositories/:id/branches', (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    const branchesResult = db.exec(`
      SELECT name, is_default, last_commit_date, commit_count
      FROM branches
      WHERE repo_id = ?
      ORDER BY is_default DESC, name
    `, [id])
    
    const branches = branchesResult[0]
      ? branchesResult[0].values.map((r: any) => ({
          name: r[0],
          isDefault: r[1] === 1,
          lastCommitDate: r[2],
          commitCount: r[3],
        }))
      : []
    
    res.json(branches)
  } catch (error: any) {
    console.error('Failed to fetch branches:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get daily commit activity for a repository (last 365 days)
app.get('/api/repositories/:id/activity', (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    const activityResult = db.exec(`
      SELECT date(c.timestamp) as date, COUNT(*) as commits
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      WHERE rc.repo_id = ?
        AND date(c.timestamp) >= date('now', '-365 day')
      GROUP BY date(c.timestamp)
      ORDER BY date(c.timestamp)
    `, [id])
    
    const activity = activityResult[0]
      ? activityResult[0].values.map((r: any) => ({
          date: r[0],
          commits: r[1],
        }))
      : []
    
    // Get contributor breakdown by date
    const contributorResult = db.exec(`
      SELECT 
        date(c.timestamp) as date,
        d.name as contributor,
        COUNT(*) as commits,
        SUM(c.additions) as additions,
        SUM(c.deletions) as deletions
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      JOIN developers d ON rc.developer_id = d.id
      WHERE rc.repo_id = ?
        AND date(c.timestamp) >= date('now', '-365 day')
      GROUP BY date(c.timestamp), d.name
      ORDER BY date(c.timestamp), d.name
    `, [id])
    
    // Build contributor breakdown map
    const contributorsByDate = new Map<string, any[]>()
    if (contributorResult[0]) {
      contributorResult[0].values.forEach((r: any) => {
        const date = r[0]
        const contributor = r[1]
        const commits = r[2]
        const additions = r[3] || 0
        const deletions = r[4] || 0
        
        if (!contributorsByDate.has(date)) {
          contributorsByDate.set(date, [])
        }
        contributorsByDate.get(date)!.push({ 
          name: contributor, 
          commits, 
          additions, 
          deletions 
        })
      })
    }
    
    // Enhance activity with contributor data
    const activityEnhanced = activity.map(day => ({
      ...day,
      contributors: contributorsByDate.get(day.date) || []
    }))
    
    res.json(activityEnhanced)
  } catch (error: any) {
    console.error('Failed to fetch repo activity:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get monthly activity for a repository
app.get('/api/repositories/:id/monthly-activity', (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    const monthlyResult = db.exec(`
      SELECT 
        strftime('%Y-%m', c.timestamp) as month,
        COUNT(*) as commits,
        SUM(c.additions) as additions,
        SUM(c.deletions) as deletions
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      WHERE rc.repo_id = ?
        AND date(c.timestamp) >= date('now', '-12 month')
      GROUP BY strftime('%Y-%m', c.timestamp)
      ORDER BY month
    `, [id])
    
    const monthlyActivity = monthlyResult[0]
      ? monthlyResult[0].values.map((r: any) => ({
          month: r[0],
          commits: r[1],
          additions: r[2] || 0,
          deletions: r[3] || 0,
        }))
      : []
    
    res.json(monthlyActivity)
  } catch (error: any) {
    console.error('Failed to fetch repo monthly activity:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get team-wide commit activity (last 90 days)
app.get('/api/team/activity', (req, res) => {
  try {
    const db = getDatabase()
    const { days = 90 } = req.query
    const daysParam = typeof days === 'string' ? parseInt(days, 10) : 90
    
    const activityResult = db.exec(`
      SELECT 
        date(c.timestamp) as date,
        COUNT(*) as commits,
        SUM(c.additions) as additions
      FROM commits c
      WHERE date(c.timestamp) >= date('now', '-' || ? || ' day')
      GROUP BY date(c.timestamp)
      ORDER BY date(c.timestamp)
    `, [daysParam])
    
    const activity = activityResult[0]
      ? activityResult[0].values.map((r: any) => ({
          date: r[0],
          commits: r[1],
          additions: r[2] || 0,
        }))
      : []

    // Get repository breakdown for each date
    const repoBreakdownResult = db.exec(`
      SELECT 
        date(c.timestamp) as date,
        r.name as repo,
        COUNT(*) as commits,
        SUM(c.additions) as additions
      FROM commits c
      JOIN repo_commits rc ON c.hash = rc.commit_hash
      JOIN repositories r ON rc.repo_id = r.id
      WHERE date(c.timestamp) >= date('now', '-' || ? || ' day')
      GROUP BY date(c.timestamp), r.name
      ORDER BY date(c.timestamp), r.name
    `, [daysParam])

    // Build repository breakdown map
    const reposByDate = new Map<string, any[]>()
    if (repoBreakdownResult[0]) {
      repoBreakdownResult[0].values.forEach((r: any) => {
        const date = r[0]
        const repo = r[1]
        const commits = r[2]
        const additions = r[3] || 0
        
        if (!reposByDate.has(date)) {
          reposByDate.set(date, [])
        }
        reposByDate.get(date)!.push({ name: repo, commits, additions })
      })
    }

    // Enhance activity with repository data
    const activityEnhanced = activity.map(day => ({
      ...day,
      repositories: reposByDate.get(day.date) || []
    }))
    
    res.json(activityEnhanced)
  } catch (error: any) {
    console.error('Failed to fetch team activity:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get team metrics comparison (current month vs last month)
app.get('/api/team/metrics-comparison', (req, res) => {
  try {
    const db = getDatabase()
    
    // Current month commits
    const currentMonthResult = db.exec(`
      SELECT COUNT(*) as commits
      FROM commits c
      WHERE strftime('%Y-%m', c.timestamp) = strftime('%Y-%m', 'now')
    `)
    
    const currentMonthCommits = Number(currentMonthResult[0]?.values[0]?.[0] || 0)
    
    // Last month commits
    const lastMonthResult = db.exec(`
      SELECT COUNT(*) as commits
      FROM commits c
      WHERE strftime('%Y-%m', c.timestamp) = strftime('%Y-%m', date('now', '-1 month'))
    `)
    
    const lastMonthCommits = Number(lastMonthResult[0]?.values[0]?.[0] || 0)
    
    // Calculate percentage change
    const commitsChange = lastMonthCommits > 0 
      ? Math.round(((currentMonthCommits - lastMonthCommits) / lastMonthCommits) * 100)
      : 0
    
    // Current month active repos (repos with commits this month)
    const currentMonthReposResult = db.exec(`
      SELECT COUNT(DISTINCT rc.repo_id) as repos
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      WHERE strftime('%Y-%m', c.timestamp) = strftime('%Y-%m', 'now')
    `)
    
    const currentMonthRepos = Number(currentMonthReposResult[0]?.values[0]?.[0] || 0)
    
    // Last month active repos
    const lastMonthReposResult = db.exec(`
      SELECT COUNT(DISTINCT rc.repo_id) as repos
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      WHERE strftime('%Y-%m', c.timestamp) = strftime('%Y-%m', date('now', '-1 month'))
    `)
    
    const lastMonthRepos = Number(lastMonthReposResult[0]?.values[0]?.[0] || 0)
    
    // Calculate percentage change
    const reposChange = lastMonthRepos > 0
      ? Math.round(((currentMonthRepos - lastMonthRepos) / lastMonthRepos) * 100)
      : 0
    
    res.json({
      commits: {
        current: currentMonthCommits,
        last: lastMonthCommits,
        changePercent: commitsChange
      },
      activeRepos: {
        current: currentMonthRepos,
        last: lastMonthRepos,
        changePercent: reposChange
      },
      pullRequests: {
        current: 0,
        last: 0,
        changePercent: 0
      },
      reviews: {
        current: 0,
        last: 0,
        changePercent: 0
      }
    })
  } catch (error: any) {
    console.error('Failed to fetch team metrics comparison:', error)
    res.status(500).json({ error: error.message })
  }
})

// Reload database endpoint
app.post('/api/reload-database', async (req, res) => {
  try {
    const { reloadDatabase } = await import('./database')
    await reloadDatabase()
    res.json({ success: true, message: 'Database reloaded successfully' })
  } catch (error: any) {
    console.error('Failed to reload database:', error)
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
