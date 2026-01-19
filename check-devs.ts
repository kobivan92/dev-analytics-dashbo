import Database from 'sql.js';
import { readFileSync } from 'fs';

(async () => {
  const SQL = await Database();
  const buffer = readFileSync('/home/kobivan/dev-analytics-dashbo/data/devmetrics.sqlite');
  const db = new SQL.Database(buffer);

  const result = db.exec(`
    SELECT d.name, d.email, COUNT(DISTINCT rc.commit_hash) as commits
    FROM developers d
    LEFT JOIN repo_commits rc ON d.id = rc.developer_id
    GROUP BY d.id
    ORDER BY commits DESC
  `);

  console.log('All developers who committed in the last 365 days:\n');
  result[0]?.values.forEach(row => {
    console.log(`${row[0]}: ${row[2]} commits - ${row[1]}`);
  });

  const totalDevs = result[0]?.values.length || 0;
  const totalCommits = result[0]?.values.reduce((sum, row) => sum + Number(row[2]), 0) || 0;
  console.log(`\nTotal: ${totalDevs} developers, ${totalCommits} commits`);
})();
