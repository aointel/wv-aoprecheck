/**
 * Test directly querying database to see agents making calls
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testAgentsMakingCalls() {
  console.log('═'.repeat(60));
  console.log('TESTING: Agents Making Calls');
  console.log('═'.repeat(60));
  
  // Get active calls from twilio_call_logs
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  console.log(`\n📞 Querying twilio_call_logs for active Call Connector Pro calls...`);
  console.log(`   Time window: Last 2 hours (since ${twoHoursAgo.toISOString()})`);
  
  // First, check what call_source values exist
  console.log(`\n🔍 Checking what call_source values exist...`);
  const { data: sourceCheck } = await supabase
    .from('twilio_call_logs')
    .select('call_source')
    .eq('call_direction', 'outbound')
    .gte('created_at', twoHoursAgo.toISOString())
    .limit(100);
  
  const uniqueSources = new Set((sourceCheck || []).map(c => c.call_source).filter(Boolean));
  console.log(`   Found call_source values:`, Array.from(uniqueSources));
  
  // First check ALL outbound calls (any status) to see if calls exist
  const { data: allCalls } = await supabase
    .from('twilio_call_logs')
    .select('twilio_call_sid, owner_email, call_status, call_direction, call_started_at, created_at, to_number, from_number, call_source')
    .eq('call_direction', 'outbound')
    .gte('created_at', twoHoursAgo.toISOString())
    .not('owner_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log(`\n📞 ALL outbound calls in last 2 hours: ${allCalls?.length || 0}`);
  if (allCalls && allCalls.length > 0) {
    console.log(`\n📋 Sample calls:`);
    allCalls.slice(0, 5).forEach((call, idx) => {
      console.log(`   ${idx + 1}. ${call.owner_email} - Status: ${call.call_status} - Source: ${call.call_source}`);
    });
    
    const statusCounts = {};
    allCalls.forEach(c => {
      statusCounts[c.call_status] = (statusCounts[c.call_status] || 0) + 1;
    });
    console.log(`\n📊 Status breakdown:`, statusCounts);
  }
  
  // Now get active calls (ringing, in-progress, etc.)
  const { data: activeCalls, error } = await supabase
    .from('twilio_call_logs')
    .select('twilio_call_sid, owner_email, call_status, call_direction, call_started_at, created_at, to_number, from_number, call_source')
    .eq('call_direction', 'outbound')
    .in('call_status', ['ringing', 'in-progress', 'queued', 'initiated'])
    .gte('created_at', twoHoursAgo.toISOString())
    .not('owner_email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`\n✅ Found ${activeCalls?.length || 0} active calls`);
  
  if (activeCalls && activeCalls.length > 0) {
    // Get unique agents
    const agentEmails = new Set(activeCalls.map(c => c.owner_email?.toLowerCase()).filter(Boolean));
    console.log(`\n👥 Unique agents making calls: ${agentEmails.size}`);
    console.log(`   Agent emails:`, Array.from(agentEmails));
    
    // Group by status
    const byStatus = {};
    activeCalls.forEach(call => {
      const status = call.call_status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    
    console.log(`\n📊 Calls by status:`, byStatus);
    
    // Show sample calls
    console.log(`\n📋 Sample calls (first 10):`);
    activeCalls.slice(0, 10).forEach((call, idx) => {
      console.log(`\n   ${idx + 1}. Agent: ${call.owner_email}`);
      console.log(`      Status: ${call.call_status}`);
      console.log(`      To: ${call.to_number}`);
      console.log(`      Started: ${call.call_started_at || call.created_at}`);
    });
    
    // Agents who should be eligible (dialing/ringing/initiated)
    const eligibleAgents = new Set(
      activeCalls
        .filter(c => ['initiated', 'ringing', 'queued'].includes(c.call_status))
        .map(c => c.owner_email?.toLowerCase())
        .filter(Boolean)
    );
    
    console.log(`\n✅ Agents ELIGIBLE for inbound (dialing/ringing/initiated): ${eligibleAgents.size}`);
    if (eligibleAgents.size > 0) {
      console.log(`   Agents:`, Array.from(eligibleAgents));
    }
    
    // Agents who are busy (in-progress)
    const busyAgents = new Set(
      activeCalls
        .filter(c => c.call_status === 'in-progress')
        .map(c => c.owner_email?.toLowerCase())
        .filter(Boolean)
    );
    
    console.log(`\n❌ Agents BUSY (in-progress): ${busyAgents.size}`);
    if (busyAgents.size > 0) {
      console.log(`   Agents:`, Array.from(busyAgents));
    }
    
  } else {
    console.log(`\n❌ NO ACTIVE CALLS FOUND`);
    console.log(`   This could mean:`);
    console.log(`   1. No agents are making calls right now`);
    console.log(`   2. Calls aren't being logged to twilio_call_logs`);
    console.log(`   3. call_source is not 'call_connector_pro'`);
  }
  
  console.log('\n' + '═'.repeat(60));
}

testAgentsMakingCalls();
