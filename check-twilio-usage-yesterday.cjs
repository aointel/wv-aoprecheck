const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function checkTwilioUsageYesterday() {
  console.log('📞 CHECKING TWILIO USAGE - YESTERDAY\n');
  console.log('='.repeat(80));
  
  try {
    // Get yesterday's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayEnd = new Date(today);
    
    console.log(`📅 Date Range: ${yesterday.toISOString()} to ${yesterdayEnd.toISOString()}\n`);
    
    // Get all calls from yesterday
    const { data: calls, error } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, call_duration, call_status')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', yesterdayEnd.toISOString());
    
    if (error) throw error;
    
    if (!calls || calls.length === 0) {
      console.log('❌ No calls found for yesterday\n');
      return;
    }
    
    // Calculate stats
    const uniqueAgents = new Set(calls.map(c => c.owner_email).filter(e => e));
    const totalCalls = calls.length;
    const totalMinutes = calls.reduce((sum, call) => {
      const duration = call.call_duration || 0;
      return sum + (duration / 60); // Convert seconds to minutes
    }, 0);
    
    const answeredCalls = calls.filter(c => c.call_status === 'completed' || c.call_status === 'answered').length;
    
    console.log('📊 YESTERDAY\'S TWILIO USAGE:\n');
    console.log(`   Total Calls: ${totalCalls}`);
    console.log(`   Answered Calls: ${answeredCalls}`);
    console.log(`   Unanswered: ${totalCalls - answeredCalls}`);
    console.log(`   Total Minutes: ${totalMinutes.toFixed(2)}`);
    console.log(`   Unique Agents: ${uniqueAgents.size}`);
    console.log(`   Avg Calls per Agent: ${(totalCalls / uniqueAgents.size).toFixed(1)}`);
    console.log(`   Avg Minutes per Agent: ${(totalMinutes / uniqueAgents.size).toFixed(2)}`);
    
    // Estimated cost ($0.013/minute)
    const estimatedCost = totalMinutes * 0.013;
    console.log(`\n💰 ESTIMATED COST: $${estimatedCost.toFixed(2)}`);
    console.log(`   Cost per agent: $${(estimatedCost / uniqueAgents.size).toFixed(2)}`);
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

checkTwilioUsageYesterday()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });









