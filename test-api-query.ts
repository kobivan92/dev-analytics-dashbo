import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data', 'devmetrics.sqlite');

async function testAPIQuery() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  const daysParam = 365;

  // This is the exact query from the API
  const activityResult = db.exec(`
    SELECT 
      date(c.timestamp) as date,
      COUNT(*) as commits
    FROM commits c
    WHERE date(c.timestamp) >= date('now', '-' || ? || ' day')
    GROUP BY date(c.timestamp)
    ORDER BY date(c.timestamp)
  `, [daysParam]);

  const activity = activityResult[0]
    ? activityResult[0].values.map((r: any) => ({
        date: r[0],
        commits: r[1],
      }))
    : [];

  console.log(`📊 Total data points returned: ${activity.length}`);
  console.log(`First date: ${activity[0]?.date}, commits: ${activity[0]?.commits}`);
  console.log(`Last date: ${activity[activity.length - 1]?.date}, commits: ${activity[activity.length - 1]?.commits}`);
  
  console.log('\n📈 First 10 entries:');
  activity.slice(0, 10).forEach(a => console.log(`  ${a.date}: ${a.commits}`));
  
  console.log('\n📈 Last 10 entries:');
  activity.slice(-10).forEach(a => console.log(`  ${a.date}: ${a.commits}`));

  // Check what date('now') is returning
  const nowResult = db.exec(`SELECT date('now') as today, date('now', '-365 day') as year_ago`);
  console.log('\n🕐 Date calculations:');
  console.log(`Today: ${nowResult[0].values[0][0]}`);
  console.log(`365 days ago: ${nowResult[0].values[0][1]}`);

  db.close();
}

testAPIQuery().catch(console.error);
