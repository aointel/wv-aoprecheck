/**
 * Directly update reached stats from agent_dial_metrics
 * This bypasses the SQL function to verify the logic works
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixReachedDirectly() {
  try {
    console.log('🔄 Directly updating reached stats from agent_dial_metrics...\n');

    // Get today's date range in EST timezone
    const now = new Date();
    const estYear = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric' }));
    const estMonth = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', month: '2-digit' }));
    const estDay = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', day: '2-digit' }));
    const estMidnightString = `${estYear}-${String(estMonth).padStart(2, '0')}-${String(estDay).padStart(2, '0')}T00:00:00`;
    let utcTodayStart = new Date(`${estMidnightString}-05:00`); // EST is UTC-5
    const verifyEST = utcTodayStart.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
    const verifyDate = verifyEST.replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
    const expectedDate = `${estYear}-${String(estMonth).padStart(2, '0')}-${String(estDay).padStart(2, '0')}`;
    if (verifyDate !== expectedDate) {
      utcTodayStart = new Date(`${estMidnightString}-04:00`); // EDT is UTC-4
    }
    const utcTodayEnd = new Date(utcTodayStart.getTime() + (24 * 60 * 60 * 1000));
    const todayStart = utcTodayStart.toISOString();
    const todayEnd = utcTodayEnd.toISOString();

    console.log(`📅 Today's range (EST): ${todayStart} to ${todayEnd}\n`);

    // Get all agents with metrics today
    console.log('📊 Fetching reach events from agent_dial_metrics...');
    const { data: reachEvents, error: reachError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, lead_phone')
      .eq('event_type', 'reach')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('agent_email', 'is', null)
      .neq('agent_email', '')
      .not('lead_phone', 'is', null);

    if (reachError) {
      throw new Error(`Failed to fetch reach events: ${reachError.message}`);
    }

    console.log(`✅ Found ${reachEvents?.length || 0} reach events today\n`);

    // Group by agent and count distinct phones
    const reachedByAgent = {};
    if (reachEvents) {
      for (const event of reachEvents) {
        const email = event.agent_email?.toLowerCase().trim();
        const phone = event.lead_phone?.replace(/\D/g, '');
        if (email && phone) {
          if (!reachedByAgent[email]) {
            reachedByAgent[email] = new Set();
          }
          reachedByAgent[email].add(phone);
        }
      }
    }

    console.log(`📊 Updating ${Object.keys(reachedByAgent).length} agents...\n`);

    // Update each agent's reached count
    let updated = 0;
    for (const [email, phoneSet] of Object.entries(reachedByAgent)) {
      const reachedCount = phoneSet.size;
      const { error: updateError } = await supabaseAdmin
        .from('live_call_boardt')
        .update({ 
          today_reached: reachedCount,
          updated_at: new Date().toISOString()
        })
        .eq('agent_email', email);

      if (updateError) {
        console.error(`❌ Failed to update ${email}:`, updateError);
      } else {
        console.log(`✅ ${email}: ${reachedCount} reached`);
        updated++;
      }
    }

    // Also set reached to 0 for agents with no reach events today
    console.log('\n📊 Setting reached to 0 for agents with no reach events...');
    const { data: allAgents } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email')
      .not('agent_email', 'is', null)
      .neq('agent_email', '');

    if (allAgents) {
      for (const agent of allAgents) {
        const email = agent.agent_email?.toLowerCase().trim();
        if (email && !reachedByAgent[email]) {
          const { error } = await supabaseAdmin
            .from('live_call_boardt')
            .update({ 
              today_reached: 0,
              updated_at: new Date().toISOString()
            })
            .eq('agent_email', email);

          if (!error) {
            console.log(`✅ ${email}: 0 reached (no events)`);
          }
        }
      }
    }

    console.log(`\n✅ Updated ${updated} agents with reach events`);
    console.log('✅ Reached stats now match agent_dial_metrics (event_type = reach)');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run it
fixReachedDirectly();
