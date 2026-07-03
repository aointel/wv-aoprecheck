/**
 * DEBUG: Why is calculation filtering out reach events?
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function debugCalculationFilter() {
  console.log('🔍 Debugging calculation filter...\n');
  
  const { start, end } = getTodayEST();
  
  // Get ALL reach events (what calculation function gets)
  const { data: allReachEvents, error: allError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, agent_name, event_type, lead_phone, event_timestamp')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .in('event_type', ['dial', 'reach', 'booked'])
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '');
  
  if (allError) {
    console.error('❌ Error:', allError);
    return;
  }
  
  console.log(`✅ Fetched ${allReachEvents?.length || 0} total events (dial, reach, booked)\n`);
  
  // Filter to just reach events
  const reachEvents = (allReachEvents || []).filter(e => e.event_type?.toLowerCase() === 'reach');
  console.log(`📊 Reach events: ${reachEvents.length}\n`);
  
  // Simulate the calculation logic
  const agentStatsMap = new Map<string, {
    dialedPhones: Set<string>;
    reachedPhones: Set<string>;
    bookedPhones: Set<string>;
  }>();
  
  let skipped = 0;
  let processed = 0;
  
  for (const event of allReachEvents || []) {
    const email = (event.agent_email || '').toLowerCase().trim();
    if (!email || !event.lead_phone) {
      skipped++;
      continue;
    }
    
    // Normalize phone number (remove non-digits)
    const cleanPhone = String(event.lead_phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      skipped++;
      continue;
    }
    
    processed++;
    
    // Initialize agent stats if not exists
    if (!agentStatsMap.has(email)) {
      agentStatsMap.set(email, {
        dialedPhones: new Set(),
        reachedPhones: new Set(),
        bookedPhones: new Set(),
      });
    }
    
    const stats = agentStatsMap.get(email)!;
    
    // Count distinct phones by event_type
    switch (event.event_type?.toLowerCase()) {
      case 'dial':
        stats.dialedPhones.add(cleanPhone);
        break;
      case 'reach':
        stats.reachedPhones.add(cleanPhone);
        break;
      case 'booked':
        stats.bookedPhones.add(cleanPhone);
        break;
    }
  }
  
  const totalReached = Array.from(agentStatsMap.values()).reduce((sum, s) => sum + s.reachedPhones.size, 0);
  
  console.log('🔍 CALCULATION SIMULATION:\n');
  console.log(`   Total events fetched: ${allReachEvents?.length || 0}`);
  console.log(`   Reach events: ${reachEvents.length}`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Calculated total reached: ${totalReached}\n`);
  
  // Check what was skipped
  if (skipped > 0) {
    console.log('⚠️ EVENTS SKIPPED BY CALCULATION:\n');
    let skippedCount = 0;
    for (const event of allReachEvents || []) {
      const email = (event.agent_email || '').toLowerCase().trim();
      if (!email || !event.lead_phone) {
        skippedCount++;
        if (skippedCount <= 10) {
          console.log(`   - Missing email or phone: email=${!!email}, phone=${!!event.lead_phone}`);
        }
        continue;
      }
      
      const cleanPhone = String(event.lead_phone).replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        skippedCount++;
        if (skippedCount <= 10) {
          console.log(`   - Invalid phone: ${event.lead_phone} -> ${cleanPhone} (length: ${cleanPhone.length})`);
        }
      }
    }
    if (skippedCount > 10) {
      console.log(`   ... and ${skippedCount - 10} more skipped`);
    }
  }
  
  // Compare with raw count
  const rawDistinct = new Set<string>();
  for (const event of reachEvents) {
    const email = (event.agent_email || '').toLowerCase().trim();
    const cleanPhone = String(event.lead_phone || '').replace(/\D/g, '');
    if (email && cleanPhone.length >= 10) {
      rawDistinct.add(`${email}_${cleanPhone}`);
    }
  }
  
  console.log(`\n📊 COMPARISON:\n`);
  console.log(`   Raw distinct phones (from reach events): ${rawDistinct.size}`);
  console.log(`   Calculated total reached: ${totalReached}`);
  console.log(`   Difference: ${rawDistinct.size - totalReached}\n`);
  
  if (rawDistinct.size !== totalReached) {
    console.log('⚠️ MISMATCH DETECTED!\n');
    console.log('   The calculation is missing reach events. Possible causes:');
    console.log('   1. Events are being filtered out by the query');
    console.log('   2. Phone normalization is causing issues');
    console.log('   3. Agent email matching is failing');
  }
}

debugCalculationFilter()
  .then(() => {
    console.log('\n✅ Debug complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
