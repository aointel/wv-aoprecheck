/**
 * Re-analyze all screenshots with new lenient validation rules
 * This will re-process all screenshots that were previously analyzed
 * with the old strict rules and re-validate them with the new lenient rules
 * (2 people + video call = valid)
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔄 Re-analyzing ALL screenshots with new lenient validation rules...\n');
console.log('This will:');
console.log('  - Find all sessions with screenshots');
console.log('  - Re-analyze them with the new validation (2 people + video call = valid)');
console.log('  - Update the database with corrected validation results\n');
console.log('⚠️  This may take a while depending on the number of screenshots...\n');

try {
  console.log('📊 Running screenshot re-analysis with --force flag...\n');
  const { stdout, stderr } = await execAsync('npx tsx server/backfill-screenshot-summaries.ts --force', {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
  });
  
  console.log(stdout);
  if (stderr) {
    console.error('Warnings:', stderr);
  }
  
  console.log('\n✅ Screenshot re-analysis completed successfully!');
  console.log('All screenshots have been re-validated with the new lenient rules.');
} catch (error) {
  console.error('❌ Error running re-analysis:', error.message);
  if (error.stdout) console.log('Output:', error.stdout);
  if (error.stderr) console.error('Errors:', error.stderr);
  process.exit(1);
}
