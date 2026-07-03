/**
 * Check why someone can have instant_presentation but no reach
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkInstantPresWithoutReach() {
  try {
    console.log('🔍 Checking for agents with instant_presentation but no reach...\n');

    // Get today's date range in EST
    const now = new Date();
    const estYear = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric' }));
    const estMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit' }));
    const estDay = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', day: '2-digit' }));
    const estMidnightString = `${estYear}-${String(estMonth).padStart(2, '0')}-${String(estDay).padStart(2, '0')}T00:00:00`;
    let utcTodayStart = new Date(`${estMidnightString}-05:00`);
    const verifyEST = utcTodayStart.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    const verifyDate = verifyEST.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
    const expectedDate = `${estYear}-${String(estMonth).padStart(2, '0')}-${String(estDay).padStart(2, '0')}`;
    if (verifyDate !== expectedDate) {
      utcTodayStart = new Date(`${estMidnightString}-04:00`);
    }
    const utcTodayEnd = new Date(utcTodayStart.getTime() + (24 * 60 * 60 * 1000));
    const todayStart = utcTodayStart.toISOString();
    const todayEnd = utcTodayEnd.toISOString();

    // Find agents with instant_presentation events today
    const { data: instantPresEvents } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, lead_phone, call_duration, event_timestamp')
      .eq('event_type', 'instant_presentation')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('agent_email', 'is', null);

    if (!instantPresEvents || instantPresEvents.length === 0) {
      console.log('✅ No instant_presentation events found today');
      return;
    }

    console.log(`📊 Found ${instantPresEvents.length} instant_presentation events today\n`);

    // Check each one to see if there's a corresponding reach event
    for (const instantPres of instantPresEvents) {
      const { data: reachEvents } = await supabaseAdmin
        .from('agent_dial_metrics')
        .select('id, call_duration, event_timestamp')
        .eq('agent_email', instantPres.agent_email)
        .eq('lead_phone', instantPres.lead_phone)
        .eq('event_type', 'reach')
        .gte('event_timestamp', todayStart)
        .lt('event_timestamp', todayEnd);

      if (!reachEvents || reachEvents.length === 0) {
        console.log(`⚠️ MISSING REACH: ${instantPres.agent_email} -> ${instantPres.lead_phone}`);
        console.log(`   Instant Pres: duration=${instantPres.call_duration || 'null'}, time=${instantPres.event_timestamp}`);
        console.log(`   Reason: No reach event found for this phone number\n`);
      } else {
        console.log(`✅ HAS REACH: ${instantPres.agent_email} -> ${instantPres.lead_phone}`);
        console.log(`   Instant Pres: duration=${instantPres.call_duration || 'null'}`);
        console.log(`   Reach events: ${reachEvents.length}\n`);
      }
    }

    // Check live_call_boardt for mismatches
    console.log('\n📊 Checking live_call_boardt for mismatches...');
    const { data: boardStats } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email, today_reached, today_instant_presentation')
      .gt('today_instant_presentation', 0)
      .limit(20);

    if (boardStats) {
      const mismatches = boardStats.filter(s => 
        (s.today_instant_presentation || 0) > 0 && 
        (s.today_reached || 0) === 0
      );

      if (mismatches.length > 0) {
        console.log(`\n⚠️ Found ${mismatches.length} agents with instant_presentation but no reach:`);
        mismatches.forEach(m => {
          console.log(`   ${m.agent_email}: ${m.today_instant_presentation} instant pres, ${m.today_reached} reached`);
        });
      } else {
        console.log('✅ No mismatches found - all agents with instant_presentation also have reach');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkInstantPresWithoutReach();
