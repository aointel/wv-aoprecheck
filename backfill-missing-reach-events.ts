/**
 * BACKFILL: Missing Reach Events
 * 
 * This script finds dial events from today where:
 * - Duration > 45 seconds
 * - No corresponding reach event exists
 * - Disposition is "no_answer_vm" or similar (not in reached list)
 * 
 * Then creates reach events for these calls.
 */

import { supabaseAdmin } from './server/supabase';

async function backfillMissingReachEvents() {
  console.log('🔍 Finding dial events that should have reach events...\n');
  
  // Get today's date range in EST
  const now = new Date();
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const estDateParts = estFormatter.formatToParts(now);
  const year = estDateParts.find(p => p.type === 'year')!.value;
  const month = estDateParts.find(p => p.type === 'month')!.value;
  const day = estDateParts.find(p => p.type === 'day')!.value;
  
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  let isDST = false;
  if (monthNum > 3 && monthNum < 11) {
    isDST = true;
  } else if (monthNum === 3 && dayNum >= 10) {
    isDST = true;
  } else if (monthNum === 11 && dayNum < 3) {
    isDST = true;
  }
  
  const offsetHours = isDST ? -4 : -5;
  const offsetStr = offsetHours < 0 
    ? `-${Math.abs(offsetHours).toString().padStart(2, '0')}:00`
    : `+${offsetHours.toString().padStart(2, '0')}:00`;
  
  const start = new Date(`${year}-${month}-${day}T00:00:00${offsetStr}`);
  const end = new Date(`${year}-${month}-${day}T23:59:59.999${offsetStr}`);
  
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Get all dial events from today with duration > 45 seconds
  const { data: dialEvents, error: dialError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .eq('event_type', 'dial')
    .not('call_duration', 'is', null)
    .gt('call_duration', 45)
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '');
  
  if (dialError) {
    console.error('❌ Error fetching dial events:', dialError);
    return;
  }
  
  console.log(`✅ Found ${dialEvents?.length || 0} dial events with duration > 45s\n`);
  
  if (!dialEvents || dialEvents.length === 0) {
    console.log('✅ No dial events to process');
    return;
  }
  
  // Get all reach events from today to check which dials already have reaches
  const { data: reachEvents, error: reachError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, lead_phone, event_timestamp')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .eq('event_type', 'reach')
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '');
  
  if (reachError) {
    console.error('❌ Error fetching reach events:', reachError);
    return;
  }
  
  // Create a set of (agent_email, lead_phone, timestamp) tuples for existing reaches
  const existingReaches = new Set<string>();
  for (const reach of reachEvents || []) {
    const key = `${reach.agent_email?.toLowerCase().trim()}-${reach.lead_phone?.replace(/\D/g, '')}-${reach.event_timestamp}`;
    existingReaches.add(key);
  }
  
  // Find dial events that should have reach events but don't
  const missingReaches: typeof dialEvents = [];
  
  for (const dial of dialEvents) {
    const key = `${dial.agent_email?.toLowerCase().trim()}-${dial.lead_phone?.replace(/\D/g, '')}-${dial.event_timestamp}`;
    
    // Check if reach already exists
    if (existingReaches.has(key)) {
      continue; // Already has reach event
    }
    
    // Check if disposition is in "not reached" list (these should still get reach if duration > 45)
    const disposition = (dial.disposition || '').toLowerCase().trim();
    const notReachedDisps = ['no_answer', 'busy', 'failed', 'voicemail', 'bad_number',
      'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number'];
    
    // If disposition is in "not reached" list OR if it's null/empty, create reach event
    if (notReachedDisps.includes(disposition) || !disposition) {
      missingReaches.push(dial);
    }
  }
  
  console.log(`📊 Found ${missingReaches.length} dial events missing reach events\n`);
  
  if (missingReaches.length === 0) {
    console.log('✅ All dial events already have reach events');
    return;
  }
  
  // Create reach events for missing ones
  console.log('📤 Creating reach events...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const dial of missingReaches) {
    try {
      const { error: insertError } = await supabaseAdmin
        .from('agent_dial_metrics')
        .insert({
          agent_email: dial.agent_email,
          agent_name: dial.agent_name,
          lead_id: dial.lead_id,
          lead_phone: dial.lead_phone,
          lead_name: dial.lead_name,
          lead_state: dial.lead_state,
          event_type: 'reach',
          event_timestamp: dial.event_timestamp,
          call_duration: dial.call_duration,
          call_status: dial.call_status,
          disposition: dial.disposition,
          call_sid: dial.call_sid,
          source: dial.source || 'dialer',
          notes: dial.notes || `Auto-created reach event (duration=${dial.call_duration}s > 45s)`,
        });
      
      if (insertError) {
        console.error(`❌ Failed to create reach event for ${dial.agent_email} -> ${dial.lead_phone}:`, insertError);
        failCount++;
      } else {
        successCount++;
        if (successCount % 10 === 0) {
          console.log(`   Created ${successCount} reach events...`);
        }
      }
    } catch (error) {
      console.error(`❌ Error creating reach event:`, error);
      failCount++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(80));
  console.log(`   Dial events checked: ${dialEvents.length}`);
  console.log(`   Missing reach events: ${missingReaches.length}`);
  console.log(`   Reach events created: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log('='.repeat(80));
  console.log('\n✅ Backfill complete!');
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
