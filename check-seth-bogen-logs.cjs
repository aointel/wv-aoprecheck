const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSethBogenLogs() {
  console.log('🔍 Checking Twilio logs for sethbogen@aoglobelife.com\n');
  console.log('='.repeat(80));
  
  try {
    // Get all calls
    const { data: calls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .or('owner_email.eq.sethbogen@aoglobelife.com,agent_identity.eq.sethbogen@aoglobelife.com')
      .order('call_started_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`\n📊 TOTAL CALLS: ${calls?.length || 0}\n`);
    
    if (!calls || calls.length === 0) {
      console.log('❌ NO CALLS FOUND for sethbogen@aoglobelife.com');
      console.log('\n💡 This could mean:');
      console.log('   1. Seth Bogen has not made any calls yet');
      console.log('   2. Calls are not being logged to twilio_call_logs table');
      console.log('   3. Email might be different (check spelling/domain)\n');
      return;
    }
    
    // Summary stats
    const completed = calls.filter(c => c.call_status === 'completed').length;
    const failed = calls.filter(c => c.call_status === 'failed').length;
    const noAnswer = calls.filter(c => c.call_status === 'no-answer').length;
    const busy = calls.filter(c => c.call_status === 'busy').length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.call_duration || 0), 0);
    
    console.log('📈 CALL SUMMARY:');
    console.log(`   ✅ Completed: ${completed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📵 No Answer: ${noAnswer}`);
    console.log(`   📞 Busy: ${busy}`);
    console.log(`   ⏱️  Total Duration: ${Math.floor(totalDuration / 60)} min ${totalDuration % 60} sec`);
    
    if (calls.length > 0) {
      const firstCall = new Date(calls[calls.length - 1].call_started_at);
      const lastCall = new Date(calls[0].call_started_at);
      console.log(`   📅 First Call: ${firstCall.toLocaleString()}`);
      console.log(`   📅 Last Call: ${lastCall.toLocaleString()}\n`);
    }
    
    // Show recent calls (last 10)
    console.log('='.repeat(80));
    console.log('\n📞 RECENT CALLS (Last 10):\n');
    
    calls.slice(0, 10).forEach((call, i) => {
      const startTime = new Date(call.call_started_at).toLocaleString();
      const duration = call.call_duration || 0;
      const status = call.call_status;
      const statusEmoji = status === 'completed' ? '✅' : 
                          status === 'failed' ? '❌' : 
                          status === 'no-answer' ? '📵' : 
                          status === 'busy' ? '📞' : '❓';
      
      console.log(`${i + 1}. ${statusEmoji} ${startTime}`);
      console.log(`   To: ${call.to_number}`);
      console.log(`   Status: ${status}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Call SID: ${call.twilio_call_sid}`);
      console.log(`   Source: ${call.call_source || 'unknown'}`);
      console.log();
    });
    
    // Show failed calls if any
    const failedCalls = calls.filter(c => c.call_status === 'failed');
    if (failedCalls.length > 0) {
      console.log('='.repeat(80));
      console.log('\n❌ FAILED CALLS:\n');
      
      failedCalls.slice(0, 5).forEach((call, i) => {
        console.log(`${i + 1}. ${new Date(call.call_started_at).toLocaleString()}`);
        console.log(`   To: ${call.to_number}`);
        console.log(`   Call SID: ${call.twilio_call_sid}`);
        if (call.metadata) {
          console.log(`   Error: ${JSON.stringify(call.metadata)}`);
        }
        console.log();
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSethBogenLogs();






