import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const csvContent = readFileSync('/home/kobivan/dev-analytics-dashbo/Issue tracker list (1).csv', 'utf-8');

// Check for BOM
console.log('First 10 bytes:', csvContent.substring(0, 10).split('').map(c => c.charCodeAt(0)));

const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true, bom: true });
const record = records[0];

console.log('\nAll keys and values:');
Object.keys(record).forEach(key => {
  console.log(`  "${key}": ${JSON.stringify(record[key])}`);
});
