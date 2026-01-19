import initSqlJs from 'sql.js'
import fs from 'fs'

const SQL = await initSqlJs()
const db = new SQL.Database(fs.readFileSync('data/devmetrics.sqlite'))

// Check developer join dates
console.log('\nDeveloper Join Dates:')
const devResult = db.exec(`SELECT id, name, joinedDate FROM developers ORDER BY joinedDate LIMIT 5`)
if (devResult[0] && devResult[0].values.length > 0) {
  devResult[0].values.forEach((row: any) => {
    console.log(`  ${row[1]}: ${row[2]}`)
  })
}

const result = db.exec(`
  SELECT strftime('%Y-%m', c.timestamp) as month, COUNT(*) as commits 
  FROM commits c
  GROUP BY month 
  ORDER BY month
`)

console.log('\nCommit distribution by month:')
if (result[0] && result[0].values.length > 0) {
  result[0].values.forEach((row: any) => {
    console.log(`  ${row[0]}: ${row[1]} commits`)
  })
} else {
  console.log('  No data found')
}

const total = db.exec('SELECT COUNT(*) FROM commits')[0].values[0][0]
console.log(`\nTotal commits: ${total}`)
