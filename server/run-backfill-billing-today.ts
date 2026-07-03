/**
 * One-off backfill of connect billing_transactions for today only.
 * Use: npm run backfill-billing-today
 *
 * Scopes vdp_calls to start-of-day (local) through now, inserts any missing
 * connect transactions.
 */

import { billingTransactionBackfill } from './backfill-billing-transactions';

const end = new Date();
const start = new Date(end);
start.setHours(0, 0, 0, 0);

console.log('🚀 Backfilling connect billing_transactions for today only');
console.log(`📅 ${start.toISOString()} → ${end.toISOString()}`);
console.log('');

billingTransactionBackfill
  .backfillConnectTransactions(start, end)
  .then((r) => {
    console.log('');
    console.log('✅ Done.');
    console.log(`   Processed: ${r.processed}`);
    console.log(`   Skipped (already billed): ${r.skipped}`);
    console.log(`   Errors: ${r.errors}`);
    process.exit(r.errors > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  });
