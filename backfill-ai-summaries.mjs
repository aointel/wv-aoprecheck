/**
 * Quick backfill script for missing AI summaries
 * Runs the comprehensive backfill script
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🚀 Starting AI Summary Backfill...\n');
console.log('This will process all verification sessions with missing AI summaries.\n');
console.log('The script will:');
console.log('  - Find all sessions with taalk_call_id');
console.log('  - Check for missing or "PENDING" summaries');
console.log('  - Fetch summaries from Taalk API');
console.log('  - Update the database\n');

try {
  console.log('📊 Running backfill script...\n');
  const { stdout, stderr } = await execAsync('npx tsx server/backfill-all-transcripts.ts', {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  });
  
  console.log(stdout);
  if (stderr) {
    console.error('Warnings:', stderr);
  }
  
  console.log('\n✅ Backfill completed successfully!');
} catch (error) {
  console.error('❌ Error running backfill:', error.message);
  if (error.stdout) console.log('Output:', error.stdout);
  if (error.stderr) console.error('Errors:', error.stderr);
  process.exit(1);
}
