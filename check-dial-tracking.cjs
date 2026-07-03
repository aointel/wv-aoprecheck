/**
 * Check if dialing metrics are being tracked properly
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkDialTracking() {
  console.log('\n📊 CHECKING DIAL/REACHED/BOOKED TRACKING\n');
  console.log('='.repeat(60));

  try {
    // Check recent calls in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: calls, error } = await supabase
      .from('twilio_call_logs')
      .select('*')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Error fetching calls:', error);
      return;
    }

    console.log(`\n📞 Found ${calls?.length || 0} calls in last 24 hours\n`);

    if (!calls || calls.length === 0) {
      console.log('⚠️  NO CALLS FOUND IN DATABASE!');
      console.log('\nPossible issues:');
      console.log('  1. Twilio webhook not configured correctly');
      console.log('  2. Calls are being made but not logged');
      console.log('  3. Agent emails not being captured from From field');
      return;
    }

    // Group by agent
    const byAgent = {};
    calls.forEach(call => {
      const agent = call.owner_email || call.agent_identity || 'unknown';
      if (!byAgent[agent]) {
        byAgent[agent] = {
          dialed: 0,
          reached: 0,
          booked: 0,
          calls: []
        };
      }

      byAgent[agent].dialed++;
      
      // Reached = answered OR duration > 30 seconds
      if (call.call_status === 'answered' || (call.call_duration && call.call_duration > 30)) {
        byAgent[agent].reached++;
      }

      // Booked = completed AND duration > 60 seconds
      if (call.call_status === 'completed' && call.call_duration && call.call_duration > 60) {
        byAgent[agent].booked++;
      }

      byAgent[agent].calls.push({
        to: call.to_number,
        status: call.call_status,
        duration: call.call_duration,
        time: new Date(call.created_at).toLocaleTimeString()
      });
    });

    // Display results
    console.log('📊 AGENT STATS (Last 24 Hours):\n');
    Object.entries(byAgent).forEach(([agent, stats]) => {
      console.log(`\n👤 ${agent}`);
      console.log(`   📞 Dialed: ${stats.dialed}`);
      console.log(`   ✅ Reached: ${stats.reached}`);
      console.log(`   📅 Booked: ${stats.booked}`);
      console.log(`   Recent calls (last 5):`);
      stats.calls.slice(0, 5).forEach(call => {
        console.log(`      ${call.time}: ${call.to} -> ${call.status} (${call.duration}s)`);
      });
    });

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Tracking appears to be working!');
    console.log('\nIf numbers look wrong:');
    console.log('  1. Check if Twilio webhook is being called');
    console.log('  2. Verify agent email is in From field as "client:email@domain.com"');
    console.log('  3. Check Live Call Board endpoint logic');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

checkDialTracking()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

