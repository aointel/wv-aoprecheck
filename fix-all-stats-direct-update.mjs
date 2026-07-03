/**
 * Directly update ALL stats (dialed, reached, booked) from agent_dial_metrics and twilio_call_logs
 * This bypasses the SQL function to verify the logic works
 */

import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixAllStatsDirectly() {
  try {
    console.log('🔄 Directly updating ALL stats (dialed, reached, booked) from source tables...\n');

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

    // 1. Get DIALED from twilio_call_logs
    console.log('📊 Fetching dialed stats from twilio_call_logs...');
    const { data: twilioCalls, error: twilioError } = await supabaseAdmin
      .from('twilio_call_logs')
      .select('owner_email, to_number, call_duration, call_status')
      .gte('call_started_at', todayStart)
      .lt('call_started_at', todayEnd)
      .eq('call_direction', 'outbound')
      .not('owner_email', 'is', null)
      .neq('owner_email', '')
      .not('to_number', 'is', null)
      .neq('to_number', '');

    if (twilioError) {
      console.error('❌ Error fetching twilio calls:', twilioError);
    }

    // Count distinct phones per agent (only calls with duration >= 15s and valid status)
    const dialedByAgent = {};
    if (twilioCalls) {
      for (const call of twilioCalls) {
        if (call.call_duration && call.call_duration >= 15) {
          const status = (call.call_status || '').toLowerCase();
          if (!['failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
            const email = call.owner_email?.toLowerCase().trim();
            const phone = call.to_number?.replace(/\D/g, '');
            if (email && phone) {
              if (!dialedByAgent[email]) {
                dialedByAgent[email] = new Set();
              }
              dialedByAgent[email].add(phone);
            }
          }
        }
      }
    }
    console.log(`✅ Found ${Object.keys(dialedByAgent).length} agents with dials\n`);

    // 2. Get REACHED from agent_dial_metrics
    console.log('📊 Fetching reach events from agent_dial_metrics...');
    const { data: reachEvents, error: reachError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, lead_phone, call_duration')
      .eq('event_type', 'reach')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('agent_email', 'is', null)
      .neq('agent_email', '')
      .not('lead_phone', 'is', null);

    if (reachError) {
      console.error('❌ Error fetching reach events:', reachError);
    }

    const reachedByAgent = {};
    if (reachEvents) {
      for (const event of reachEvents) {
        // Only count if has duration > 0
        if (event.call_duration && event.call_duration > 0) {
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
    }
    console.log(`✅ Found ${Object.keys(reachedByAgent).length} agents with reaches\n`);

    // 3. Get BOOKED from agent_dial_metrics
    console.log('📊 Fetching booked events from agent_dial_metrics...');
    const { data: bookedEvents, error: bookedError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, lead_phone, call_duration')
      .eq('event_type', 'booked')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('agent_email', 'is', null)
      .neq('agent_email', '')
      .not('lead_phone', 'is', null);

    if (bookedError) {
      console.error('❌ Error fetching booked events:', bookedError);
    }

    const bookedByAgent = {};
    if (bookedEvents) {
      for (const event of bookedEvents) {
        // Only count if has duration > 0
        if (event.call_duration && event.call_duration > 0) {
          const email = event.agent_email?.toLowerCase().trim();
          const phone = event.lead_phone?.replace(/\D/g, '');
          if (email && phone) {
            if (!bookedByAgent[email]) {
              bookedByAgent[email] = new Set();
            }
            bookedByAgent[email].add(phone);
          }
        }
      }
    }
    console.log(`✅ Found ${Object.keys(bookedByAgent).length} agents with booked\n`);

    // 4. Get INSTANT_PRESENTATION from agent_dial_metrics
    console.log('📊 Fetching instant_presentation events from agent_dial_metrics...');
    const { data: instantPresEvents, error: instantPresError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, lead_phone, call_duration')
      .eq('event_type', 'instant_presentation')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('agent_email', 'is', null)
      .neq('agent_email', '')
      .not('lead_phone', 'is', null);

    if (instantPresError) {
      console.error('❌ Error fetching instant_presentation events:', instantPresError);
    }

    const instantPresByAgent = {};
    if (instantPresEvents) {
      for (const event of instantPresEvents) {
        // Only count if has duration > 0
        if (event.call_duration && event.call_duration > 0) {
          const email = event.agent_email?.toLowerCase().trim();
          const phone = event.lead_phone?.replace(/\D/g, '');
          if (email && phone) {
            if (!instantPresByAgent[email]) {
              instantPresByAgent[email] = new Set();
            }
            instantPresByAgent[email].add(phone);
          }
        }
      }
    }
    console.log(`✅ Found ${Object.keys(instantPresByAgent).length} agents with instant presentations\n`);

    // Combine all unique agents
    const allAgents = new Set();
    Object.keys(dialedByAgent).forEach(e => allAgents.add(e));
    Object.keys(reachedByAgent).forEach(e => allAgents.add(e));
    Object.keys(bookedByAgent).forEach(e => allAgents.add(e));
    Object.keys(instantPresByAgent).forEach(e => allAgents.add(e));

    console.log(`📊 Updating ${allAgents.size} agents in live_call_boardt...\n`);

    // Update each agent
    let updated = 0;
    for (const email of allAgents) {
      const dialed = dialedByAgent[email]?.size || 0;
      const reached = reachedByAgent[email]?.size || 0;
      const booked = bookedByAgent[email]?.size || 0;
      const instantPres = instantPresByAgent[email]?.size || 0;

      const { error: updateError } = await supabaseAdmin
        .from('live_call_boardt')
        .update({ 
          today_dialed: dialed,
          today_reached: reached,
          today_booked: booked,
          today_instant_presentation: instantPres,
          updated_at: new Date().toISOString()
        })
        .eq('agent_email', email);

      if (updateError) {
        console.error(`❌ Failed to update ${email}:`, updateError);
      } else {
        console.log(`✅ ${email}: Dialed=${dialed}, Reached=${reached}, Booked=${booked}, InstantPres=${instantPres}`);
        updated++;
      }
    }

    // Also set to 0 for agents with no events today (if they exist in board)
    console.log('\n📊 Setting stats to 0 for agents with no events today...');
    const { data: allBoardAgents } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email')
      .not('agent_email', 'is', null)
      .neq('agent_email', '');

    if (allBoardAgents) {
      for (const agent of allBoardAgents) {
        const email = agent.agent_email?.toLowerCase().trim();
        if (email && !allAgents.has(email)) {
          const { error } = await supabaseAdmin
            .from('live_call_boardt')
            .update({ 
              today_dialed: 0,
              today_reached: 0,
              today_booked: 0,
              today_instant_presentation: 0,
              updated_at: new Date().toISOString()
            })
            .eq('agent_email', email);

          if (!error) {
            console.log(`✅ ${email}: All stats set to 0 (no events)`);
          }
        }
      }
    }

    console.log(`\n✅ Updated ${updated} agents with events`);
    console.log('✅ All stats now match source tables:');
    console.log('   - DIALED: from twilio_call_logs (duration >= 15s)');
    console.log('   - REACHED: from agent_dial_metrics (event_type = reach, duration > 0)');
    console.log('   - BOOKED: from agent_dial_metrics (event_type = booked, duration > 0)');
    console.log('   - INSTANT_PRESENTATION: from agent_dial_metrics (event_type = instant_presentation, duration > 0)');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run it
fixAllStatsDirectly();
