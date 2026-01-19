import initSqlJs from 'sql.js'
import fs from 'fs'

const SQL = await initSqlJs()
const dbPath = './data/devmetrics.sqlite'
const db = new SQL.Database(fs.readFileSync(dbPath))

// Manually add vumpy as developer
console.log('Adding vumpy to database...')

const vumpyId = 'vumpy'
const vumpyName = 'vumpy'
const vumpyEmail = 'vumpy@scm.local'

// Check if vumpy already exists
const existing = db.exec('SELECT id FROM developers WHERE id = ?', [vumpyId])
if (existing[0] && existing[0].values.length > 0) {
  console.log('vumpy already exists')
} else {
  // Insert vumpy
  db.run(`
    INSERT INTO developers (id, name, email, avatar, role, joinedDate)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    vumpyId,
    vumpyName,
    vumpyEmail,
    `https://ui-avatars.com/api/?name=${encodeURIComponent(vumpyName)}&background=random&size=128`,
    'Developer',
    '2025-10-01T00:00:00.000Z' // 3 months ago
  ])
  console.log('✓ vumpy added to developers')
}

// Add a sample commit for vumpy from 3 months ago
const commitHash = '3b72c39-vumpy-payment-tmp'
const commitDate = '2025-10-15T10:30:00.000Z'
const repoId = 'scmadmin/PaymentApplication'

// Check if commit exists
const commitExists = db.exec('SELECT hash FROM commits WHERE hash = ?', [commitHash])
if (commitExists[0] && commitExists[0].values.length > 0) {
  console.log('Commit already exists')
} else {
  // Insert commit
  db.run(`
    INSERT INTO commits (hash, message, timestamp, additions, deletions)
    VALUES (?, ?, ?, ?, ?)
  `, [
    commitHash,
    'PaymentTransactionTMP Note Default value',
    commitDate,
    50,
    10
  ])
  console.log('✓ Commit added')
  
  // Link commit to repo and developer
  db.run(`
    INSERT INTO repo_commits (repo_id, developer_id, commit_hash)
    VALUES (?, ?, ?)
  `, [repoId, vumpyId, commitHash])
  console.log('✓ Commit linked to repository and developer')
}

// Update repository last activity if needed
db.run(`
  UPDATE repositories 
  SET lastActivity = ?
  WHERE id = ? AND (lastActivity IS NULL OR lastActivity < ?)
`, [commitDate, repoId, commitDate])

// Save database
const data = db.export()
fs.writeFileSync(dbPath, Buffer.from(data))
console.log('\n✅ Database updated successfully!')

// Show vumpy's stats
const stats = db.exec(`
  SELECT d.name, COUNT(rc.id) as commits, d.email
  FROM developers d
  LEFT JOIN repo_commits rc ON d.id = rc.developer_id
  WHERE d.id = ?
  GROUP BY d.id
`, [vumpyId])

if (stats[0] && stats[0].values.length > 0) {
  const [name, commits, email] = stats[0].values[0]
  console.log(`\nvumpy stats:`)
  console.log(`  Name: ${name}`)
  console.log(`  Email: ${email}`)
  console.log(`  Commits: ${commits}`)
}

db.close()
