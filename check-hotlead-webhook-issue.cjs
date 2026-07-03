/**
 * Debug why hotlead webhooks aren't triggering for 60+ second calls
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function debugHotleadWebhook() {
  console.log('\n🔍 DEBUGGING HOTLEAD WEBHOOK TRIGGER\n');
  console.log('='.repeat(60));

  try {
    // 1. Check recent calls in twilio_call_logs
    console.log('\n📞 Checking recent calls in twilio_call_logs...\n');
    
    const { data: recentCalls, error: callsError } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (callsError) {
      console.error('❌ Error fetching calls:', callsError);
    } else {
      console.log(`Found ${recentCalls?.length || 0} calls in last 24 hours\n`);
      
      if (recentCalls && recentCalls.length > 0) {
        console.log('📋 Sample call structure:');
        const sample = recentCalls[0];
        console.log(JSON.stringify(sample, null, 2));
        
        console.log('\n📊 Calls by duration:');
        const over60 = recentCalls.filter(c => c.call_duration && c.call_duration >= 60);
        const over50 = recentCalls.filter(c => c.call_duration && c.call_duration >= 50);
        
        console.log(`   Calls >= 60 seconds: ${over60.length}`);
        console.log(`   Calls >= 50 seconds: ${over50.length}`);
        
        if (over60.length > 0) {
          console.log('\n✅ Calls over 60 seconds found! Showing first 3:');
          over60.slice(0, 3).forEach(call => {
            console.log(`     - ${call.to_number}: ${call.call_duration}s, status: ${call.call_status}, created: ${new Date(call.created_at).toLocaleString()}`);
          });
        } else {
          console.log('\n❌ NO calls over 60 seconds found!');
        }
      } else {
        console.log('❌ NO CALLS IN DATABASE AT ALL!');
      }
    }

    // 2. Check if hotlead_webhooks table exists
    console.log('\n\n📤 Checking hotlead_webhooks table...\n');
    
    const { data: webhooks, error: webhooksError } = await supabase
      .from('hotlead_webhooks')
      .select('*')
      .limit(5);

    if (webhooksError) {
      console.error('❌ Error accessing hotlead_webhooks table:', webhooksError);
      console.log('\n⚠️  ISSUE: hotlead_webhooks table may not exist!');
    } else {
      console.log(`✅ hotlead_webhooks table exists, found ${webhooks?.length || 0} recent webhooks`);
    }

    // 3. Check if scheduler is actually running
    console.log('\n\n⏰ SCHEDULER STATUS:\n');
    console.log('The scheduler should:');
    console.log('  1. Run every 5 minutes (cron: */5 * * * *)');
    console.log('  2. Query twilio_call_logs for completed calls >= 50 seconds');
    console.log('  3. Match calls to hotleads by phone number');
    console.log('  4. Send webhook if not already sent');
    
    console.log('\n🔍 POTENTIAL ISSUES:');
    console.log('  1. Scheduler query uses .gte("duration", 50) but column is "call_duration"');
    console.log('  2. No calls in twilio_call_logs (webhooks not working)');
    console.log('  3. Phone number matching logic not working');
    console.log('  4. Scheduler not actually running on Railway');
    console.log('  5. hotlead_webhooks table doesn\'t exist');

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

debugHotleadWebhook()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

