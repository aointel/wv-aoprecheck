/**
 * TEST: Insert a single entry into agent_dial_metrics
 * This tests if inserts work at all
 */

import { supabaseAdmin } from './server/supabase';

async function testSingleInsert() {
  if (!supabaseAdmin) {
    console.error('❌ supabaseAdmin is null');
    process.exit(1);
  }

  console.log('🧪 Testing single insert into agent_dial_metrics...\n');

  const testData = {
    agent_email: 'test@example.com',
    lead_id: 999999,
    lead_phone: '1234567890',
    lead_name: 'Test Lead',
    event_type: 'dial',
    event_timestamp: new Date().toISOString(),
    call_duration: 30,
    disposition: 'test',
    source: 'test_script',
  };

  console.log('📝 Inserting:', JSON.stringify(testData, null, 2));
  console.log('');

  try {
    // Try insert - trigger might fail but insert might still succeed
    const { data, error } = await supabaseAdmin
      .from('agent_dial_metrics')
      .insert(testData)
      .select();

    // If error is about trigger, wait and check if insert actually succeeded
    if (error && (error.message?.includes('live_call_board') || error.code === '42P01')) {
      console.log('⚠️  Trigger error detected, checking if insert succeeded anyway...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if the record was actually inserted
      const { data: verify, error: verifyError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('*')
        .eq('agent_email', testData.agent_email)
        .eq('lead_phone', testData.lead_phone)
        .eq('event_type', testData.event_type)
        .eq('event_timestamp', testData.event_timestamp)
        .limit(1);
      
      if (verify && verify.length > 0) {
        console.log('✅ INSERT ACTUALLY SUCCEEDED despite trigger error!');
        console.log('Inserted data:', JSON.stringify(verify[0], null, 2));
        process.exit(0);
      } else {
        console.error('❌ INSERT FAILED - trigger error caused rollback');
        console.error('Error:', error.message);
        process.exit(1);
      }
    } else if (error) {
      console.error('❌ INSERT FAILED:');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      process.exit(1);
    } else {
      console.log('✅ INSERT SUCCEEDED!');
      console.log('Inserted data:', JSON.stringify(data, null, 2));
      
      // Verify it exists
      const { data: verify, error: verifyError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('*')
        .eq('id', data[0].id)
        .single();
      
      if (verifyError) {
        console.error('⚠️  Could not verify insert:', verifyError.message);
      } else {
        console.log('✅ Verified: Record exists in database');
        console.log('Record:', JSON.stringify(verify, null, 2));
      }
    }
  } catch (err: any) {
    console.error('❌ FATAL ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testSingleInsert()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

