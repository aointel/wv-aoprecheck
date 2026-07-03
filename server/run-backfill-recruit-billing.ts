/**
 * Backfill all AO Recruit billing_transactions:
 * 1) Per candidate (recruit_candidates) - transaction_id recruit-{id}
 * 2) Per connection/call (vdp_calls market aorecruit) - transaction_id recruit-call-{id}
 * Use: npm run backfill-recruit-billing
 * Optional: pass start and end date as args (ISO strings) to limit range.
 */

import { billingTransactionBackfill } from './backfill-billing-transactions';

const args = process.argv.slice(2);
const startDateStr = args[0];
const endDateStr = args[1];
const startDate = startDateStr ? new Date(startDateStr) : undefined;
const endDate = endDateStr ? new Date(endDateStr) : undefined;

console.log('🚀 Backfilling AO Recruit billing (candidates + connections)...');
console.log(`📅 Start: ${startDate?.toISOString() ?? 'all time'}`);
console.log(`📅 End: ${endDate?.toISOString() ?? 'all time'}`);
console.log('');

Promise.all([
  billingTransactionBackfill.backfillRecruitTransactions(startDate, endDate),
  billingTransactionBackfill.backfillRecruitConnectionsFromVdpCalls(startDate, endDate),
])
  .then(([r1, r2]) => {
    console.log('');
    console.log('✅ AO Recruit backfill complete.');
    console.log(`   Candidates: ${r1.processed} new, ${r1.skipped} already billed`);
    console.log(`   Connections (calls): ${r2.processed} new, ${r2.skipped} already billed`);
    console.log(`   Total new: ${r1.processed + r2.processed}`);
    const totalErrors = r1.errors + r2.errors;
    if (totalErrors > 0) console.log(`   Errors: ${totalErrors}`);
    process.exit(totalErrors > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  });
