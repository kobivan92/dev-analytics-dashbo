import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

async function test() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'data', 'devmetrics.sqlite');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Test different time ranges
  const timeRanges = [7, 30, 90, 180, 365];

  console.log('=== TEAM COMMIT ACTIVITY TEST ===\n');

  for (const days of timeRanges) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    
    const results = db.exec(`
      SELECT 
        date(timestamp) as date,
        COUNT(*) as commits
      FROM commits
      WHERE date(timestamp) >= date('${dateThreshold.toISOString()}')
      GROUP BY date(timestamp)
      ORDER BY date(timestamp)
    `);

    const totalCommits = db.exec(`
      SELECT COUNT(*) as total
      FROM commits
      WHERE date(timestamp) >= date('${dateThreshold.toISOString()}')
    `);

    const total = totalCommits[0]?.values[0]?.[0] || 0;
    const dataPoints = results[0]?.values.length || 0;

    console.log(`${days} Days:`);
    console.log(`  Total commits: ${total}`);
    console.log(`  Data points: ${dataPoints}`);
    
    if (results[0]?.values.length > 0) {
      const firstDate = results[0].values[0][0];
      const lastDate = results[0].values[results[0].values.length - 1][0];
      console.log(`  Date range: ${firstDate} to ${lastDate}`);
    }
    console.log();
  }

  // Check overall data distribution
  console.log('=== OVERALL DATA DISTRIBUTION ===\n');
  const allData = db.exec(`
    SELECT 
      strftime('%Y-%m', timestamp) as month,
      COUNT(*) as commits
    FROM commits
    GROUP BY strftime('%Y-%m', timestamp)
    ORDER BY month
  `);

  if (allData[0]) {
    console.log('Commits by month:');
    allData[0].values.forEach(([month, count]) => {
      console.log(`  ${month}: ${count} commits`);
    });
  }
  
  db.close();
}

test().catch(console.error);
