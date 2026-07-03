/**
 * Delete blank analytics records and re-import properly
 */

import { supabaseAdmin } from './server/supabase';
import { callAnalyticsScheduler } from './server/call-analytics-scheduler';

async function deleteBlankAnalytics() {
  console.log('🗑️ Deleting blank analytics records...\n');

  // Delete records that have no transcript, no recording_url, and no call_score
  let deleted = 0;
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: batch, error: fetchError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .select('id, transcript, recording_url, call_score, analysis_status')
      .or('transcript.is.null,recording_url.is.null,call_score.is.null')
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('❌ Error fetching analytics:', fetchError);
      break;
    }

    if (!batch || batch.length === 0) {
      hasMore = false;
      break;
    }

    // Filter to only truly blank records (no transcript, no recording, no score, status not completed)
    const blankRecords = batch.filter(a => 
      (!a.transcript || a.transcript.trim() === '') &&
      (!a.recording_url || a.recording_url === 'PENDING') &&
      (!a.call_score || a.call_score === 0) &&
      a.analysis_status !== 'completed'
    );

    if (blankRecords.length === 0) {
      hasMore = false;
      break;
    }

    const ids = blankRecords.map(a => a.id);
    
    const { error: deleteError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error(`❌ Error deleting analytics batch:`, deleteError);
      break;
    }

    deleted += blankRecords.length;
    console.log(`✅ Deleted ${blankRecords.length} blank analytics entries (total: ${deleted})`);

    if (batch.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }

  console.log(`\n✅ Deleted ${deleted} blank taalk_call_analytics entries\n`);
}

async function reimportFromBillingTransactions() {
  console.log('📥 Re-importing from billing_transactions...\n');

  // Get all billing_transactions with type='connect' that don't have analytics
  const { data: transactions, error } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .eq('transaction_type', 'connect')
    .not('metadata', 'is', null)
    .order('transaction_date', { ascending: false })
    .limit(2000);

  if (error) {
    console.error('❌ Error fetching billing_transactions:', error);
    return;
  }

  console.log(`📊 Found ${transactions?.length || 0} billing transactions to process\n`);

  const scheduler = callAnalyticsScheduler as any;
  let processed = 0;
  let failed = 0;

  for (const transaction of transactions || []) {
    try {
      // Check if analytics already exists
      const { data: existing } = await supabaseAdmin
        .from('taalk_call_analytics')
        .select('id, transcript, recording_url, call_score')
        .eq('billing_transaction_id', transaction.transaction_id)
        .maybeSingle();

      // Skip if already has complete data
      if (existing && existing.transcript && existing.recording_url && existing.call_score) {
        continue;
      }

      console.log(`🔍 Processing: ${transaction.transaction_id} - ${transaction.lead_name || 'N/A'}`);
      
      await scheduler.analyzeCall(transaction);
      
      processed++;
      console.log(`   ✅ Successfully processed\n`);
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}\n`);
      failed++;
    }
  }

  console.log(`\n✅ Re-import complete: ${processed} succeeded, ${failed} failed`);
}

async function main() {
  await deleteBlankAnalytics();
  await reimportFromBillingTransactions();
}

main().catch(console.error);
