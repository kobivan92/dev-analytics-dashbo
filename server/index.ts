import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import path from 'path'
import { initDatabase, getDatabase } from './database'
import { syncFromSCM } from './sync'

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') })

const app = express()
const PORT = process.env.API_PORT || 3001

app.use(cors())
app.use(express.json())

// Initialize database
initDatabase()

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

// Get developer metrics
app.get('/api/developers/:id/metrics', (req, res) => {
  try {
    const db = getDatabase()
    const { id } = req.params
    
    const commitsResult = db.exec(`
      SELECT 
        date(c.timestamp) as date,
        COUNT(*) as commits,
        SUM(c.additions) as additions,
        SUM(c.deletions) as deletions
      FROM repo_commits rc
      JOIN commits c ON rc.commit_hash = c.hash
      WHERE rc.developer_id = ?
      GROUP BY date(c.timestamp)
      ORDER BY date(c.timestamp)
      LIMIT 90
    `, [id])
    
    const commitHistory = commitsResult[0]
      ? commitsResult[0].values.map((r: any) => ({
          date: r[0],
          commits: r[1],
          additions: r[2] || 0,
          deletions: r[3] || 0,
        }))
      : []
    
    const totalsResult = db.exec(`
      SELECT 
        COUNT(DISTINCT rc.repo_id) as activeRepos,
        COUNT(rc.id) as totalCommits,
        SUM(c.additions) as linesAdded,
        SUM(c.deletions) as linesDeleted
      FROM repo_commits rc
      LEFT JOIN commits c ON rc.commit_hash = c.hash
      WHERE rc.developer_id = ?
    `, [id])
    
    const totals = totalsResult[0] && totalsResult[0].values[0]
      ? {
          activeRepos: totalsResult[0].values[0][0] || 0,
          totalCommits: totalsResult[0].values[0][1] || 0,
          linesAdded: totalsResult[0].values[0][2] || 0,
          linesDeleted: totalsResult[0].values[0][3] || 0,
        }
      : { activeRepos: 0, totalCommits: 0, linesAdded: 0, linesDeleted: 0 }
    
    res.json({
      developerId: id,
      ...totals,
      pullRequests: 0,
      reviewsGiven: 0,
      commitHistory,
      languageBreakdown: [],
      weekdayActivity: [],
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

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
