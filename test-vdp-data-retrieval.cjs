/**
 * Test VDP Data Retrieval
 * This script tests all sources of VDP data to prove they're working
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load Supabase config from hardcoded values
const supabaseUrl = process.env.SUPABASE_URL || 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set!');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testVDPDataRetrieval() {
  console.log('🔍 TESTING VDP DATA RETRIEVAL\n');
  console.log('='.repeat(80));
  
  // Calculate current week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  
  console.log(`📅 Week: ${weekStartStr} to ${weekEndStr}\n`);
  
  // TEST 1: Query agent_availability_tracking table
  console.log('TEST 1: Querying agent_availability_tracking table');
  console.log('-'.repeat(80));
  try {
    const { data: availabilityData, error: availabilityError } = await supabaseAdmin
      .from('agent_availability_tracking')
      .select('agent_email, agent_id, total_available_time, tracking_date, current_status')
      .gte('tracking_date', weekStartStr)
      .lte('tracking_date', weekEndStr)
      .order('tracking_date', { ascending: false })
      .limit(20);
    
    if (availabilityError) {
      console.error('❌ Error:', JSON.stringify(availabilityError, null, 2));
    } else {
      console.log(`✅ Found ${availabilityData?.length || 0} records`);
      if (availabilityData && availabilityData.length > 0) {
        console.log('\n📊 Sample records:');
        availabilityData.slice(0, 5).forEach((record, idx) => {
          const minutes = Math.round((record.total_available_time || 0) / 60);
          console.log(`  ${idx + 1}. ${record.agent_email || 'NO EMAIL'} (${record.agent_id || 'NO ID'})`);
          console.log(`     Date: ${record.tracking_date}, Time: ${minutes} min, Status: ${record.current_status || 'N/A'}`);
        });
        
        // Aggregate by email
        const vdpTimeByAgent = {};
        availabilityData.forEach(record => {
          const email = record.agent_email?.toLowerCase();
          if (email) {
            if (!vdpTimeByAgent[email]) {
              vdpTimeByAgent[email] = { totalSeconds: 0, records: 0 };
            }
            vdpTimeByAgent[email].totalSeconds += (record.total_available_time || 0);
            vdpTimeByAgent[email].records += 1;
          }
        });
        
        console.log('\n📊 Aggregated VDP time by agent:');
        Object.entries(vdpTimeByAgent)
          .sort((a, b) => b[1].totalSeconds - a[1].totalSeconds)
          .slice(0, 10)
          .forEach(([email, data]) => {
            const minutes = Math.round(data.totalSeconds / 60);
            console.log(`  ${email}: ${minutes} min (${data.records} records)`);
          });
      } else {
        console.log('⚠️  No availability data found for this week');
      }
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n');
  
  // TEST 2: Query vdp_calls table
  console.log('TEST 2: Querying vdp_calls table for CONNECT events');
  console.log('-'.repeat(80));
  try {
    const { data: vdpCalls, error: vdpCallsError } = await supabaseAdmin
      .from('vdp_calls')
      .select('company_email, event, duration, time')
      .eq('event', 'CONNECT')
      .gte('time', weekStart.toISOString())
      .order('time', { ascending: false })
      .limit(20);
    
    if (vdpCallsError) {
      console.error('❌ Error:', JSON.stringify(vdpCallsError, null, 2));
    } else {
      console.log(`✅ Found ${vdpCalls?.length || 0} CONNECT events`);
      if (vdpCalls && vdpCalls.length > 0) {
        console.log('\n📊 Sample VDP calls:');
        vdpCalls.slice(0, 5).forEach((call, idx) => {
          const durationMinutes = call.duration ? Math.round(parseFloat(String(call.duration)) / 60) : 0;
          console.log(`  ${idx + 1}. ${call.company_email || 'NO EMAIL'}`);
          console.log(`     Time: ${call.time}, Duration: ${durationMinutes} min`);
        });
        
        // Aggregate by email
        const vdpConnectsByAgent = {};
        vdpCalls.forEach(call => {
          const email = call.company_email?.toLowerCase();
          if (email) {
            if (!vdpConnectsByAgent[email]) {
              vdpConnectsByAgent[email] = { count: 0, minutes: 0 };
            }
            vdpConnectsByAgent[email].count += 1;
            if (call.duration) {
              const durationMinutes = Math.round(parseFloat(String(call.duration)) / 60);
              vdpConnectsByAgent[email].minutes += durationMinutes;
            } else {
              vdpConnectsByAgent[email].minutes += 1;
            }
          }
        });
        
        console.log('\n📊 Aggregated VDP connects by agent:');
        Object.entries(vdpConnectsByAgent)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .forEach(([email, data]) => {
            console.log(`  ${email}: ${data.count} connects, ${data.minutes} min total`);
          });
      } else {
        console.log('⚠️  No VDP CONNECT events found for this week');
      }
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n');
  
  // TEST 3: Check Taalk VDP Poller (requires server to be running)
  console.log('TEST 3: Checking if Taalk VDP Poller is accessible');
  console.log('-'.repeat(80));
  console.log('⚠️  This test requires the server to be running');
  console.log('    The poller is accessed via: const { taalkVDPPoller } = await import(\'./taalk-vdp-poller\');');
  console.log('    To test this, you need to call the /api/usage/weekly-stats-all endpoint');
  console.log('    and check the server logs for poller output.\n');
  
  // TEST 4: Query weekly_usage_stats to see what's stored
  console.log('TEST 4: Querying weekly_usage_stats table');
  console.log('-'.repeat(80));
  try {
    const { data: weeklyStats, error: weeklyError } = await supabaseAdmin
      .from('weekly_usage_stats')
      .select('agent_email, week_start_date, vdp_connects_received, vdp_total_minutes, total_online_minutes')
      .eq('week_start_date', weekStartStr)
      .order('vdp_total_minutes', { ascending: false, nullsFirst: false })
      .limit(10);
    
    if (weeklyError) {
      console.error('❌ Error:', JSON.stringify(weeklyError, null, 2));
    } else {
      console.log(`✅ Found ${weeklyStats?.length || 0} records for this week`);
      if (weeklyStats && weeklyStats.length > 0) {
        console.log('\n📊 Weekly usage stats (top 10 by VDP time):');
        weeklyStats.forEach((stat, idx) => {
          console.log(`  ${idx + 1}. ${stat.agent_email}`);
          console.log(`     VDP Connects: ${stat.vdp_connects_received || 0}, VDP Time: ${stat.vdp_total_minutes || 0} min, Online: ${stat.total_online_minutes || 0} min`);
        });
      } else {
        console.log('⚠️  No weekly stats found for this week');
      }
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n');
  console.log('='.repeat(80));
  console.log('✅ TEST COMPLETE');
  console.log('\nSUMMARY:');
  console.log('  - Check TEST 1 results: Are there availability records?');
  console.log('  - Check TEST 2 results: Are there VDP CONNECT events?');
  console.log('  - Check TEST 4 results: What does weekly_usage_stats show?');
  console.log('  - For TEST 3 (Poller): Check server logs when calling /api/usage/weekly-stats-all');
}

// Run the test
testVDPDataRetrieval()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
