/**
 * Runner script to execute billing transactions backfill
 */
import { billingTransactionBackfill } from './server/backfill-billing-transactions.js';

const args = process.argv.slice(2);
const type = args[0] || 'all'; // 'all', 'connect', 'precheck', or 'recruit'
const startDateStr = args[1];
const endDateStr = args[2];

const startDate = startDateStr ? new Date(startDateStr) : undefined;
const endDate = endDateStr ? new Date(endDateStr) : undefined;

console.log(`🚀 Starting billing transactions backfill...`);
console.log(`📋 Type: ${type}`);
console.log(`📅 Start date: ${startDate?.toISOString() || 'all'}`);
console.log(`📅 End date: ${endDate?.toISOString() || 'all'}`);
console.log('');

if (type === 'connect') {
  billingTransactionBackfill.backfillConnectTransactions(startDate, endDate)
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
} else if (type === 'precheck') {
  billingTransactionBackfill.backfillPrecheckTransactions(startDate, endDate)
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
} else if (type === 'recruit') {
  billingTransactionBackfill.backfillRecruitTransactions(startDate, endDate)
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
  billingTransactionBackfill.backfillAll(startDate, endDate)
    .then((result) => {
      console.log('');
      console.log('✅ Backfill complete!');
      console.log(`   Connect: ${result.connect.processed} processed, ${result.connect.skipped} skipped, ${result.connect.errors} errors`);
      console.log(`   Precheck: ${result.precheck.processed} processed, ${result.precheck.skipped} skipped, ${result.precheck.errors} errors`);
      console.log(`   Recruit: ${result.recruit.processed} processed, ${result.recruit.skipped} skipped, ${result.recruit.errors} errors`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backfill failed:', error);
      process.exit(1);
    });
}




