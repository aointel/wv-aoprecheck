/**
 * Pull and analyze 5 calls (uses scheduler batchSize=5).
 */

import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function run() {
  console.log('🔄 Pulling and analyzing 5 calls...\n');
  await callAnalyticsScheduler.processPendingCalls(7);
  console.log('\n✅ Done.');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
