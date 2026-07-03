/**
 * Test script to manually test inserting into taalk_call_analytics
 */

import { supabaseAdmin } from './server/supabase';

async function testInsert() {
  console.log('🔍 Testing taalk_call_analytics insert...\n');

  // First, check if table exists and what columns it has
  const { data: testQuery, error: testError } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('*')
    .limit(1);

  if (testError) {
    console.error('❌ Error querying table:', testError);
    console.error('Full error:', JSON.stringify(testError, null, 2));
    return;
  }

  console.log('✅ Table exists and is queryable');

  // Try to insert a test record
  const testData = {
    billing_transaction_id: 'TEST-' + Date.now(),
    agent_email: 'test@example.com',
    call_date: new Date().toISOString(),
    taalk_call_id: 'test-call-id',
    analysis_status: 'analyzing'
  };

  console.log('\n📝 Attempting to insert test record:', testData);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('taalk_call_analytics')
    .insert(testData)
    .select()
    .single();

  if (insertError) {
    console.error('❌ INSERT FAILED:', insertError);
    console.error('Full error:', JSON.stringify(insertError, null, 2));
    console.error('\nError code:', insertError.code);
    console.error('Error message:', insertError.message);
    console.error('Error details:', insertError.details);
    console.error('Error hint:', insertError.hint);
  } else {
    console.log('✅ INSERT SUCCESSFUL!');
    console.log('Inserted record:', inserted);

    // Clean up - delete the test record
    const { error: deleteError } = await supabaseAdmin
      .from('taalk_call_analytics')
      .delete()
      .eq('id', inserted.id);

    if (deleteError) {
      console.error('⚠️ Could not delete test record:', deleteError);
    } else {
      console.log('✅ Test record cleaned up');
    }
  }

  // Check if there are any real records
  const { data: allRecords, error: countError } = await supabaseAdmin
    .from('taalk_call_analytics')
    .select('id, billing_transaction_id, analysis_status')
    .limit(10);

  console.log(`\n📊 Total records in table: ${allRecords?.length || 0}`);
  if (allRecords && allRecords.length > 0) {
    console.log('Sample records:');
    allRecords.forEach((r, i) => {
      console.log(`  ${i + 1}. ID: ${r.id}, Transaction: ${r.billing_transaction_id}, Status: ${r.analysis_status}`);
    });
  }

  process.exit(0);
}

testInsert().catch(console.error);
