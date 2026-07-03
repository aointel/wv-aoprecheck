/**
 * Check ALL calls in twilio_call_logs
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkAllTwilioCalls() {
  console.log('\n🔍 CHECKING ALL TWILIO CALLS\n');
  console.log('='.repeat(60));

  try {
    // Get ALL calls from last 24 hours
    const { data: allCalls, error: allError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Error:', allError);
      return;
    }

    console.log(`\n📞 Total calls in last 24 hours: ${allCalls?.length || 0}`);

    if (allCalls && allCalls.length > 0) {
      // Group by duration
      const durations = {
        under30: 0,
        '30to60': 0,
        '60plus': 0
      };

      allCalls.forEach(call => {
        const duration = call.call_duration || 0;
        if (duration < 30) durations.under30++;
        else if (duration < 60) durations['30to60']++;
        else durations['60plus']++;
      });

      console.log(`\n📊 Duration Breakdown:`);
      console.log(`   Under 30s: ${durations.under30}`);
      console.log(`   30-60s: ${durations['30to60']}`);
      console.log(`   60+ seconds: ${durations['60plus']}`);

      // Show sample of recent calls
      console.log(`\n📋 Recent Calls (last 10):\n`);
      allCalls.slice(0, 10).forEach(call => {
        console.log(`   ${call.twilio_call_sid}`);
        console.log(`   Duration: ${call.call_duration || 0}s`);
        console.log(`   Status: ${call.call_status}`);
        console.log(`   Agent: ${call.owner_email || call.agent_identity || 'NONE'}`);
        console.log(`   From: ${call.from_number} → To: ${call.to_number}`);
        console.log(`   Created: ${new Date(call.created_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('\n❌ NO CALLS FOUND IN TWILIO_CALL_LOGS!');
      console.log('\n🔍 Possible Issues:');
      console.log('   1. Twilio webhooks not firing');
      console.log('   2. Wrong Twilio account');
      console.log('   3. Webhook endpoint not receiving data');
      console.log('   4. Database insert still failing');
    }

    // Check if Call Connector Pro is tracking calls differently
    console.log('\n' + '='.repeat(60));
    console.log('\n💡 CALL CONNECTOR PRO INTEGRATION:');
    console.log('   Yes, we should build hotlead webhook INTO Call Connector Pro!');
    console.log('   When a call ends with 60+ seconds:');
    console.log('   → Check if phone matches masterlead');
    console.log('   → Get agent email from logged-in user');
    console.log('   → Get associate_id from customers table');
    console.log('   → Send webhook immediately');
    console.log('');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkAllTwilioCalls()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

