import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, 'data', 'devmetrics.sqlite');

async function checkCommitDistribution() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  // Get date range of commits
  const rangeQuery = `
    SELECT 
      MIN(date(committedDate)) as earliest,
      MAX(date(committedDate)) as latest,
      COUNT(*) as total_commits
    FROM commits
  `;
  const range = db.exec(rangeQuery);
  console.log('📊 Database commit range:');
  console.log(range[0].values[0]);

  // Get commits grouped by month for last year
  const monthlyQuery = `
    SELECT 
      strftime('%Y-%m', committedDate) as month,
      COUNT(*) as commits
    FROM commits
    WHERE committedDate >= date('now', '-365 days')
    GROUP BY month
    ORDER BY month
  `;
  const monthly = db.exec(monthlyQuery);
  console.log('\n📅 Commits by month (last 365 days):');
  if (monthly[0]) {
    monthly[0].values.forEach((row: any) => {
      console.log(`${row[0]}: ${row[1]} commits`);
    });
  }

  // Get commits grouped by week for last 365 days (like the API does)
  const weeklyQuery = `
    SELECT 
      date(committedDate, 'weekday 0', '-6 days') as week_start,
      COUNT(*) as commits
    FROM commits
    WHERE committedDate >= date('now', '-365 days')
    GROUP BY week_start
    ORDER BY week_start
  `;
  const weekly = db.exec(weeklyQuery);
  console.log(`\n📈 Weekly distribution (last 365 days): ${weekly[0]?.values.length || 0} weeks`);
  if (weekly[0] && weekly[0].values.length > 0) {
    console.log('First week:', weekly[0].values[0]);
    console.log('Last week:', weekly[0].values[weekly[0].values.length - 1]);
  }

  db.close();
}

checkCommitDistribution().catch(console.error);
