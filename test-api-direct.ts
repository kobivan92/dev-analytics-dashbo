import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function test() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'data', 'devmetrics.sqlite');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('=== Testing Team Activity API Query ===\n');
  
  // Test with 365 days (1 year)
  const days = 365;
  const activityResult = db.exec(`
    SELECT 
      date(c.timestamp) as date,
      COUNT(*) as commits
    FROM commits c
    WHERE date(c.timestamp) >= date('now', '-' || ? || ' day')
    GROUP BY date(c.timestamp)
    ORDER BY date(c.timestamp)
  `, [days]);
  
  if (activityResult[0]) {
    const activity = activityResult[0].values.map((r: any) => ({
      date: r[0],
      commits: r[1],
    }));
    
    console.log(`Total data points: ${activity.length}`);
    console.log(`First 5 dates:`);
    activity.slice(0, 5).forEach((a: any) => {
      console.log(`  ${a.date}: ${a.commits} commits`);
    });
    console.log(`\nLast 5 dates:`);
    activity.slice(-5).forEach((a: any) => {
      console.log(`  ${a.date}: ${a.commits} commits`);
    });
    
    // Check total commits
    const total = activity.reduce((sum: number, a: any) => sum + a.commits, 0);
    console.log(`\nTotal commits in last ${days} days: ${total}`);
  }
  
  db.close();
}

test().catch(console.error);
