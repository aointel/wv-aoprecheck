/**
 * DIAGNOSTIC: Why is reached count going DOWN?
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkReachedCountDecreasing() {
  console.log('🔍 Checking why reached count is decreasing...\n');
  
  const { start, end } = getTodayEST();
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // 1. Get ALL reach events from today
  console.log('📊 Getting ALL reach events from today...');
  const { data: reachEvents, error: reachError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('id, agent_email, lead_phone, event_timestamp, call_duration, disposition, notes, created_at')
    .eq('event_type', 'reach')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .order('event_timestamp', { ascending: false });
  
  if (reachError) {
    console.error('❌ Error fetching reach events:', reachError);
    return;
  }
  
  console.log(`✅ Found ${reachEvents?.length || 0} reach events today\n`);
  
  // 2. Check for duplicate reach events (same agent + phone + within 1 hour)
  console.log('🔍 Checking for duplicate reach events...\n');
  const reachMap = new Map<string, any[]>();
  
  for (const event of reachEvents || []) {
    const key = `${event.agent_email?.toLowerCase().trim()}_${event.lead_phone}`;
    if (!reachMap.has(key)) {
      reachMap.set(key, []);
    }
    reachMap.get(key)!.push(event);
  }
  
  const duplicates: Array<{ key: string; events: any[] }> = [];
  for (const [key, events] of reachMap.entries()) {
    if (events.length > 1) {
      // Check if events are within 1 hour of each other
      const sortedEvents = events.sort((a, b) => 
        new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
      );
      
      for (let i = 1; i < sortedEvents.length; i++) {
        const timeDiff = new Date(sortedEvents[i].event_timestamp).getTime() - 
                        new Date(sortedEvents[0].event_timestamp).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff < 1) {
          duplicates.push({ key, events: sortedEvents });
          break;
        }
      }
    }
  }
  
  console.log(`📊 Found ${duplicates.length} sets of duplicate reach events\n`);
  
  if (duplicates.length > 0) {
    console.log('⚠️ DUPLICATE REACH EVENTS (could be causing issues):\n');
    for (const dup of duplicates.slice(0, 10)) {
      const [agentEmail, phone] = dup.key.split('_');
      console.log(`   ${agentEmail} -> ${phone}: ${dup.events.length} reach events`);
      for (const event of dup.events) {
        const timeAgo = Math.round((Date.now() - new Date(event.event_timestamp).getTime()) / 1000 / 60);
        console.log(`      - ID: ${event.id}, ${timeAgo} min ago, Duration: ${event.call_duration}s, Notes: ${event.notes || 'N/A'}`);
      }
    }
    console.log('');
  }
  
  // 3. Check phone number normalization - this could cause distinct counts to change
  console.log('🔍 Checking phone number normalization...\n');
  const phoneVariations = new Map<string, Set<string>>();
  for (const event of reachEvents || []) {
    const original = String(event.lead_phone || '');
    const normalized = original.replace(/\D/g, '');
    if (!phoneVariations.has(normalized)) {
      phoneVariations.set(normalized, new Set());
    }
    phoneVariations.get(normalized)!.add(original);
  }
  
  const phonesWithVariations = Array.from(phoneVariations.entries()).filter(([_, variations]) => variations.size > 1);
  console.log(`   Phone numbers with multiple formats: ${phonesWithVariations.length}`);
  if (phonesWithVariations.length > 0) {
    console.log('   Sample phone variations:');
    for (const [normalized, variations] of phonesWithVariations.slice(0, 5)) {
      console.log(`      ${normalized}: ${Array.from(variations).join(', ')}`);
    }
  }
  
  // 4. Check calculation function - count distinct phones
  console.log('\n🔍 CALCULATION CHECK:\n');
  const distinctReaches = new Set<string>();
  for (const event of reachEvents || []) {
    const phone = String(event.lead_phone || '').replace(/\D/g, '');
    if (phone.length >= 10) {
      const key = `${event.agent_email?.toLowerCase().trim()}_${phone}`;
      distinctReaches.add(key);
    }
  }
  
  console.log(`   Total reach events: ${reachEvents?.length || 0}`);
  console.log(`   Distinct agent+phone pairs: ${distinctReaches.size}`);
  console.log(`   Duplicate events: ${(reachEvents?.length || 0) - distinctReaches.size}\n`);
  
  // 5. Check for events with notes indicating they were auto-created
  console.log('🔍 Checking for auto-created reach events...\n');
  const autoCreated = (reachEvents || []).filter(e => 
    e.notes?.toLowerCase().includes('auto-created') || 
    e.notes?.toLowerCase().includes('backfill') ||
    e.notes?.toLowerCase().includes('45s') ||
    e.notes?.toLowerCase().includes('45 second')
  );
  
  console.log(`   Auto-created reach events: ${autoCreated.length}`);
  if (autoCreated.length > 0) {
    console.log('   Sample auto-created events:');
    for (const event of autoCreated.slice(0, 5)) {
      console.log(`      - ${event.agent_email} -> ${event.lead_phone}: ${event.notes}`);
    }
    console.log('');
  }
  
  // 6. Check time-based filtering - are events falling out of "today"?
  console.log('🔍 TIME-BASED FILTERING CHECK:\n');
  const now = new Date();
  const eventsInRange = (reachEvents || []).filter(e => {
    const eventTime = new Date(e.event_timestamp);
    return eventTime >= start && eventTime < end;
  });
  
  console.log(`   Events in EST date range: ${eventsInRange.length}`);
  console.log(`   Events outside range: ${(reachEvents?.length || 0) - eventsInRange.length}\n`);
  
  // 7. Check if there are any DELETE queries or updates that remove events
  console.log('🔍 Checking for potential data loss...\n');
  
  // Get count of reach events by hour to see if there's a pattern
  const hourlyCounts = new Map<number, number>();
  for (const event of reachEvents || []) {
    const eventTime = new Date(event.event_timestamp);
    const hour = eventTime.getHours();
    hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);
  }
  
  console.log('   Reach events by hour (EST):');
  for (let hour = 0; hour < 24; hour++) {
    const count = hourlyCounts.get(hour) || 0;
    if (count > 0) {
      console.log(`      ${hour}:00 - ${hour}:59: ${count} events`);
    }
  }
  console.log('');
  
  // 8. Check for events that might be getting filtered out
  console.log('🔍 EVENTS THAT MIGHT BE FILTERED OUT:\n');
  const eventsWithoutPhone = (reachEvents || []).filter(e => !e.lead_phone || String(e.lead_phone).replace(/\D/g, '').length < 10);
  const eventsWithoutEmail = (reachEvents || []).filter(e => !e.agent_email);
  const eventsWithoutDuration = (reachEvents || []).filter(e => !e.call_duration || e.call_duration <= 0);
  
  console.log(`   Events without valid phone: ${eventsWithoutPhone.length}`);
  console.log(`   Events without email: ${eventsWithoutEmail.length}`);
  console.log(`   Events without duration: ${eventsWithoutDuration.length}\n`);
  
  console.log('='.repeat(100));
  console.log('\n💡 POSSIBLE CAUSES OF DECREASING COUNT:\n');
  console.log('   1. Duplicate prevention removing events');
  console.log('   2. Events falling out of "today" range due to timezone shifts');
  console.log('   3. Calculation function filtering out invalid events');
  console.log('   4. Events being deleted or updated');
  console.log('   5. Phone number normalization causing distinct counts to change');
  console.log('\n🔧 RECOMMENDATION:');
  console.log('   Check if the calculation function is using DISTINCT correctly');
  console.log('   Verify timezone calculations are consistent');
  console.log('   Check for any cleanup scripts or triggers that might delete events');
}

checkReachedCountDecreasing()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
