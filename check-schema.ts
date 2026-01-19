import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'data', 'devmetrics.sqlite');

async function checkSchema() {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  const schema = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='commits'`);
  console.log('📋 Commits table schema:');
  console.log(schema[0]?.values[0]?.[0] || 'Table not found');

  const sample = db.exec(`SELECT * FROM commits LIMIT 3`);
  console.log('\n📊 Sample data:');
  console.log('Columns:', sample[0]?.columns);
  console.log('Values:', sample[0]?.values);

  db.close();
}

checkSchema().catch(console.error);
