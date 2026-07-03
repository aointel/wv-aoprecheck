/**
 * Check where Taalk call ID might be stored in vdp_calls
 */

import { supabaseAdmin } from './server/supabase';

async function checkCallId() {
  console.log('🔍 Checking where Taalk call ID is stored...\n');

  // Get a recent call with END event
  const { data: calls, error } = await supabaseAdmin
    .from('vdp_calls')
    .select('id, event, querystring, task, phone, agent')
    .eq('event', 'END')
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!calls || calls.length === 0) {
    console.log('⚠️ No END events found');
    return;
  }

  console.log(`✅ Found ${calls.length} END events\n`);

  calls.forEach((call, i) => {
    console.log(`Call ${i + 1} (ID: ${call.id}):`);
    console.log(`  querystring:`, JSON.stringify(call.querystring, null, 2));
    console.log(`  task:`, JSON.stringify(call.task, null, 2));
    console.log('');
  });

  // Also check billing_transactions to see what source_id we're looking for
  const { data: txn } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, source_id')
    .eq('transaction_type', 'connect')
    .limit(1)
    .single();

  if (txn) {
    console.log(`\n📊 Sample billing transaction:`);
    console.log(`  Transaction ID: ${txn.transaction_id}`);
    console.log(`  Source ID: ${txn.source_id}`);
    
    // Try to find this vdp_call
    const { data: vdpCall } = await supabaseAdmin
      .from('vdp_calls')
      .select('id, event, querystring, task')
      .eq('id', txn.source_id)
      .maybeSingle();
    
    if (vdpCall) {
      console.log(`\n✅ Found matching vdp_call:`);
      console.log(`  ID: ${vdpCall.id}, Event: ${vdpCall.event}`);
      console.log(`  querystring:`, JSON.stringify(vdpCall.querystring, null, 2));
      console.log(`  task:`, JSON.stringify(vdpCall.task, null, 2));
    } else {
      console.log(`\n❌ Could not find vdp_call with id=${txn.source_id}`);
    }
  }

  process.exit(0);
}

checkCallId().catch(console.error);
