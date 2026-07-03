/**
 * Check current reached count vs what we expect
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkReachedCount() {
  console.log('🔍 Checking reached count...\n');
  
  const { start, end } = getTodayEST();
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Get ALL reach events (no limit)
  console.log('📊 Getting ALL reach events...');
  const { data: reachEvents, error: reachError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, lead_phone, event_timestamp, call_duration, disposition')
    .eq('event_type', 'reach')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '')
    .limit(100000);
  
  if (reachError) {
    console.error('❌ Error:', reachError);
    return;
  }
  
  console.log(`✅ Found ${reachEvents?.length || 0} reach events (with limit 100000)\n`);
  
  // Count distinct phones
  const distinctPhones = new Set<string>();
  for (const event of reachEvents || []) {
    const email = (event.agent_email || '').toLowerCase().trim();
    const cleanPhone = String(event.lead_phone || '').replace(/\D/g, '');
    if (email && cleanPhone.length >= 10) {
      distinctPhones.add(`${email}_${cleanPhone}`);
    }
  }
  
  console.log(`📊 DISTINCT REACHES: ${distinctPhones.size}\n`);
  
  // Check if we're hitting Supabase's limit
  if (reachEvents && reachEvents.length === 1000) {
    console.log('⚠️ WARNING: Got exactly 1000 events - might be hitting Supabase default limit!\n');
  }
  
  // Get total count using count query
  const { count: totalCount, error: countError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reach')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '');
  
  if (countError) {
    console.error('❌ Count error:', countError);
  } else {
    console.log(`📊 TOTAL REACH EVENTS IN DB: ${totalCount || 0}`);
    if (totalCount && totalCount > (reachEvents?.length || 0)) {
      console.log(`⚠️ MISSING ${totalCount - (reachEvents?.length || 0)} reach events!`);
      console.log(`   Query returned ${reachEvents?.length || 0} but DB has ${totalCount}`);
    }
  }
}

checkReachedCount()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
