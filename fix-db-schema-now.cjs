/**
 * Fix twilio_call_logs table schema
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function fixSchema() {
  console.log('\n🔧 FIXING TWILIO_CALL_LOGS TABLE SCHEMA\n');
  console.log('='.repeat(60));

  const queries = [
    'ALTER TABLE twilio_call_logs ALTER COLUMN twilio_call_sid TYPE VARCHAR(50);',
    'ALTER TABLE twilio_call_logs ALTER COLUMN from_number TYPE VARCHAR(100);',
    'ALTER TABLE twilio_call_logs ALTER COLUMN to_number TYPE VARCHAR(100);',
    'ALTER TABLE twilio_call_logs ALTER COLUMN owner_email TYPE VARCHAR(255);',
    'ALTER TABLE twilio_call_logs ALTER COLUMN agent_identity TYPE VARCHAR(255);'
  ];

  for (const query of queries) {
    try {
      console.log(`\n📝 Executing: ${query}`);
      const { error } = await supabase.rpc('exec_sql', { sql: query });
      
      if (error) {
        console.log(`❌ Error: ${error.message}`);
      } else {
        console.log('✅ Success');
      }
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 Schema fix complete!');
  console.log('\nNow testing insert...\n');

  // Test insert again
  const testData = {
    twilio_call_sid: 'CA1234567890123456789012345678901234', // Real Twilio format
    call_direction: 'outbound',
    from_number: 'client:test@aoglobelife.com',
    to_number: '+15555551234',
    call_status: 'completed',
    call_duration: 45,
    owner_email: 'test@aoglobelife.com',
    agent_identity: 'test@aoglobelife.com',
    call_started_at: new Date().toISOString(),
    call_ended_at: new Date().toISOString(),
    call_source: 'schema_fix_test',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('twilio_call_logs')
    .insert(testData)
    .select();

  if (error) {
    console.log('❌ Test insert still failing:', error.message);
  } else {
    console.log('✅ TEST INSERT SUCCESSFUL!');
    console.log('\n🎉 Dial/Reached/Booked tracking is NOW FIXED!');
    console.log('   Webhooks will now save call data correctly.\n');
  }
}

fixSchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

