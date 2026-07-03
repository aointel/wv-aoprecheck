/**
 * Test what the scheduler is actually querying
 */

import { supabaseAdmin } from './server/supabase';

async function testSchedulerQuery() {
  console.log('🔍 Testing scheduler query logic...\n');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  console.log(`📅 Date range: ${sevenDaysAgo.toISOString()} to now\n`);

  // Test 1: All connect transactions
  const { data: allConnects, error: allError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, transaction_type, source_table, transaction_date')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', sevenDaysAgo.toISOString())
    .limit(10);

  console.log(`1️⃣ All 'connect' transactions (last 7 days): ${allConnects?.length || 0}`);
  if (allConnects && allConnects.length > 0) {
    console.log('Sample:');
    allConnects.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.transaction_id} - source_table: ${t.source_table || 'NULL'} - date: ${t.transaction_date}`);
    });
  }

  // Test 2: Connect transactions with source_table='vdp_calls'
  const { data: vdpConnects, error: vdpError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, source_table, source_id, transaction_date')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', sevenDaysAgo.toISOString())
    .eq('source_table', 'vdp_calls')
    .limit(10);

  console.log(`\n2️⃣ 'connect' transactions with source_table='vdp_calls': ${vdpConnects?.length || 0}`);
  if (vdpError) {
    console.error('❌ Error:', vdpError);
  } else if (vdpConnects && vdpConnects.length > 0) {
    console.log('Sample:');
    vdpConnects.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.transaction_id} - source_id: ${t.source_id} - date: ${t.transaction_date}`);
    });
  }

  // Test 3: Check what source_table values actually exist
  const { data: sourceTables, error: sourceError } = await supabaseAdmin
    .from('billing_transactions')
    .select('source_table')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', sevenDaysAgo.toISOString())
    .not('source_table', 'is', null)
    .limit(100);

  if (!sourceError && sourceTables) {
    const uniqueTables = [...new Set(sourceTables.map(t => t.source_table))];
    console.log(`\n3️⃣ Unique source_table values for 'connect' transactions:`);
    uniqueTables.forEach(t => {
      const count = sourceTables.filter(s => s.source_table === t).length;
      console.log(`   - ${t || 'NULL'}: ${count} transactions`);
    });
  }

  // Test 4: Try without source_table filter (maybe it's NULL or different)
  const { data: noFilter, error: noFilterError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, source_table, source_id, transaction_date')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', sevenDaysAgo.toISOString())
    .limit(10);

  console.log(`\n4️⃣ All 'connect' transactions (no source_table filter): ${noFilter?.length || 0}`);
  if (noFilter && noFilter.length > 0) {
    console.log('Sample:');
    noFilter.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.transaction_id} - source_table: ${t.source_table || 'NULL'} - source_id: ${t.source_id || 'NULL'}`);
    });
  }

  process.exit(0);
}

testSchedulerQuery().catch(console.error);
