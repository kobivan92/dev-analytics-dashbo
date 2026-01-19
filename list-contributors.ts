import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

const SQL = await initSqlJs()
const dbPath = path.resolve(process.cwd(), 'data/devmetrics.sqlite')

if (!fs.existsSync(dbPath)) {
  console.log('Database not found at:', dbPath)
  process.exit(0)
}

const buffer = fs.readFileSync(dbPath)
const db = new SQL.Database(buffer)

const result = db.exec(`
  SELECT 
    d.id,
    d.name,
    d.email,
    d.role,
    d.joinedDate,
    COUNT(DISTINCT rc.repo_id) as activeRepos,
    COUNT(rc.id) as totalCommits
  FROM developers d
  LEFT JOIN repo_commits rc ON d.id = rc.developer_id
  GROUP BY d.id
  ORDER BY totalCommits DESC
`)

if (result[0] && result[0].values.length > 0) {
  console.log('\n=== CONTRIBUTORS/INDIVIDUALS ===\n')
  console.log('Total:', result[0].values.length, 'developers\n')
  
  result[0].values.forEach((row: any, idx: number) => {
    console.log(`${idx + 1}. ${row[1]}`)
    console.log(`   Email: ${row[2]}`)
    console.log(`   Role: ${row[3]}`)
    console.log(`   Joined: ${new Date(row[4]).toLocaleDateString()}`)
    console.log(`   Active Repos: ${row[5]}`)
    console.log(`   Total Commits: ${row[6]}`)
    console.log('')
  })
} else {
  console.log('No developers found in database')
}

db.close()
