/**
 * Check which calls in twilio_call_logs have AMD data
 * Run: npx tsx server/scripts/check-amd-calls.ts
 */

import { supabaseAdmin } from '../supabase';

async function checkAmdCalls() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not configured');
    process.exit(1);
  }

  console.log('🔍 Checking AMD data in twilio_call_logs...\n');

  // Get total calls
  const { count: totalCalls } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total calls in database: ${totalCalls?.toLocaleString() || 0}`);

  // Get calls with AMD data
  const { data: callsWithAmd, count: amdCount } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, call_started_at, answered_by, amd_duration_ms, call_duration, call_status, owner_email')
    .not('answered_by', 'is', null)
    .order('call_started_at', { ascending: false })
    .limit(20);

  console.log(`\n✅ Calls with AMD data: ${amdCount || 0}`);
  console.log(`📈 Percentage: ${totalCalls ? ((amdCount || 0) / totalCalls * 100).toFixed(2) : 0}%`);

  // Get breakdown by answered_by value
  const { data: breakdown } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('answered_by')
    .not('answered_by', 'is', null);

  const breakdownMap = new Map<string, number>();
  breakdown?.forEach(call => {
    const value = call.answered_by || 'null';
    breakdownMap.set(value, (breakdownMap.get(value) || 0) + 1);
  });

  console.log(`\n📊 AMD Results Breakdown:`);
  breakdownMap.forEach((count, value) => {
    console.log(`   ${value}: ${count.toLocaleString()}`);
  });

  // Show recent calls with AMD
  if (callsWithAmd && callsWithAmd.length > 0) {
    console.log(`\n📞 Recent calls with AMD data (last 20):`);
    callsWithAmd.forEach((call, idx) => {
      console.log(`\n${idx + 1}. Call SID: ${call.twilio_call_sid}`);
      console.log(`   Started: ${call.call_started_at}`);
      console.log(`   Answered By: ${call.answered_by}`);
      console.log(`   AMD Duration: ${call.amd_duration_ms ? call.amd_duration_ms + 'ms' : 'N/A'}`);
      console.log(`   Call Duration: ${call.call_duration ? call.call_duration + 's' : 'N/A'}`);
      console.log(`   Status: ${call.call_status || 'N/A'}`);
      console.log(`   Owner: ${call.owner_email || 'N/A'}`);
    });
  } else {
    console.log(`\n⚠️  No calls found with AMD data`);
  }

  // Check calls without AMD (recent)
  const { data: callsWithoutAmd } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('twilio_call_sid, call_started_at, call_duration, call_status, owner_email')
    .is('answered_by', null)
    .order('call_started_at', { ascending: false })
    .limit(10);

  if (callsWithoutAmd && callsWithoutAmd.length > 0) {
    console.log(`\n⚠️  Recent calls WITHOUT AMD data (last 10):`);
    callsWithoutAmd.forEach((call, idx) => {
      console.log(`\n${idx + 1}. Call SID: ${call.twilio_call_sid}`);
      console.log(`   Started: ${call.call_started_at}`);
      console.log(`   Duration: ${call.call_duration ? call.call_duration + 's' : 'N/A'}`);
      console.log(`   Status: ${call.call_status || 'N/A'}`);
      console.log(`   Owner: ${call.owner_email || 'N/A'}`);
    });
  }

  // Check calls from last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = yesterday.toISOString();

  const { count: recentTotal } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('call_started_at', yesterdayIso);

  const { count: recentWithAmd } = await supabaseAdmin
    .from('twilio_call_logs')
    .select('*', { count: 'exact', head: true })
    .gte('call_started_at', yesterdayIso)
    .not('answered_by', 'is', null);

  console.log(`\n📅 Last 24 Hours:`);
  console.log(`   Total calls: ${recentTotal?.toLocaleString() || 0}`);
  console.log(`   With AMD: ${recentWithAmd?.toLocaleString() || 0}`);
  console.log(`   Without AMD: ${(recentTotal || 0) - (recentWithAmd || 0)}`);
  if (recentTotal && recentTotal > 0) {
    console.log(`   AMD Coverage: ${((recentWithAmd || 0) / recentTotal * 100).toFixed(2)}%`);
  }
}

checkAmdCalls()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
