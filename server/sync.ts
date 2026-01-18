import { insertRepository, insertDeveloper, insertCommit, linkRepoCommit, insertBranch, saveDatabase } from './database'

function getSCMConfig() {
  return {
    baseUrl: process.env.VITE_SCM_BASE_URL || '',
    token: process.env.VITE_SCM_TOKEN,
    username: process.env.VITE_SCM_USERNAME,
    password: process.env.VITE_SCM_PASSWORD,
    reposPath: process.env.VITE_SCM_REPOS_PATH || '/scm/api/v2/repositories',
  }
}

interface SCMRepository {
  name: string
  namespace?: string
  description?: string
  type?: string
  lastModified?: string
  _links?: {
    changesets?: { href: string }
    commits?: { href: string }
    branches?: { href: string }
  }
}

interface SCMChangeset {
  id: string
  date?: number
  author?: {
    name?: string
    mail?: string
  }
  description?: string
}

function buildAuthHeaders(cfg: any): HeadersInit {
  const headers: HeadersInit = { 
    'Accept': 'application/vnd.scmm-repositoryCollection+json;v=2',
    'Content-Type': 'application/json'
  }
  if (cfg.token) {
    headers['Authorization'] = `Bearer ${cfg.token}`
  } else if (cfg.username && cfg.password) {
    const encoded = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64')
    headers['Authorization'] = `Basic ${encoded}`
  }
  return headers
}

async function fetchJson(url: string, headers?: HeadersInit): Promise<any> {
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${text}`)
  }
  return res.json()
}

export async function syncFromSCM(): Promise<{ repos: number; developers: number; commits: number }> {
  const cfg = getSCMConfig()
  if (!cfg.baseUrl) throw new Error('SCM base URL not configured')
  
  const headers = buildAuthHeaders(cfg)
  const reposUrl = cfg.baseUrl.replace(/\/$/, '') + (cfg.reposPath || '/scm/api/v2/repositories').replace(/\/+$/, '') + '/'
  
  console.log('Fetching repositories from:', reposUrl)
  const reposData = await fetchJson(reposUrl, headers)
  const repos: SCMRepository[] = reposData?._embedded?.repositories || []
  
  console.log(`Found ${repos.length} repositories`)
  
  let totalCommits = 0
  const developerSet = new Set<string>()
  
  for (const repo of repos) {
    const repoId = `${repo.namespace || 'default'}/${repo.name}`
    const repoName = repo.name
    const namespace = repo.namespace || 'default'
    
    console.log(`Processing repository: ${repoId}`)
    
    // Fetch changesets for this repository first to get metrics
    const changesetsUrl = repo._links?.changesets?.href || repo._links?.commits?.href
    let changesets: SCMChangeset[] = []
    let lastActivity = repo.lastModified || new Date().toISOString()
    let healthScore = 50
    
    if (changesetsUrl) {
      const fullChangesetsUrl = changesetsUrl.startsWith('http')
        ? changesetsUrl
        : cfg.baseUrl.replace(/\/$/, '') + changesetsUrl
      
      try {
        console.log(`  Fetching changesets from: ${fullChangesetsUrl}`)
        const changesetsData = await fetchJson(fullChangesetsUrl + '?limit=500', {
          ...headers,
          'Accept': 'application/vnd.scmm-changesetCollection+json;v=2',
        })
        changesets = changesetsData?._embedded?.changesets || []
        
        console.log(`  Found ${changesets.length} changesets`)
        
        // Get most recent commit date (date is in milliseconds)
        if (changesets.length > 0) {
          const mostRecent = changesets.reduce((latest, cs) => {
            const csDate = cs.date || 0
            return csDate > latest ? csDate : latest
          }, 0)
          if (mostRecent > 0) {
            lastActivity = new Date(mostRecent).toISOString()
          }
          
          // Calculate health score based on:
          // - Number of commits (0-40 points)
          // - Number of unique contributors (0-30 points)
          // - Recent activity (0-30 points)
          const commitScore = Math.min(changesets.length / 10, 40)
          const contributorCount = new Set(changesets.map(cs => cs.author?.name || 'Unknown')).size
          const contributorScore = Math.min(contributorCount * 5, 30)
          
          const daysSinceLastCommit = (Date.now() - mostRecent) / (1000 * 60 * 60 * 24)
          let recencyScore = 30
          if (daysSinceLastCommit > 365) recencyScore = 5
          else if (daysSinceLastCommit > 180) recencyScore = 10
          else if (daysSinceLastCommit > 90) recencyScore = 15
          else if (daysSinceLastCommit > 30) recencyScore = 20
          else if (daysSinceLastCommit > 7) recencyScore = 25
          
          healthScore = Math.round(commitScore + contributorScore + recencyScore)
        }
      } catch (err) {
        console.error(`  Failed to fetch changesets for ${repoId}:`, err)
      }
    } else {
      console.log(`  No changesets link found for ${repoId}`)
    }
    
    insertRepository({
      id: repoId,
      name: repoName,
      namespace,
      description: repo.description,
      primaryLanguage: repo.type || 'Unknown',
      lastActivity,
      healthScore,
    })
    
    // Fetch branches
    const branchesUrl = repo._links?.branches?.href
    if (branchesUrl) {
      try {
        const fullBranchesUrl = branchesUrl.startsWith('http')
          ? branchesUrl
          : cfg.baseUrl.replace(/\/$/, '') + branchesUrl
        
        console.log(`  Fetching branches from: ${fullBranchesUrl}`)
        const branchesData = await fetchJson(fullBranchesUrl, {
          ...headers,
          'Accept': 'application/vnd.scmm-branchCollection+json;v=2',
        })
        const branches = branchesData?._embedded?.branches || []
        console.log(`  Found ${branches.length} branches`)
        
        for (const branch of branches) {
          insertBranch({
            repoId,
            name: branch.name,
            isDefault: branch.defaultBranch || false,
            lastCommitDate: branch.lastCommitDate || null,
            commitCount: 0,
          })
        }
      } catch (err) {
        console.warn(`  Failed to fetch branches for ${repoId}:`, err)
      }
    }
    
    // Process changesets to insert developers and commits
    if (changesets.length > 0) {
      for (const cs of changesets) {
        const authorName = cs.author?.name || 'Unknown'
        const authorEmail = cs.author?.mail || `${authorName.toLowerCase().replace(/\s+/g, '.')}@scm.local`
        const developerId = authorName
        
        // Insert developer
        if (!developerSet.has(developerId)) {
          insertDeveloper({
            id: developerId,
            name: authorName,
            email: authorEmail,
            role: 'Developer',
          })
          developerSet.add(developerId)
        }
        
        // Insert commit
        const commitHash = cs.id
        const timestamp = cs.date ? new Date(cs.date).toISOString() : new Date().toISOString()
        
        insertCommit({
          hash: commitHash,
          message: cs.description || '',
          timestamp,
          additions: 0,
          deletions: 0,
        })
        
        // Link repo, developer, and commit
        linkRepoCommit(repoId, developerId, commitHash)
        totalCommits++
      }
    }
  }
  
  // Save database after all inserts
  saveDatabase()
  
  console.log('Sync complete:', {
    repos: repos.length,
    developers: developerSet.size,
    commits: totalCommits,
  })
  
  return {
    repos: repos.length,
    developers: developerSet.size,
    commits: totalCommits,
  }
}
