/**
 * Reset call analytics (delete taalk_call_analytics only) and backfill 5 calls.
 * Does NOT delete billing_transactions - only analytics so we can re-download and re-analyze.
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function resetAndBackfill5() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  console.log('🗑️ RESET: Deleting ALL taalk_call_analytics (keeping billing_transactions)...\n');

  try {
    let analyticsDeleted = 0;
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: fetchError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id')
        .range(offset, offset + batchSize - 1);

      if (fetchError) {
        console.error('❌ Error fetching analytics:', fetchError);
        break;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      const ids = batch.map((a: { id: number }) => a.id);
      const { error: deleteError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('❌ Error deleting analytics batch:', deleteError);
        break;
      }

      analyticsDeleted += batch.length;
      console.log(`   Deleted ${batch.length} (total: ${analyticsDeleted})`);

      if (batch.length < batchSize) hasMore = false;
      else offset += batchSize;
    }

    console.log(`\n✅ Deleted ${analyticsDeleted} taalk_call_analytics records\n`);
    console.log('🔄 Backfilling 5 calls (scheduler batchSize=5)...\n');

    await callAnalyticsScheduler.processPendingCalls(7);

    console.log('\n✅ Reset and backfill (5 calls) complete.');
  } catch (error: any) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

resetAndBackfill5();
