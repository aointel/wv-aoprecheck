/**
 * Check outbound_call_history table to see if CallSid lookups work
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkOutboundCallHistory() {
  console.log('\n🔍 CHECKING OUTBOUND_CALL_HISTORY TABLE\n');
  console.log('='.repeat(60));

  try {
    // Check if table exists and get recent records
    const { data: calls, error } = await supabase
      .from('outbound_call_history')
      .select('*')
      .not('call_sid', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error querying table:', error);
      console.log('\n⚠️  Table may not exist or column names wrong!');
      return;
    }

    console.log(`✅ Found ${calls?.length || 0} calls with call_sid\n`);

    if (calls && calls.length > 0) {
      console.log('📋 Sample call:');
      console.log(JSON.stringify(calls[0], null, 2));
      
      console.log('\n📊 Calls with agent_email:');
      const withAgent = calls.filter(c => c.agent_email && c.agent_email !== 'system@aoglobelife.com');
      console.log(`   ${withAgent.length}/${calls.length} have real agent emails`);
      
      if (withAgent.length > 0) {
        console.log('\n✅ Sample with agent email:');
        withAgent.slice(0, 2).forEach(call => {
          console.log(`   - CallSid: ${call.call_sid}`);
          console.log(`     Agent: ${call.agent_email}`);
          console.log(`     Phone: ${call.lead_phone}`);
          console.log(`     Duration: ${call.call_duration || 0}s`);
        });
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('\n✅ SOLUTION:');
      console.log('   The webhook handler should query outbound_call_history');
      console.log('   by call_sid to get the real agent_email!');
      console.log('\n   Current webhook uses From field (WRONG)');
      console.log('   Should use: SELECT agent_email FROM outbound_call_history WHERE call_sid = ?');
      
    } else {
      console.log('❌ No calls found with call_sid!');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkOutboundCallHistory()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

