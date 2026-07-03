/**
 * Delete all pending/unanalyzed transfer calls from billing_transactions
 * These are calls that don't have analysis and the user wants removed
 */

import { supabaseAdmin } from './server/supabase';

async function deletePendingTransfers() {
  console.log('🗑️ Deleting pending/unanalyzed transfer calls...\n');

  try {
    // Get all billing_transactions that are 'connect' type from 'vdp_calls' (with pagination)
    let allConnects: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: connectsError } = await supabaseAdmin
        .from('billing_transactions')
        .select('transaction_id, transaction_type, source_table, transaction_date')
        .eq('transaction_type', 'connect')
        .eq('source_table', 'vdp_calls')
        .range(offset, offset + batchSize - 1);

      if (connectsError) {
        console.error('❌ Error fetching billing_transactions:', connectsError);
        return;
      }

      if (batch && batch.length > 0) {
        allConnects.push(...batch);
        offset += batchSize;
        if (batch.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`📊 Found ${allConnects.length} total connect transactions`);

    if (allConnects.length === 0) {
      console.log('✅ No connect transactions found');
      return;
    }

    // Get all analyzed transactions (also with pagination)
    let analyzedSet = new Set<string>();
    let analyzedOffset = 0;
    const analyzedBatchSize = 1000;
    let hasMoreAnalyzed = true;

    while (hasMoreAnalyzed) {
      const transactionIds = allConnects.map(t => t.transaction_id);
      const { data: analyzed, error: analyzedError } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('billing_transaction_id, analysis_status')
        .in('billing_transaction_id', transactionIds)
        .eq('analysis_status', 'completed')
        .range(analyzedOffset, analyzedOffset + analyzedBatchSize - 1);

      if (analyzedError) {
        console.error('❌ Error fetching analyzed transactions:', analyzedError);
        break;
      }

      if (analyzed && analyzed.length > 0) {
        analyzed.forEach(a => analyzedSet.add(a.billing_transaction_id));
        analyzedOffset += analyzedBatchSize;
        if (analyzed.length < analyzedBatchSize) {
          hasMoreAnalyzed = false;
        }
      } else {
        hasMoreAnalyzed = false;
      }
    }

    // Find unanalyzed transactions
    const unanalyzed = allConnects.filter(t => !analyzedSet.has(t.transaction_id));

    console.log(`📊 Analyzed: ${analyzedSet.size}`);
    console.log(`📊 Unanalyzed: ${unanalyzed.length}\n`);

    if (unanalyzed.length === 0) {
      console.log('✅ No unanalyzed transactions to delete');
      return;
    }

    // Delete unanalyzed transactions
    const unanalyzedIds = unanalyzed.map(t => t.transaction_id);
    
    console.log(`🗑️ Deleting ${unanalyzedIds.length} unanalyzed transactions...\n`);

    // Delete in batches of 100
    for (let i = 0; i < unanalyzedIds.length; i += 100) {
      const batch = unanalyzedIds.slice(i, i + 100);
      const { error: deleteError } = await supabaseAdmin
        .from('billing_transactions')
        .delete()
        .in('transaction_id', batch);

      if (deleteError) {
        console.error(`❌ Error deleting batch ${Math.floor(i/100) + 1}:`, deleteError);
      } else {
        console.log(`✅ Deleted batch ${Math.floor(i/100) + 1} (${batch.length} transactions)`);
      }
    }

    // Also delete any corresponding taalk_call_analytics entries that are pending/failed/analyzing
    // Do this in batches to avoid URI too large errors
    let analyticsDeleted = 0;
    for (let i = 0; i < unanalyzedIds.length; i += 500) {
      const batch = unanalyzedIds.slice(i, i + 500);
      const { data: pendingAnalytics } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id, billing_transaction_id, analysis_status')
        .in('billing_transaction_id', batch)
        .in('analysis_status', ['pending', 'failed', 'analyzing']);

      if (pendingAnalytics && pendingAnalytics.length > 0) {
        const pendingIds = pendingAnalytics.map(a => a.id);
        
        const { error: analyticsDeleteError } = await supabaseAdmin
          .from('taalk_call_analytics')
          .delete()
          .in('id', pendingIds);

        if (analyticsDeleteError) {
          console.error(`❌ Error deleting analytics batch ${Math.floor(i/500) + 1}:`, analyticsDeleteError);
        } else {
          analyticsDeleted += pendingIds.length;
        }
      }
    }

    if (analyticsDeleted > 0) {
      console.log(`\n✅ Deleted ${analyticsDeleted} pending analytics entries`);
    }

    console.log(`\n✅ Cleanup complete! Deleted ${unanalyzedIds.length} unanalyzed transactions`);

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

deletePendingTransfers();
