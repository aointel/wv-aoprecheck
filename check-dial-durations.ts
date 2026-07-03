/**
 * Check if dials are being logged without actual calls (suspicious durations)
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkDialDurations() {
  const { start, end } = getTodayEST();
  
  console.log('🔍 Checking dial durations for today...\n');
  console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Get dials ordered by duration
  const { data: dials } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone, call_duration, disposition, agent_email, event_timestamp')
    .eq('event_type', 'dial')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .order('call_duration', { ascending: true, nullsFirst: true })
    .limit(100);
  
  if (!dials || dials.length === 0) {
    console.log('No dials found');
    return;
  }
  
  console.log(`📊 Found ${dials.length} dials (showing first 100)\n`);
  
  // Check for suspicious durations
  const zeroDurations = dials.filter(d => !d.call_duration || d.call_duration === 0);
  const veryShortDurations = dials.filter(d => d.call_duration && d.call_duration > 0 && d.call_duration < 5);
  const suspiciousDurations = dials.filter(d => d.call_duration && d.call_duration >= 1 && d.call_duration <= 2);
  
  console.log(`⚠️  SUSPICIOUS PATTERNS:`);
  console.log(`   Dials with 0 or null duration: ${zeroDurations.length}`);
  console.log(`   Dials with duration < 5 seconds: ${veryShortDurations.length}`);
  console.log(`   Dials with duration 1-2 seconds (suspicious): ${suspiciousDurations.length}\n`);
  
  if (zeroDurations.length > 0) {
    console.log(`❌ PROBLEM: ${zeroDurations.length} dials have 0 or null duration (should be blocked!)`);
    console.log(`   Sample:`);
    zeroDurations.slice(0, 5).forEach(d => {
      console.log(`     ${d.agent_email} | ${d.lead_phone} | Duration: ${d.call_duration} | ${d.disposition}`);
    });
  }
  
  if (suspiciousDurations.length > 0) {
    console.log(`\n⚠️  ${suspiciousDurations.length} dials with 1-2 second duration (might be fake):`);
    const byAgent = new Map<string, number>();
    suspiciousDurations.forEach(d => {
      const email = d.agent_email || 'unknown';
      byAgent.set(email, (byAgent.get(email) || 0) + 1);
    });
    console.log(`   By agent:`);
    Array.from(byAgent.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([email, count]) => {
        console.log(`     ${email}: ${count}`);
      });
  }
  
  // Show shortest durations
  console.log(`\n📋 Shortest durations:`);
  dials.slice(0, 20).forEach((d, i) => {
    const duration = d.call_duration !== null && d.call_duration !== undefined 
      ? `${d.call_duration}s` 
      : 'null';
    console.log(`   ${(i + 1).toString().padStart(2)}. ${d.agent_email?.substring(0, 30).padEnd(30)} ${d.lead_phone?.substring(0, 15).padEnd(15)} ${duration.padStart(6)} ${d.disposition || 'null'}`);
  });
  
  // Summary
  const totalDials = dials.length;
  const avgDuration = dials
    .filter(d => d.call_duration && d.call_duration > 0)
    .reduce((sum, d) => sum + (d.call_duration || 0), 0) / dials.filter(d => d.call_duration && d.call_duration > 0).length;
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total dials checked: ${totalDials}`);
  console.log(`   Average duration (excluding 0/null): ${avgDuration ? avgDuration.toFixed(2) : 0}s`);
  console.log(`   Dials with duration: ${dials.filter(d => d.call_duration && d.call_duration > 0).length}`);
  console.log(`   Dials without duration: ${zeroDurations.length}`);
  
  if (zeroDurations.length > 0) {
    console.log(`\n💡 CONCLUSION:`);
    console.log(`   ⚠️  ${zeroDurations.length} dials have 0 or null duration.`);
    console.log(`   These should have been blocked by the validation at line 150-153 of agent-dial-metrics-tracker.ts`);
    console.log(`   This suggests either:`);
    console.log(`   1. The validation is being bypassed somehow`);
    console.log(`   2. These dials were logged through a different code path`);
    console.log(`   3. There's a bug in the validation logic`);
  }
}

checkDialDurations()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
