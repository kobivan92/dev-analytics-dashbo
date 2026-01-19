import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function test() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'data', 'devmetrics.sqlite');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('=== MONTHLY DISTRIBUTION (Last 365 Days) ===\n');
  
  // Get monthly distribution for last 365 days
  const monthlyResult = db.exec(`
    SELECT 
      strftime('%Y-%m', c.timestamp) as month,
      COUNT(*) as commits
    FROM commits c
    WHERE date(c.timestamp) >= date('now', '-365 day')
    GROUP BY strftime('%Y-%m', c.timestamp)
    ORDER BY month
  `);
  
  if (monthlyResult[0]) {
    let total = 0;
    monthlyResult[0].values.forEach(([month, commits]) => {
      console.log(`${month}: ${commits} commits`);
      total += commits as number;
    });
    console.log(`\nTotal: ${total} commits`);
  }
  
  db.close();
}

test().catch(console.error);
