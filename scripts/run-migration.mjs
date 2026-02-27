// Quick script to run a migration against the app's Turso database
import { createClient } from '@libsql/client/web';
import { readFileSync } from 'fs';

const url = process.env.TURSO_DATABASE_URL?.replace(/"/g, '');
const authToken = process.env.TURSO_AUTH_TOKEN?.replace(/"/g, '');

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN');
  process.exit(1);
}

console.log('Connecting to:', url);

const client = createClient({ url, authToken });

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.mjs <migration-file>');
  process.exit(1);
}

const sql = readFileSync(migrationFile, 'utf-8');

// Use executeMultiple which handles multi-statement SQL properly
// including triggers with BEGIN...END blocks
try {
  console.log(`Running migration from ${migrationFile}...`);
  await client.executeMultiple(sql);
  console.log('Migration executed successfully!');
} catch (err) {
  console.error('Migration error:', err.message);
}

// Verify tables
const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('bank_accounts', 'bank_transactions', 'reconciliations') ORDER BY name");
console.log('\nVerification - banking tables found:');
for (const row of result.rows) {
  console.log(`  - ${row.name}`);
}

if (result.rows.length === 3) {
  console.log('\nAll 3 tables created successfully!');
} else {
  console.log(`\nWARNING: Expected 3 tables, found ${result.rows.length}`);
}
