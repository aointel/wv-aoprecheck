/**
 * DIAGNOSTIC: Compare source data vs live_call_boardt to find discrepancies
 * This will show EXACTLY what the numbers should be vs what they are
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnoseLeaderboard() {
  try {
    console.log('🔍 DIAGNOSING LEADERBOARD STATS...\n');

    // Get today's date range in EST timezone
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

    console.log(`📅 Today's range (EST): ${todayStart} to ${todayEnd}\n`);

    // 1. Get DIALED from twilio_call_logs
    console.log('📊 STEP 1: Counting DIALED from twilio_call_logs...');
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
    console.log('📊 STEP 2: Counting REACHED from agent_dial_metrics...');
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
    console.log('📊 STEP 3: Counting BOOKED from agent_dial_metrics...');
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

    // 4. Get what's currently in live_call_boardt
    console.log('📊 STEP 4: Checking what\'s in live_call_boardt...');
    const { data: boardData, error: boardError } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email, today_dialed, today_reached, today_booked')
      .not('agent_email', 'is', null)
      .neq('agent_email', '');

    if (boardError) {
      console.error('❌ Error fetching board data:', boardError);
    }

    const boardMap = new Map();
    (boardData || []).forEach(row => {
      if (row.agent_email) {
        boardMap.set(row.agent_email.toLowerCase().trim(), {
          dialed: row.today_dialed || 0,
          reached: row.today_reached || 0,
          booked: row.today_booked || 0
        });
      }
    });
    console.log(`✅ Found ${boardMap.size} agents in live_call_boardt\n`);

    // 5. Compare and show discrepancies
    console.log('🔍 COMPARING SOURCE DATA vs live_call_boardt:\n');
    console.log('='.repeat(100));
    
    const allAgents = new Set();
    Object.keys(dialedByAgent).forEach(e => allAgents.add(e));
    Object.keys(reachedByAgent).forEach(e => allAgents.add(e));
    Object.keys(bookedByAgent).forEach(e => allAgents.add(e));
    Array.from(boardMap.keys()).forEach(e => allAgents.add(e));

    const discrepancies = [];
    const correct = [];

    for (const email of allAgents) {
      const expectedDialed = dialedByAgent[email]?.size || 0;
      const expectedReached = reachedByAgent[email]?.size || 0;
      const expectedBooked = bookedByAgent[email]?.size || 0;
      
      const boardRow = boardMap.get(email);
      const actualDialed = boardRow?.dialed || 0;
      const actualReached = boardRow?.reached || 0;
      const actualBooked = boardRow?.booked || 0;

      const hasDiscrepancy = 
        expectedDialed !== actualDialed ||
        expectedReached !== actualReached ||
        expectedBooked !== actualBooked;

      if (hasDiscrepancy) {
        discrepancies.push({
          email,
          expected: { dialed: expectedDialed, reached: expectedReached, booked: expectedBooked },
          actual: { dialed: actualDialed, reached: actualReached, booked: actualBooked }
        });
      } else if (expectedDialed > 0 || expectedReached > 0 || expectedBooked > 0) {
        correct.push({ email, dialed: expectedDialed, reached: expectedReached, booked: expectedBooked });
      }
    }

    // Show discrepancies
    if (discrepancies.length > 0) {
      console.log(`\n❌ FOUND ${discrepancies.length} AGENTS WITH DISCREPANCIES:\n`);
      discrepancies.forEach(({ email, expected, actual }) => {
        console.log(`📧 ${email}:`);
        console.log(`   DIALED:   Expected=${expected.dialed}  Actual=${actual.dialed}  ${expected.dialed !== actual.dialed ? '❌ MISMATCH' : '✅'}`);
        console.log(`   REACHED:  Expected=${expected.reached}  Actual=${actual.reached}  ${expected.reached !== actual.reached ? '❌ MISMATCH' : '✅'}`);
        console.log(`   BOOKED:   Expected=${expected.booked}  Actual=${actual.booked}  ${expected.booked !== actual.booked ? '❌ MISMATCH' : '✅'}`);
        console.log('');
      });
    } else {
      console.log('\n✅ NO DISCREPANCIES FOUND - All stats match!\n');
    }

    // Show correct ones
    if (correct.length > 0) {
      console.log(`\n✅ ${correct.length} AGENTS WITH CORRECT STATS:\n`);
      correct.slice(0, 10).forEach(({ email, dialed, reached, booked }) => {
        console.log(`   ${email}: Dialed=${dialed}, Reached=${reached}, Booked=${booked}`);
      });
      if (correct.length > 10) {
        console.log(`   ... and ${correct.length - 10} more`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(100));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total agents with activity: ${allAgents.size}`);
    console.log(`   Agents with discrepancies: ${discrepancies.length}`);
    console.log(`   Agents with correct stats: ${correct.length}`);
    console.log(`   Total dialed (source): ${Object.values(dialedByAgent).reduce((sum, set) => sum + set.size, 0)}`);
    console.log(`   Total reached (source): ${Object.values(reachedByAgent).reduce((sum, set) => sum + set.size, 0)}`);
    console.log(`   Total booked (source): ${Object.values(bookedByAgent).reduce((sum, set) => sum + set.size, 0)}`);
    console.log(`   Total dialed (board): ${Array.from(boardMap.values()).reduce((sum, row) => sum + (row.dialed || 0), 0)}`);
    console.log(`   Total reached (board): ${Array.from(boardMap.values()).reduce((sum, row) => sum + (row.reached || 0), 0)}`);
    console.log(`   Total booked (board): ${Array.from(boardMap.values()).reduce((sum, row) => sum + (row.booked || 0), 0)}`);

    if (discrepancies.length > 0) {
      console.log('\n⚠️  PROBLEM IDENTIFIED: live_call_boardt is NOT being updated automatically!');
      console.log('   SOLUTION: Run the SQL function update_live_call_boardt_stats_from_metrics()');
      console.log('   OR: Run fix-all-stats-direct-update.mjs to manually update all stats');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseLeaderboard();
