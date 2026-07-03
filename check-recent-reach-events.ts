/**
 * Check if recent reach events are being logged to agent_dial_metrics
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkRecentReachEvents() {
  console.log('🔍 Checking recent reach events in agent_dial_metrics...\n');
  
  const { start, end } = getTodayEST();
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Get ALL events from today
  console.log('📊 Fetching ALL events from today...');
  const { data: allEvents, error: allError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, event_type, lead_phone, event_timestamp, call_duration, disposition')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .order('event_timestamp', { ascending: false })
    .limit(100);
  
  if (allError) {
    console.error('❌ Error fetching events:', allError);
    return;
  }
  
  console.log(`✅ Found ${allEvents?.length || 0} total events today (showing last 100)\n`);
  
  // Count by event type
  const eventTypeCounts = new Map<string, number>();
  const recentReachEvents: any[] = [];
  const recentDialEvents: any[] = [];
  
  for (const event of allEvents || []) {
    const eventType = event.event_type?.toLowerCase() || 'unknown';
    eventTypeCounts.set(eventType, (eventTypeCounts.get(eventType) || 0) + 1);
    
    if (eventType === 'reach') {
      recentReachEvents.push(event);
    } else if (eventType === 'dial') {
      recentDialEvents.push(event);
    }
  }
  
  console.log('📊 EVENT TYPE COUNTS (today):');
  for (const [type, count] of Array.from(eventTypeCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${type}: ${count}`);
  }
  console.log('');
  
  // Show most recent reach events
  console.log(`📞 MOST RECENT REACH EVENTS (last 10):`);
  if (recentReachEvents.length === 0) {
    console.log('   ⚠️ NO REACH EVENTS FOUND TODAY!\n');
  } else {
    for (const event of recentReachEvents.slice(0, 10)) {
      const timeAgo = Math.round((Date.now() - new Date(event.event_timestamp).getTime()) / 1000 / 60);
      console.log(`   - ${event.agent_email} | ${event.lead_phone} | Duration: ${event.call_duration}s | ${timeAgo} minutes ago`);
      console.log(`     Disposition: ${event.disposition || 'N/A'} | Timestamp: ${event.event_timestamp}`);
    }
    console.log('');
  }
  
  // Show most recent dial events
  console.log(`📞 MOST RECENT DIAL EVENTS (last 10):`);
  if (recentDialEvents.length === 0) {
    console.log('   ⚠️ NO DIAL EVENTS FOUND TODAY!\n');
  } else {
    for (const event of recentDialEvents.slice(0, 10)) {
      const timeAgo = Math.round((Date.now() - new Date(event.event_timestamp).getTime()) / 1000 / 60);
      console.log(`   - ${event.agent_email} | ${event.lead_phone} | Duration: ${event.call_duration || 'N/A'}s | ${timeAgo} minutes ago`);
    }
    console.log('');
  }
  
  // Check for dials without corresponding reaches
  console.log('🔍 DIALS WITHOUT CORRESPONDING REACHES:\n');
  const dialPhones = new Set((recentDialEvents || []).map(e => e.lead_phone));
  const reachPhones = new Set((recentReachEvents || []).map(e => e.lead_phone));
  
  const dialsWithoutReach = recentDialEvents.filter(e => !reachPhones.has(e.lead_phone));
  
  console.log(`   Total dials today: ${dialPhones.size}`);
  console.log(`   Total reaches today: ${reachPhones.size}`);
  console.log(`   Dials without reaches: ${dialsWithoutReach.length}\n`);
  
  if (dialsWithoutReach.length > 0) {
    console.log('   Sample dials without reaches:');
    for (const event of dialsWithoutReach.slice(0, 10)) {
      const timeAgo = Math.round((Date.now() - new Date(event.event_timestamp).getTime()) / 1000 / 60);
      console.log(`   - ${event.agent_email} | ${event.lead_phone} | Duration: ${event.call_duration || 'N/A'}s | Disposition: ${event.disposition || 'N/A'} | ${timeAgo} min ago`);
    }
    if (dialsWithoutReach.length > 10) {
      console.log(`   ... and ${dialsWithoutReach.length - 10} more`);
    }
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('\n💡 ANALYSIS:');
  if (recentReachEvents.length === 0) {
    console.log('   ❌ NO REACH EVENTS ARE BEING LOGGED!');
    console.log('   This means the logCallOutcome function is not creating reach events.');
    console.log('   Possible causes:');
    console.log('   1. Calls are not ending properly');
    console.log('   2. Dispositions are not qualifying as "reached"');
    console.log('   3. The 45-second fallback is not working');
    console.log('   4. logCallOutcome is not being called at all');
  } else {
    const mostRecentReach = recentReachEvents[0];
    const timeSinceLastReach = Math.round((Date.now() - new Date(mostRecentReach.event_timestamp).getTime()) / 1000 / 60);
    console.log(`   ✅ Reach events ARE being logged (last one ${timeSinceLastReach} minutes ago)`);
    if (timeSinceLastReach > 15) {
      console.log(`   ⚠️ BUT the last reach was ${timeSinceLastReach} minutes ago - this might be why it's not updating!`);
    }
  }
}

checkRecentReachEvents()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
