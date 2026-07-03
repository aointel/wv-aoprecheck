/**
 * Verify and fix the reached calculation function
 * This checks what the current function does and provides a fix
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyAndFix() {
  try {
    console.log('🔍 Verifying current reached calculation...\n');

    // Test: Get a sample agent's stats
    const testAgent = 'rochellemagpantay@aoglobelife.com';
    
    // Count reach events from agent_dial_metrics
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

    // Count reach events for test agent
    const { data: reachEvents, error: reachError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('lead_phone')
      .eq('agent_email', testAgent)
      .eq('event_type', 'reach')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('lead_phone', 'is', null);

    const distinctPhones = new Set(reachEvents?.map(e => e.lead_phone?.replace(/\D/g, '')).filter(Boolean) || []);
    const expectedReached = distinctPhones.size;

    // Get current value from live_call_boardt
    const { data: currentStats, error: statsError } = await supabaseAdmin
      .from('live_call_boardt')
      .select('today_reached')
      .eq('agent_email', testAgent)
      .maybeSingle();

    const currentReached = currentStats?.today_reached || 0;

    console.log(`📊 Test Agent: ${testAgent}`);
    console.log(`   Expected reached (from agent_dial_metrics): ${expectedReached}`);
    console.log(`   Current reached (in live_call_boardt): ${currentReached}`);
    console.log(`   Match: ${expectedReached === currentReached ? '✅' : '❌ MISMATCH'}\n`);

    if (expectedReached !== currentReached) {
      console.log('⚠️ MISMATCH DETECTED - The SQL function is not working correctly!');
      console.log('📄 You MUST run fix-reached-calculation-now.sql in Supabase SQL Editor');
      console.log('   This will update both functions to count reached from event_type = reach\n');
    } else {
      console.log('✅ Reached count matches - function is working correctly\n');
    }

    // Also check if trigger function exists and what it does
    console.log('🔍 Checking if trigger function needs updating...');
    console.log('   The trigger function update_live_call_boardt_stats_for_agent() also needs to be fixed');
    console.log('   It fires on every agent_dial_metrics insert and might be overwriting reached\n');

    console.log('📋 SUMMARY:');
    console.log('   1. Run fix-reached-calculation-now.sql in Supabase SQL Editor');
    console.log('   2. This updates both functions to count reached from event_type = reach');
    console.log('   3. The scheduler will then keep reached updated correctly');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run it
verifyAndFix();
