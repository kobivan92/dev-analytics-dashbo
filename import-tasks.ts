import Database from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

(async () => {
  const SQL = await Database();
  const dbPath = '/home/kobivan/dev-analytics-dashbo/data/devmetrics.sqlite';
  const buffer = readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log('Creating tasks table...\n');

  // Create tasks table
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT CHECK(priority IN ('Low', 'Normal', 'High', 'Critical')),
      status TEXT CHECK(status IN ('New', 'In progress', 'Completed', 'Blocked')),
      assigned_to TEXT,
      issued_by TEXT,
      start_date TEXT,
      deadline TEXT,
      stage TEXT,
      resolution_time_hours INTEGER,
      related_issue TEXT,
      parent_task_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  console.log('✓ Tasks table created');

  // Read CSV file
  console.log('\nReading CSV file...');
  const csvPath = '/home/kobivan/dev-analytics-dashbo/Issue tracker list (1).csv';
  const csvContent = readFileSync(csvPath, 'utf-8');
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true  // Handle UTF-8 BOM
  });

  console.log(`Found ${records.length} tasks in CSV\n`);

  // Import tasks
  let imported = 0;
  let skipped = 0;

  for (const record of records) {
    const title = record['Issue'];
    if (!title || title.trim() === '') {
      skipped++;
      continue;
    }

    const description = record['Issue description'] || '';
    const priority = record['Priority'] || 'Normal';
    const status = record['Status'] || 'New';
    const assignedTo = record['Assigned to'] || null;
    const issuedBy = record['Issued by'] || null;
    const startDate = record['Start date'] || null;
    const deadline = record['Deadline'] || null;
    const stage = record['Stage'] || null;
    const resolutionTimeStr = record['Resolution time (in hours)'];
    const resolutionTime = resolutionTimeStr && !isNaN(parseInt(resolutionTimeStr)) ? parseInt(resolutionTimeStr) : null;
    const relatedIssue = record['Related issue'] || null;

    try {
      db.run(`
        INSERT INTO tasks (
          title, description, priority, status, assigned_to, issued_by,
          start_date, deadline, stage, resolution_time_hours, related_issue
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        title,
        description,
        priority,
        status,
        assignedTo,
        issuedBy,
        startDate,
        deadline,
        stage,
        resolutionTime,
        relatedIssue
      ]);
      imported++;
      console.log(`✓ Imported: ${title}`);
    } catch (err) {
      console.error(`✗ Failed to import: ${title}`, err);
      skipped++;
    }
  }

  console.log(`\n─────────────────────────────────────────────────`);
  console.log(`Import Summary:`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total: ${records.length}`);

  // Save database
  const data = db.export();
  writeFileSync(dbPath, data);
  console.log(`\n✅ Database saved successfully!`);

  // Show task statistics
  const stats = db.exec(`
    SELECT 
      status,
      COUNT(*) as count
    FROM tasks
    GROUP BY status
    ORDER BY count DESC
  `);

  if (stats[0]) {
    console.log(`\n─────────────────────────────────────────────────`);
    console.log(`Task Statistics:`);
    stats[0].values.forEach(row => {
      console.log(`  ${row[0]}: ${row[1]} tasks`);
    });
  }
})();
