import Database from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';

(async () => {
  const SQL = await Database();
  const buffer = readFileSync('/home/kobivan/dev-analytics-dashbo/data/devmetrics.sqlite');
  const db = new SQL.Database(buffer);

  console.log('Merging and renaming developers...\n');

  // Create developer_aliases table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS developer_aliases (
      developer_id TEXT PRIMARY KEY,
      custom_name TEXT NOT NULL
    )
  `);

  // 1. Merge =Ilia Lomsadze into Ilia, rename to "Ilia Lomsadze"
  console.log('1. Merging =Ilia Lomsadze into Ilia...');
  db.run(`UPDATE repo_commits SET developer_id = 'Ilia' WHERE developer_id = '=Ilia Lomsadze'`);
  db.run(`DELETE FROM developers WHERE id = '=Ilia Lomsadze'`);
  db.run(`UPDATE developers SET name = 'Ilia Lomsadze' WHERE id = 'Ilia'`);
  db.run(`INSERT OR REPLACE INTO developer_aliases (developer_id, custom_name) VALUES ('Ilia', 'Ilia Lomsadze')`);
  console.log('   ✓ Merged =Ilia Lomsadze → Ilia Lomsadze');

  // 2. Merge vumpy, gchutlashvili, GChutlashvili into "Giorgi Chutlashvili"
  console.log('\n2. Merging vumpy, gchutlashvili, GChutlashvili...');
  // Use gchutlashvili as the primary ID (has telmico.ge email)
  db.run(`UPDATE repo_commits SET developer_id = 'gchutlashvili' WHERE developer_id = 'vumpy'`);
  db.run(`UPDATE repo_commits SET developer_id = 'gchutlashvili' WHERE developer_id = 'GChutlashvili'`);
  db.run(`DELETE FROM developers WHERE id = 'vumpy'`);
  db.run(`DELETE FROM developers WHERE id = 'GChutlashvili'`);
  db.run(`UPDATE developers SET name = 'Giorgi Chutlashvili' WHERE id = 'gchutlashvili'`);
  db.run(`INSERT OR REPLACE INTO developer_aliases (developer_id, custom_name) VALUES ('gchutlashvili', 'Giorgi Chutlashvili')`);
  console.log('   ✓ Merged vumpy, GChutlashvili → Giorgi Chutlashvili');

  // 3. Rename kobivan to "Ivan Kobiakov"
  console.log('\n3. Renaming kobivan...');
  db.run(`UPDATE developers SET name = 'Ivan Kobiakov' WHERE id = 'kobivan'`);
  db.run(`INSERT OR REPLACE INTO developer_aliases (developer_id, custom_name) VALUES ('kobivan', 'Ivan Kobiakov')`);
  console.log('   ✓ Renamed kobivan → Ivan Kobiakov');

  // 4. Rename grammaton88 to "Misha Kakabadze"
  console.log('\n4. Renaming grammaton88...');
  db.run(`UPDATE developers SET name = 'Misha Kakabadze' WHERE id = 'grammaton88'`);
  db.run(`INSERT OR REPLACE INTO developer_aliases (developer_id, custom_name) VALUES ('grammaton88', 'Misha Kakabadze')`);
  console.log('   ✓ Renamed grammaton88 → Misha Kakabadze');

  // 5. Rename abezhitashvili to "Aleksandre Bezhitashvili"
  console.log('\n5. Renaming abezhitashvili...');
  db.run(`UPDATE developers SET name = 'Aleksandre Bezhitashvili' WHERE id = 'abezhitashvili'`);
  db.run(`INSERT OR REPLACE INTO developer_aliases (developer_id, custom_name) VALUES ('abezhitashvili', 'Aleksandre Bezhitashvili')`);
  console.log('   ✓ Renamed abezhitashvili → Aleksandre Bezhitashvili');

  // Show final results
  console.log('\n─────────────────────────────────────────────────');
  console.log('Final developer list:\n');
  const result = db.exec(`
    SELECT d.name, d.email, COUNT(DISTINCT rc.commit_hash) as commits
    FROM developers d
    LEFT JOIN repo_commits rc ON d.id = rc.developer_id
    GROUP BY d.id
    ORDER BY commits DESC
  `);

  result[0]?.values.forEach(row => {
    console.log(`${row[0]}: ${row[2]} commits - ${row[1]}`);
  });

  const totalDevs = result[0]?.values.length || 0;
  const totalCommits = result[0]?.values.reduce((sum, row) => sum + Number(row[2]), 0) || 0;
  console.log(`\nTotal: ${totalDevs} developers, ${totalCommits} commits`);

  // Save the updated database
  const data = db.export();
  writeFileSync('/home/kobivan/dev-analytics-dashbo/data/devmetrics.sqlite', data);
  console.log('\n✅ Database updated successfully!');
})();
