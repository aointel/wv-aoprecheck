/**
 * Test querying vdp_calls to see why it's not finding records
 */

import { supabaseAdmin } from './server/supabase';

async function testVdpCalls() {
  console.log('🔍 Testing vdp_calls queries...\n');

  // Test 1: Check if vdp_calls table exists and has data
  const { data: sampleCalls, error: sampleError } = await supabaseAdmin
    .from('vdp_calls')
    .select('id, event, Params, date, time')
    .limit(5);

  if (sampleError) {
    console.error('❌ Error querying vdp_calls:', sampleError);
    return;
  }

  console.log(`1️⃣ Sample vdp_calls records: ${sampleCalls?.length || 0}`);
  if (sampleCalls && sampleCalls.length > 0) {
    sampleCalls.forEach((c, i) => {
      console.log(`   ${i + 1}. ID: ${c.id} (type: ${typeof c.id}), Event: ${c.event || 'NULL'}`);
      if (c.Params) {
        try {
          const params = typeof c.Params === 'string' ? JSON.parse(c.Params) : c.Params;
          console.log(`      Params.callId: ${params.callId || params.call_id || 'N/A'}`);
        } catch (e) {
          console.log(`      Params: (parse error)`);
        }
      }
    });
  }

  // Test 2: Try to find a specific ID from billing_transactions
  const { data: billingTxn, error: billingError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, source_id, source_table')
    .eq('transaction_type', 'connect')
    .eq('source_table', 'vdp_calls')
    .limit(1)
    .single();

  if (billingError || !billingTxn) {
    console.error('❌ Could not get sample billing transaction:', billingError);
    return;
  }

  console.log(`\n2️⃣ Sample billing transaction:`);
  console.log(`   Transaction ID: ${billingTxn.transaction_id}`);
  console.log(`   Source ID: ${billingTxn.source_id} (type: ${typeof billingTxn.source_id})`);

  // Test 3: Try to find the vdp_call by ID
  console.log(`\n3️⃣ Searching vdp_calls for id=${billingTxn.source_id}...`);
  
  const { data: vdpCall, error: vdpError } = await supabaseAdmin
    .from('vdp_calls')
    .select('id, event, Params, date, time')
    .eq('id', billingTxn.source_id)
    .maybeSingle();

  if (vdpError) {
    console.error('❌ Error querying vdp_calls:', vdpError);
  } else if (!vdpCall) {
    console.log('❌ VDP call NOT FOUND with id=' + billingTxn.source_id);
    
    // Try as string
    console.log(`\n4️⃣ Trying as string...`);
    const { data: vdpCallStr, error: vdpErrorStr } = await supabaseAdmin
      .from('vdp_calls')
      .select('id, event')
      .eq('id', String(billingTxn.source_id))
      .maybeSingle();
    
    if (vdpErrorStr) {
      console.error('❌ Error:', vdpErrorStr);
    } else if (vdpCallStr) {
      console.log('✅ Found when querying as string!');
    } else {
      console.log('❌ Still not found as string');
      
      // Check what IDs actually exist
      console.log(`\n5️⃣ Checking what IDs exist near ${billingTxn.source_id}...`);
      const { data: nearbyCalls, error: nearbyError } = await supabaseAdmin
        .from('vdp_calls')
        .select('id, event')
        .gte('id', Number(billingTxn.source_id) - 10)
        .lte('id', Number(billingTxn.source_id) + 10)
        .limit(20);
      
      if (!nearbyError && nearbyCalls) {
        console.log(`   Found ${nearbyCalls.length} calls with IDs near ${billingTxn.source_id}:`);
        nearbyCalls.forEach(c => {
          console.log(`     - ID: ${c.id} (type: ${typeof c.id}), Event: ${c.event || 'NULL'}`);
        });
      }
    }
  } else {
    console.log('✅ VDP call FOUND!');
    console.log(`   ID: ${vdpCall.id}, Event: ${vdpCall.event || 'NULL'}`);
  }

  process.exit(0);
}

testVdpCalls().catch(console.error);
