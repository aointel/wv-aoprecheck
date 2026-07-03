/**
 * DIAGNOSTIC: Track reached count over time to see when it decreases
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkReachedTimeSeries() {
  console.log('🔍 Tracking reached count over time...\n');
  
  const { start, end } = getTodayEST();
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Get ALL reach events from today, ordered by timestamp
  const { data: reachEvents, error: reachError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('id, agent_email, lead_phone, event_timestamp, call_duration, disposition, notes, created_at')
    .eq('event_type', 'reach')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .order('event_timestamp', { ascending: true });
  
  if (reachError) {
    console.error('❌ Error fetching reach events:', reachError);
    return;
  }
  
  console.log(`✅ Found ${reachEvents?.length || 0} reach events today\n`);
  
  // Build time series - count distinct phones at each point in time
  const timeSeries: Array<{ time: Date; totalEvents: number; distinctPhones: number }> = [];
  const seenPhones = new Set<string>();
  
  for (const event of reachEvents || []) {
    const eventTime = new Date(event.event_timestamp);
    const cleanPhone = String(event.lead_phone || '').replace(/\D/g, '');
    const key = `${event.agent_email?.toLowerCase().trim()}_${cleanPhone}`;
    
    seenPhones.add(key);
    
    // Record every 10 events or every 5 minutes
    if (timeSeries.length === 0 || 
        seenPhones.size % 10 === 0 || 
        (eventTime.getTime() - timeSeries[timeSeries.length - 1].time.getTime()) > 5 * 60 * 1000) {
      timeSeries.push({
        time: eventTime,
        totalEvents: timeSeries.length + 1,
        distinctPhones: seenPhones.size
      });
    }
  }
  
  // Add final count
  if (reachEvents && reachEvents.length > 0) {
    timeSeries.push({
      time: new Date(),
      totalEvents: reachEvents.length,
      distinctPhones: seenPhones.size
    });
  }
  
  console.log('📊 REACHED COUNT TIME SERIES:\n');
  console.log('Time'.padEnd(25) + 'Total Events'.padStart(15) + 'Distinct Phones'.padStart(18));
  console.log('-'.repeat(60));
  
  for (const point of timeSeries) {
    const timeStr = point.time.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
    const trend = timeSeries.length > 1 && point !== timeSeries[0] 
      ? (point.distinctPhones > timeSeries[timeSeries.indexOf(point) - 1].distinctPhones ? '↑' : 
         point.distinctPhones < timeSeries[timeSeries.indexOf(point) - 1].distinctPhones ? '↓' : '→')
      : '';
    console.log(
      timeStr.padEnd(25) + 
      String(point.totalEvents).padStart(15) + 
      (String(point.distinctPhones) + trend).padStart(18)
    );
  }
  
  // Check for decreases
  console.log('\n🔍 CHECKING FOR DECREASES:\n');
  let decreases = 0;
  for (let i = 1; i < timeSeries.length; i++) {
    const prev = timeSeries[i - 1];
    const curr = timeSeries[i];
    if (curr.distinctPhones < prev.distinctPhones) {
      decreases++;
      const diff = prev.distinctPhones - curr.distinctPhones;
      console.log(`   ⚠️ DECREASE at ${curr.time.toLocaleTimeString()}: ${prev.distinctPhones} → ${curr.distinctPhones} (lost ${diff})`);
    }
  }
  
  if (decreases === 0) {
    console.log('   ✅ No decreases found - count is only increasing');
  }
  
  // Check current calculation
  console.log('\n🔍 CURRENT CALCULATION:\n');
  const { calculateDialReachBookedRealtime } = await import('./server/scripts/calculate-dial-reach-booked-realtime.js');
  const stats = await calculateDialReachBookedRealtime();
  const totalReached = stats.reduce((sum, s) => sum + s.reached, 0);
  
  console.log(`   Total reached from calculation function: ${totalReached}`);
  console.log(`   Distinct phones from raw data: ${seenPhones.size}`);
  console.log(`   Total reach events: ${reachEvents?.length || 0}\n`);
  
  if (totalReached !== seenPhones.size) {
    console.log(`   ⚠️ MISMATCH: Calculation shows ${totalReached} but raw data shows ${seenPhones.size} distinct phones!`);
  }
}

checkReachedTimeSeries()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
