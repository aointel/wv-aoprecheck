/**
 * Runner script to execute call log backfill
 */
import { backfillCallsFromDatabase, backfillCallsFromTwilio } from './server/backfill-call-log-from-twilio.js';

const args = process.argv.slice(2);
const source = args[0] || 'database'; // 'database' or 'twilio'
const startDateStr = args[1];
const endDateStr = args[2];

const startDate = startDateStr ? new Date(startDateStr) : undefined;
const endDate = endDateStr ? new Date(endDateStr) : undefined;

console.log(`🚀 Starting call log backfill...`);
console.log(`📋 Source: ${source}`);
console.log(`📅 Start date: ${startDate?.toISOString() || 'all'}`);
console.log(`📅 End date: ${endDate?.toISOString() || 'all'}`);
console.log('');

if (source === 'twilio') {
  backfillCallsFromTwilio(startDate, endDate, 10000)
    .then((result) => {
      console.log('');
      console.log('✅ Backfill complete!');
      console.log(`   Processed: ${result.processed}`);
      console.log(`   Skipped: ${result.skipped}`);
      console.log(`   Errors: ${result.errors}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backfill failed:', error);
      process.exit(1);
    });
} else {
  backfillCallsFromDatabase(startDate, endDate)
    .then((result) => {
      console.log('');
      console.log('✅ Backfill complete!');
      console.log(`   Processed: ${result.processed}`);
      console.log(`   Skipped: ${result.skipped}`);
      console.log(`   Errors: ${result.errors}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backfill failed:', error);
      process.exit(1);
    });
}




