/**
 * Verify booked stats are correct and fix if needed
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyAndFixBooked() {
  try {
    console.log('🔍 Verifying booked stats...\n');

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

    console.log(`📅 Today's range (EST): ${todayStart} to ${todayEnd}\n`);

    // 1. Check booked events in agent_dial_metrics
    console.log('📊 Checking booked events in agent_dial_metrics...');
    const { data: bookedEvents, error: bookedError } = await supabaseAdmin
      .from('agent_dial_metrics')
      .select('agent_email, lead_phone, call_duration, event_timestamp, disposition')
      .eq('event_type', 'booked')
      .gte('event_timestamp', todayStart)
      .lt('event_timestamp', todayEnd)
      .not('agent_email', 'is', null)
      .neq('agent_email', '');

    if (bookedError) {
      console.error('❌ Error:', bookedError);
      return;
    }

    console.log(`✅ Found ${bookedEvents?.length || 0} booked events total\n`);

    // Count distinct phones per agent (only with duration > 0)
    const bookedByAgent = {};
    const bookedWithoutDuration = [];
    if (bookedEvents) {
      for (const event of bookedEvents) {
        const email = event.agent_email?.toLowerCase().trim();
        const phone = event.lead_phone?.replace(/\D/g, '');
        if (email && phone) {
          if (!event.call_duration || event.call_duration <= 0) {
            bookedWithoutDuration.push({ email, phone, timestamp: event.event_timestamp });
          } else {
            if (!bookedByAgent[email]) {
              bookedByAgent[email] = new Set();
            }
            bookedByAgent[email].add(phone);
          }
        }
      }
    }

    console.log(`📊 Agents with valid booked events (duration > 0): ${Object.keys(bookedByAgent).length}`);
    if (bookedWithoutDuration.length > 0) {
      console.log(`⚠️  Found ${bookedWithoutDuration.length} booked events WITHOUT duration (excluded from count):`);
      bookedWithoutDuration.slice(0, 5).forEach(e => {
        console.log(`   - ${e.email}: ${e.phone} at ${e.timestamp}`);
      });
      if (bookedWithoutDuration.length > 5) {
        console.log(`   ... and ${bookedWithoutDuration.length - 5} more`);
      }
    }
    console.log('');

    // 2. Check what's in live_call_boardt
    console.log('📊 Checking live_call_boardt booked counts...');
    const { data: boardData, error: boardError } = await supabaseAdmin
      .from('live_call_boardt')
      .select('agent_email, today_booked')
      .not('agent_email', 'is', null)
      .neq('agent_email', '');

    if (boardError) {
      console.error('❌ Error:', boardError);
      return;
    }

    const boardBookedMap = new Map();
    (boardData || []).forEach(row => {
      if (row.agent_email) {
        boardBookedMap.set(row.agent_email.toLowerCase().trim(), row.today_booked || 0);
      }
    });

    // 3. Compare and find discrepancies
    console.log('\n🔍 Comparing booked counts...\n');
    const discrepancies = [];
    const allAgents = new Set([...Object.keys(bookedByAgent), ...Array.from(boardBookedMap.keys())]);

    for (const email of allAgents) {
      const expected = bookedByAgent[email]?.size || 0;
      const actual = boardBookedMap.get(email) || 0;
      if (expected !== actual) {
        discrepancies.push({ email, expected, actual });
        console.log(`❌ MISMATCH: ${email}`);
        console.log(`   Expected (from agent_dial_metrics): ${expected}`);
        console.log(`   Actual (in live_call_boardt): ${actual}`);
      }
    }

    if (discrepancies.length === 0) {
      console.log('✅ All booked counts match!');
    } else {
      console.log(`\n⚠️  Found ${discrepancies.length} agents with mismatched booked counts`);
      console.log('\n🔄 Fixing discrepancies...\n');

      // Fix each discrepancy
      for (const { email, expected } of discrepancies) {
        const { error } = await supabaseAdmin
          .from('live_call_boardt')
          .update({ 
            today_booked: expected,
            updated_at: new Date().toISOString()
          })
          .eq('agent_email', email);

        if (error) {
          console.error(`❌ Failed to fix ${email}:`, error);
        } else {
          console.log(`✅ Fixed ${email}: ${expected} booked`);
        }
      }
    }

    // 4. Also set to 0 for agents with no booked events
    console.log('\n📊 Setting booked to 0 for agents with no booked events...');
    for (const [email, boardCount] of boardBookedMap.entries()) {
      if (!bookedByAgent[email] && boardCount > 0) {
        const { error } = await supabaseAdmin
          .from('live_call_boardt')
          .update({ 
            today_booked: 0,
            updated_at: new Date().toISOString()
          })
          .eq('agent_email', email);

        if (!error) {
          console.log(`✅ ${email}: Set to 0 (no booked events)`);
        }
      }
    }

    console.log('\n✅ Verification complete!');
    console.log('\n📋 SUMMARY:');
    console.log(`   Total booked events: ${bookedEvents?.length || 0}`);
    console.log(`   Valid booked events (with duration): ${Object.values(bookedByAgent).reduce((sum, set) => sum + set.size, 0)}`);
    console.log(`   Agents with booked: ${Object.keys(bookedByAgent).length}`);
    console.log(`   Discrepancies found and fixed: ${discrepancies.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyAndFixBooked();
