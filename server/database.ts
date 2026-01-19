import initSqlJs, { Database } from 'sql.js'
import fs from 'fs'
import path from 'path'

let db: Database | null = null
const DB_PATH = path.resolve(process.cwd(), 'data/devmetrics.sqlite')

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs()
  
  // Load existing database or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buffer)
    console.log('Loaded existing database from', DB_PATH)
  } else {
    db = new SQL.Database()
    console.log('Created new database')
    
    // Ensure data directory exists
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
  
  createTables()
  saveDatabase()
}

function createTables(): void {
  if (!db) throw new Error('Database not initialized')
  
  // Repositories table
  db.run(`
    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      namespace TEXT,
      description TEXT,
      primaryLanguage TEXT,
      lastActivity TEXT,
      healthScore INTEGER DEFAULT 70
    )
  `)
  
  // Developers table
  db.run(`
    CREATE TABLE IF NOT EXISTS developers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      role TEXT,
      joinedDate TEXT
    )
  `)
  
  // Commits table
  db.run(`
    CREATE TABLE IF NOT EXISTS commits (
      hash TEXT PRIMARY KEY,
      message TEXT,
      timestamp TEXT,
      additions INTEGER DEFAULT 0,
      deletions INTEGER DEFAULT 0
    )
  `)
  
  // Repository-commits junction (tracks which developer committed to which repo)
  db.run(`
    CREATE TABLE IF NOT EXISTS repo_commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id TEXT NOT NULL,
      developer_id TEXT NOT NULL,
      commit_hash TEXT NOT NULL,
      FOREIGN KEY (repo_id) REFERENCES repositories(id),
      FOREIGN KEY (developer_id) REFERENCES developers(id),
      FOREIGN KEY (commit_hash) REFERENCES commits(hash),
      UNIQUE(repo_id, commit_hash)
    )
  `)
  
  // Branches table
  db.run(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      last_commit_date TEXT,
      commit_count INTEGER DEFAULT 0,
      FOREIGN KEY (repo_id) REFERENCES repositories(id),
      UNIQUE(repo_id, name)
    )
  `)
  
  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_repo_commits_repo ON repo_commits(repo_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_repo_commits_dev ON repo_commits(developer_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_commits_timestamp ON commits(timestamp)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_branches_repo ON branches(repo_id)`)
  
  // Metadata table for tracking sync status
  db.run(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)
  
  // Developer aliases table for preserving custom names
  db.run(`
    CREATE TABLE IF NOT EXISTS developer_aliases (
      developer_id TEXT PRIMARY KEY,
      custom_name TEXT NOT NULL,
      FOREIGN KEY (developer_id) REFERENCES developers(id)
    )
  `)
  
  console.log('Database tables created/verified')
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export async function reloadDatabase(): Promise<void> {
  console.log('Reloading database from disk...')
  const SQL = await initSqlJs()
  
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buffer)
    console.log('Database reloaded from', DB_PATH)
  } else {
    throw new Error('Database file not found')
  }
}

export function saveDatabase(): void {
  if (!db) throw new Error('Database not initialized')
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

export function insertRepository(repo: {
  id: string
  name: string
  namespace?: string
  description?: string
  primaryLanguage?: string
  lastActivity?: string
  healthScore?: number
}): void {
  if (!db) throw new Error('Database not initialized')
  
  db.run(`
    INSERT OR REPLACE INTO repositories 
    (id, name, namespace, description, primaryLanguage, lastActivity, healthScore)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    repo.id,
    repo.name,
    repo.namespace || null,
    repo.description || null,
    repo.primaryLanguage || 'Unknown',
    repo.lastActivity || new Date().toISOString(),
    repo.healthScore || 70
  ])
}

export function insertDeveloper(dev: {
  id: string
  name: string
  email?: string
  avatar?: string
  role?: string
  joinedDate?: string
}): void {
  if (!db) throw new Error('Database not initialized')
  
  // Check if developer already exists
  const existing = db.exec(`SELECT id, joinedDate FROM developers WHERE id = ?`, [dev.id])
  
  if (existing[0] && existing[0].values.length > 0) {
    // Check if there's a custom name alias
    const aliasResult = db.exec(`SELECT custom_name FROM developer_aliases WHERE developer_id = ?`, [dev.id])
    const customName = aliasResult[0]?.values[0]?.[0]
    
    // Developer exists - only update name if no custom alias, always update email, avatar, role
    db.run(`
      UPDATE developers 
      SET name = ?, email = ?, avatar = ?, role = ?
      WHERE id = ?
    `, [
      customName || dev.name, // Use custom name if it exists, otherwise use SCM name
      dev.email || `${dev.name.toLowerCase().replace(/\s+/g, '.')}@scm.local`,
      dev.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(dev.name)}&background=random&size=128`,
      dev.role || 'Contributor',
      dev.id
    ])
  } else {
    // New developer - insert with joinedDate
    db.run(`
      INSERT INTO developers 
      (id, name, email, avatar, role, joinedDate)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      dev.id,
      dev.name,
      dev.email || `${dev.name.toLowerCase().replace(/\s+/g, '.')}@scm.local`,
      dev.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(dev.name)}&background=random&size=128`,
      dev.role || 'Contributor',
      dev.joinedDate || new Date().toISOString()
    ])
  }
}

export function insertCommit(commit: {
  hash: string
  message?: string
  timestamp?: string
  additions?: number
  deletions?: number
}): void {
  if (!db) throw new Error('Database not initialized')
  
  db.run(`
    INSERT OR IGNORE INTO commits 
    (hash, message, timestamp, additions, deletions)
    VALUES (?, ?, ?, ?, ?)
  `, [
    commit.hash,
    commit.message || '',
    commit.timestamp || new Date().toISOString(),
    commit.additions || 0,
    commit.deletions || 0
  ])
}

export function linkRepoCommit(repoId: string, developerId: string, commitHash: string): void {
  if (!db) throw new Error('Database not initialized')
  
  db.run(`
    INSERT OR IGNORE INTO repo_commits 
    (repo_id, developer_id, commit_hash)
    VALUES (?, ?, ?)
  `, [repoId, developerId, commitHash])
}

export function insertBranch(branch: {
  repoId: string
  name: string
  isDefault?: boolean
  lastCommitDate?: string
  commitCount?: number
}): void {
  if (!db) throw new Error('Database not initialized')
  
  db.run(`
    INSERT OR REPLACE INTO branches 
    (repo_id, name, is_default, last_commit_date, commit_count)
    VALUES (?, ?, ?, ?, ?)
  `, [
    branch.repoId,
    branch.name,
    branch.isDefault ? 1 : 0,
    branch.lastCommitDate || null,
    branch.commitCount || 0
  ])
}

export function setMetadata(key: string, value: string): void {
  if (!db) throw new Error('Database not initialized')
  
  db.run(`
    INSERT OR REPLACE INTO metadata (key, value)
    VALUES (?, ?)
  `, [key, value])
}

export function getMetadata(key: string): string | null {
  if (!db) throw new Error('Database not initialized')
  
  const result = db.exec(`
    SELECT value FROM metadata WHERE key = ?
  `, [key])
  
  if (result[0] && result[0].values.length > 0) {
    return result[0].values[0][0] as string
  }
  return null
}
