/**
 * BACKFILL: Create missing reach events for calls with duration > 45 seconds
 * 
 * This script finds all dial events with duration > 45 seconds that don't have
 * corresponding reach events, and creates the missing reach events.
 * 
 * Rule: ANY call with duration > 45 seconds = REACH (regardless of disposition)
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function backfillMissingReachEvents() {
  console.log('🔧 Backfilling missing reach events for calls > 45 seconds...\n');
  
  // Get today's date range in EST
  const { start, end } = getTodayEST();
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Step 1: Get all dial events with duration > 45 seconds today
  console.log('📊 Fetching dial events with duration > 45 seconds...');
  const { data: dialEvents, error: dialError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('id, agent_email, agent_name, lead_id, lead_phone, lead_name, lead_state, event_timestamp, call_duration, disposition, call_status, call_sid, source, notes')
    .eq('event_type', 'dial')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .not('call_duration', 'is', null)
    .gt('call_duration', 45)
    .order('event_timestamp', { ascending: false });
  
  if (dialError) {
    console.error('❌ Error fetching dial events:', dialError);
    return;
  }
  
  console.log(`✅ Found ${dialEvents?.length || 0} dial events with duration > 45 seconds\n`);
  
  if (!dialEvents || dialEvents.length === 0) {
    console.log('⚠️ No dial events found to process');
    return;
  }
  
  // Step 2: Get all existing reach events for today (to check which ones already exist)
  console.log('📊 Fetching existing reach events...');
  const { data: existingReaches, error: reachError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, lead_phone, event_timestamp')
    .eq('event_type', 'reach')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString());
  
  if (reachError) {
    console.error('❌ Error fetching existing reach events:', reachError);
    return;
  }
  
  // Create a set of existing reach events (agent_email + lead_phone + timestamp within 5 minutes)
  const existingReachSet = new Set<string>();
  for (const reach of existingReaches || []) {
    const key = `${reach.agent_email?.toLowerCase().trim()}_${reach.lead_phone}_${Math.floor(new Date(reach.event_timestamp).getTime() / (5 * 60 * 1000))}`;
    existingReachSet.add(key);
  }
  
  console.log(`✅ Found ${existingReaches?.length || 0} existing reach events\n`);
  
  // Step 3: Find dial events that don't have corresponding reach events
  const missingReaches: any[] = [];
  
  for (const dial of dialEvents) {
    const agentEmail = dial.agent_email?.toLowerCase().trim();
    const leadPhone = dial.lead_phone;
    const dialTime = new Date(dial.event_timestamp);
    const timeKey = Math.floor(dialTime.getTime() / (5 * 60 * 1000)); // 5-minute window
    
    const reachKey = `${agentEmail}_${leadPhone}_${timeKey}`;
    
    if (!existingReachSet.has(reachKey)) {
      missingReaches.push(dial);
    }
  }
  
  console.log(`🔍 Found ${missingReaches.length} dial events missing reach events\n`);
  
  if (missingReaches.length === 0) {
    console.log('✅ All dial events already have reach events!');
    return;
  }
  
  // Step 4: Create the missing reach events
  console.log('📝 Creating missing reach events...\n');
  
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const dial of missingReaches) {
    try {
      // Check for duplicate within last hour (same as logDialMetric does)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existingReach, error: checkError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('id')
        .eq('agent_email', dial.agent_email)
        .eq('event_type', 'reach')
        .eq('lead_phone', dial.lead_phone)
        .gte('event_timestamp', oneHourAgo)
        .limit(1);
      
      if (checkError) {
        console.error(`❌ Error checking for duplicate reach:`, checkError);
        errors++;
        continue;
      }
      
      if (existingReach && existingReach.length > 0) {
        skipped++;
        continue;
      }
      
      // Create the reach event
      const reachEvent = {
        agent_email: dial.agent_email,
        agent_name: dial.agent_name || null,
        lead_id: dial.lead_id || null,
        lead_phone: dial.lead_phone,
        lead_name: dial.lead_name || null,
        lead_state: dial.lead_state || null,
        event_type: 'reach',
        event_timestamp: dial.event_timestamp, // Use same timestamp as dial
        call_duration: dial.call_duration,
        call_status: dial.call_status || 'completed',
        disposition: dial.disposition || null,
        call_sid: dial.call_sid || null,
        source: dial.source || 'backfill',
        notes: `Auto-created reach event: Call duration ${dial.call_duration}s > 45s (original disposition: ${dial.disposition || 'N/A'})`
      };
      
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .insert(reachEvent)
        .select();
      
      if (insertError) {
        console.error(`❌ Failed to create reach event for ${dial.agent_email} -> ${dial.lead_phone}:`, insertError);
        errors++;
      } else {
        created++;
        if (created % 10 === 0) {
          console.log(`   ✅ Created ${created} reach events...`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing dial event ${dial.id}:`, error);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('📊 BACKFILL SUMMARY:');
  console.log(`   Total dial events with duration > 45s: ${dialEvents.length}`);
  console.log(`   Missing reach events: ${missingReaches.length}`);
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⏭️  Skipped (duplicates): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('='.repeat(100));
  
  if (created > 0) {
    console.log('\n✅ Backfill complete! The leaderboard should now show updated reach counts.');
  }
}

backfillMissingReachEvents()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
