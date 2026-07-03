/**
 * Delete ALL call analytics - everything
 */

import { supabaseAdmin } from './server/supabase';

async function deleteAllCallAnalytics() {
  console.log('🗑️ Deleting ALL call analytics...\n');

  try {
    // Delete ALL billing_transactions that are 'connect' type from 'vdp_calls'
    let totalDeleted = 0;
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: fetchError } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id')
        .eq('transaction_type', 'connect')
        .eq('source_table', 'vdp_calls')
        .range(offset, offset + batchSize - 1);

      if (fetchError) {
        console.error('❌ Error fetching:', fetchError);
        break;
      }

      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }

      const transactionIds = batch.map(t => t.transaction_id);
      
      const { error: deleteError } = await supabaseAdmin
        .from('billing_transactions')
        .delete()
        .in('transaction_id', transactionIds);

      if (deleteError) {
        console.error(`❌ Error deleting batch:`, deleteError);
        break;
      }

      totalDeleted += batch.length;
      console.log(`✅ Deleted ${batch.length} transactions (total: ${totalDeleted})`);

      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`\n✅ Deleted ${totalDeleted} billing_transactions\n`);

    // Delete ALL taalk_call_analytics
    console.log('🗑️ Deleting ALL taalk_call_analytics...\n');
    
    let analyticsDeleted = 0;
    offset = 0;
    hasMore = true;

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

      const ids = batch.map(a => a.id);
      
      const { error: deleteError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error(`❌ Error deleting analytics batch:`, deleteError);
        break;
      }

      analyticsDeleted += batch.length;
      console.log(`✅ Deleted ${batch.length} analytics entries (total: ${analyticsDeleted})`);

      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
      }
    }

    console.log(`\n✅ Deleted ${analyticsDeleted} taalk_call_analytics entries`);
    console.log(`\n✅ TOTAL DELETED: ${totalDeleted} transactions + ${analyticsDeleted} analytics = ${totalDeleted + analyticsDeleted} total records`);

  } catch (error: any) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

deleteAllCallAnalytics();
