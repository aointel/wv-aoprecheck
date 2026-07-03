/**
 * Check twilio_call_logs table schema
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkSchema() {
  console.log('\n🔍 CHECKING DATABASE SCHEMA\n');
  console.log('='.repeat(60));

  try {
    // Try to insert a test record directly
    console.log('\n📝 Attempting direct insert...\n');
    
    const testData = {
      twilio_call_sid: 'DIRECT_TEST_' + Date.now(),
      call_direction: 'outbound',
      from_number: 'client:test@aoglobelife.com',
      to_number: '+15555551234',
      call_status: 'completed',
      call_duration: 45,
      owner_email: 'test@aoglobelife.com',
      agent_identity: 'test@aoglobelife.com',
      call_started_at: new Date().toISOString(),
      call_ended_at: new Date().toISOString(),
      call_source: 'direct_test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Test data:', JSON.stringify(testData, null, 2));

    const { data, error } = await supabase
      .from('twilio_call_logs')
      .insert(testData)
      .select();

    if (error) {
      console.log('\n❌ INSERT FAILED!');
      console.log('Error:', JSON.stringify(error, null, 2));
      console.log('\nPossible issues:');
      console.log('  1. Table doesn\'t exist');
      console.log('  2. Column names don\'t match');
      console.log('  3. Missing required columns');
      console.log('  4. Data type mismatch');
      console.log('  5. RLS (Row Level Security) blocking inserts');
    } else {
      console.log('\n✅ INSERT SUCCESSFUL!');
      console.log('Inserted data:', JSON.stringify(data, null, 2));
      console.log('\nThe table exists and inserts work!');
      console.log('Problem must be in the webhook code logic.');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
  }
}

checkSchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

