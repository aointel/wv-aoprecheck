/**
 * Force delete ALL transfer calls - no exceptions
 */

import { supabaseAdmin } from './server/supabase';

async function deleteAllTransfersForce() {
  console.log('🗑️ FORCE DELETING ALL TRANSFER CALLS...\n');

  try {
    // Delete ALL billing_transactions that are 'connect' type from 'vdp_calls' - NO LIMITS
    console.log('Step 1: Deleting ALL billing_transactions (connect type, vdp_calls source)...\n');
    
    let totalDeleted = 0;
    let iterations = 0;
    const maxIterations = 1000; // Safety limit
    
    while (iterations < maxIterations) {
      // Get a batch
      const { data: batch, error: fetchError } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id')
        .eq('transaction_type', 'connect')
        .eq('source_table', 'vdp_calls')
        .limit(1000);

      if (fetchError) {
        console.error('❌ Error fetching:', fetchError);
        break;
      }

      if (!batch || batch.length === 0) {
        console.log('✅ No more transactions to delete');
        break;
      }

      const transactionIds = batch.map(t => t.transaction_id);
      
      const { error: deleteError } = await supabaseAdmin
        .from('billing_transactions')
        .delete()
        .in('transaction_id', transactionIds);

      if (deleteError) {
        console.error(`❌ Error deleting:`, deleteError);
        break;
      }

      totalDeleted += batch.length;
      iterations++;
      console.log(`✅ Batch ${iterations}: Deleted ${batch.length} transactions (total: ${totalDeleted})`);

      if (batch.length < 1000) {
        break;
      }
    }

    console.log(`\n✅ Deleted ${totalDeleted} billing_transactions\n`);

    // Delete ALL taalk_call_analytics - NO LIMITS
    console.log('Step 2: Deleting ALL taalk_call_analytics...\n');
    
    let analyticsDeleted = 0;
    iterations = 0;

    while (iterations < maxIterations) {
      const { data: batch, error: fetchError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id')
        .limit(1000);

      if (fetchError) {
        console.error('❌ Error fetching analytics:', fetchError);
        break;
      }

      if (!batch || batch.length === 0) {
        console.log('✅ No more analytics to delete');
        break;
      }

      const ids = batch.map(a => a.id);
      
      const { error: deleteError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error(`❌ Error deleting analytics:`, deleteError);
        break;
      }

      analyticsDeleted += batch.length;
      iterations++;
      console.log(`✅ Batch ${iterations}: Deleted ${batch.length} analytics (total: ${analyticsDeleted})`);

      if (batch.length < 1000) {
        break;
      }
    }

    console.log(`\n✅ Deleted ${analyticsDeleted} taalk_call_analytics entries`);
    console.log(`\n✅ TOTAL DELETED: ${totalDeleted} transactions + ${analyticsDeleted} analytics = ${totalDeleted + analyticsDeleted} total records`);

    // Verify deletion
    console.log('\n🔍 Verifying deletion...\n');
    
    const { count: remainingTransactions } = await supabaseAdmin
      .from('billing_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'connect')
      .eq('source_table', 'vdp_calls');

    const { count: remainingAnalytics } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Remaining billing_transactions (connect/vdp_calls): ${remainingTransactions || 0}`);
    console.log(`📊 Remaining taalk_call_analytics: ${remainingAnalytics || 0}`);

  } catch (error: any) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

deleteAllTransfersForce();
