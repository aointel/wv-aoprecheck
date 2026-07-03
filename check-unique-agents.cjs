/**
 * Check unique agents making calls
 */

global.fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0'
);

async function checkUniqueAgents() {
  console.log('\n👥 CHECKING UNIQUE AGENTS\n');
  console.log('='.repeat(60));

  try {
    // Get date 2 weeks ago
    const twoWeeksAgo = new Date(Date.now() - (14 * 24 * 60 * 60 * 1000)).toISOString();
    
    console.log(`\n📅 Period: Last 2 weeks\n`);
    
    // Get all calls from last 2 weeks
    const { data: calls, error } = await supabase
      .from('twilio_call_logs')
      .select('owner_email, call_status, call_duration, created_at')
      .gte('created_at', twoWeeksAgo)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`📞 Total calls in database: ${calls?.length || 0}\n`);

    if (!calls || calls.length === 0) {
      console.log('❌ No calls found in twilio_call_logs table');
      return;
    }

    // Count by agent
    const agentStats = {};
    let systemCalls = 0;
    
    calls.forEach(call => {
      const email = call.owner_email || 'unknown';
      
      if (email === 'system@aoglobelife.com') {
        systemCalls++;
        return;
      }
      
      if (!agentStats[email]) {
        agentStats[email] = {
          totalCalls: 0,
          completedCalls: 0,
          totalMinutes: 0
        };
      }
      
      agentStats[email].totalCalls++;
      
      if (call.call_status === 'completed') {
        agentStats[email].completedCalls++;
      }
      
      const duration = parseInt(call.call_duration) || 0;
      agentStats[email].totalMinutes += duration / 60;
    });

    const uniqueAgents = Object.keys(agentStats).filter(email => email !== 'unknown');
    
    console.log('='.repeat(60));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Unique Agents: ${uniqueAgents.length}`);
    console.log(`   System Calls: ${systemCalls}`);
    console.log(`   Total Tracked Calls: ${calls.length - systemCalls}`);
    console.log('');

    console.log('='.repeat(60));
    console.log('\n👥 AGENT BREAKDOWN:\n');
    
    // Sort by total calls
    const sortedAgents = Object.entries(agentStats)
      .filter(([email]) => email !== 'unknown')
      .sort((a, b) => b[1].totalCalls - a[1].totalCalls);

    sortedAgents.forEach(([email, stats], index) => {
      const name = email.split('@')[0];
      console.log(`   ${index + 1}. ${name} (${email})`);
      console.log(`      Total Calls: ${stats.totalCalls}`);
      console.log(`      Completed: ${stats.completedCalls} (${((stats.completedCalls / stats.totalCalls) * 100).toFixed(1)}%)`);
      console.log(`      Minutes: ${stats.totalMinutes.toFixed(2)}`);
      console.log(`      Hours: ${(stats.totalMinutes / 60).toFixed(2)}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('\n🏆 TOP PERFORMERS:\n');
    
    // Top 5 by calls
    console.log('   By Call Volume:');
    sortedAgents.slice(0, 5).forEach(([email, stats], index) => {
      const name = email.split('@')[0];
      console.log(`      ${index + 1}. ${name}: ${stats.totalCalls} calls`);
    });
    
    console.log('\n   By Talk Time:');
    const sortedByTime = [...sortedAgents].sort((a, b) => b[1].totalMinutes - a[1].totalMinutes);
    sortedByTime.slice(0, 5).forEach(([email, stats], index) => {
      const name = email.split('@')[0];
      console.log(`      ${index + 1}. ${name}: ${(stats.totalMinutes / 60).toFixed(2)} hours`);
    });

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

checkUniqueAgents()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


