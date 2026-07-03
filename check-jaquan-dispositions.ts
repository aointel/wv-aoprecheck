/**
 * Check why jaquangoodridge has so many dials but few reaches
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkJaquanDispositions() {
  const email = 'jaquangoodridge@aoglobelife.com';
  const { start, end } = getTodayEST();
  
  console.log(`🔍 Checking ${email}...\n`);
  console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Get all dials
  const { data: allDials } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone, event_type, disposition, call_duration, event_timestamp')
    .eq('agent_email', email)
    .eq('event_type', 'dial')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .limit(100000);
  
  // Get all reaches
  const { data: allReaches } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('lead_phone, event_type, disposition, call_duration, event_timestamp')
    .eq('agent_email', email)
    .eq('event_type', 'reach')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .limit(100000);
  
  const distinctDials = new Set((allDials || []).map(d => d.lead_phone));
  const distinctReaches = new Set((allReaches || []).map(r => r.lead_phone));
  
  console.log(`📊 STATS:`);
  console.log(`   Total dial events: ${allDials?.length || 0}`);
  console.log(`   Distinct dial phones: ${distinctDials.size}`);
  console.log(`   Total reach events: ${allReaches?.length || 0}`);
  console.log(`   Distinct reach phones: ${distinctReaches.size}`);
  console.log(`   Reach rate: ${distinctDials.size > 0 ? Math.round((distinctReaches.size / distinctDials.size) * 100) : 0}%\n`);
  
  // Analyze dispositions
  const dispositionCounts: Record<string, number> = {};
  (allDials || []).forEach(d => {
    const disp = d.disposition || 'null';
    dispositionCounts[disp] = (dispositionCounts[disp] || 0) + 1;
  });
  
  console.log(`📋 DIAL DISPOSITION BREAKDOWN:`);
  Object.entries(dispositionCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([disp, count]) => {
      const pct = ((count / (allDials?.length || 1)) * 100).toFixed(1);
      console.log(`   ${disp.padEnd(30)}: ${String(count).padStart(4)} (${pct}%)`);
    });
  
  console.log(`\n📋 REACH DISPOSITION BREAKDOWN:`);
  if (allReaches && allReaches.length > 0) {
    const reachDispositionCounts: Record<string, number> = {};
    (allReaches || []).forEach(r => {
      const disp = r.disposition || 'null';
      reachDispositionCounts[disp] = (reachDispositionCounts[disp] || 0) + 1;
    });
    Object.entries(reachDispositionCounts).forEach(([disp, count]) => {
      console.log(`   ${disp.padEnd(30)}: ${String(count).padStart(4)}`);
    });
  } else {
    console.log(`   No reaches found`);
  }
  
  // Check for dials with duration > 45s (should auto-reach)
  const dialsWithLongDuration = (allDials || []).filter(d => d.call_duration && d.call_duration > 45);
  console.log(`\n⏱️  DIALS WITH DURATION > 45s (should auto-reach): ${dialsWithLongDuration.length}`);
  
  if (dialsWithLongDuration.length > 0) {
    console.log(`   These dials should have triggered reach events but didn't:`);
    const longDurationDispositions: Record<string, number> = {};
    dialsWithLongDuration.forEach(d => {
      const disp = d.disposition || 'null';
      longDurationDispositions[disp] = (longDurationDispositions[disp] || 0) + 1;
    });
    Object.entries(longDurationDispositions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([disp, count]) => {
        console.log(`     ${disp}: ${count}`);
      });
    
    // Check if these phones have reach events
    const longDurationPhones = new Set(dialsWithLongDuration.map(d => d.lead_phone));
    const missingReaches = Array.from(longDurationPhones).filter(phone => !distinctReaches.has(phone));
    console.log(`\n   ❌ Missing reach events for ${missingReaches.length} phones with duration > 45s`);
    if (missingReaches.length > 0 && missingReaches.length <= 10) {
      console.log(`   Missing phones: ${missingReaches.join(', ')}`);
    }
  }
  
  // Check for dials with "not reached" dispositions that have duration > 0
  const notReachedDispositions = ['no_answer', 'busy', 'failed', 'voicemail', 'bad_number', 'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number'];
  const dialsWithNotReachedButDuration = (allDials || []).filter(d => {
    const disp = (d.disposition || '').toLowerCase();
    return notReachedDispositions.includes(disp) && d.call_duration && d.call_duration > 0;
  });
  
  console.log(`\n⚠️  DIALS WITH "NOT REACHED" DISPOSITION BUT HAVE DURATION > 0: ${dialsWithNotReachedButDuration.length}`);
  if (dialsWithNotReachedButDuration.length > 0) {
    const suspiciousDispositions: Record<string, { count: number; totalDuration: number }> = {};
    dialsWithNotReachedButDuration.forEach(d => {
      const disp = d.disposition || 'null';
      if (!suspiciousDispositions[disp]) {
        suspiciousDispositions[disp] = { count: 0, totalDuration: 0 };
      }
      suspiciousDispositions[disp].count++;
      suspiciousDispositions[disp].totalDuration += d.call_duration || 0;
    });
    Object.entries(suspiciousDispositions)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .forEach(([disp, stats]) => {
        const avgDuration = Math.round(stats.totalDuration / stats.count);
        console.log(`     ${disp.padEnd(30)}: ${stats.count} calls, avg duration: ${avgDuration}s`);
      });
  }
  
  // Check if long-duration dials have corresponding reach events
  console.log(`\n🔍 CHECKING LONG-DURATION DIALS FOR MISSING REACH EVENTS:`);
  const longDials = (allDials || []).filter(d => d.call_duration && d.call_duration > 45);
  const reachPhonesSet = new Set((allReaches || []).map(r => r.lead_phone));
  
  let missingReaches = 0;
  for (const dial of longDials) {
    if (!reachPhonesSet.has(dial.lead_phone)) {
      missingReaches++;
      if (missingReaches <= 5) {
        console.log(`   ❌ Missing reach: Phone ${dial.lead_phone}, Duration ${dial.call_duration}s, Disposition: ${dial.disposition}`);
      }
    }
  }
  
  if (missingReaches > 5) {
    console.log(`   ... and ${missingReaches - 5} more missing reach events`);
  }
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total dials: ${distinctDials.size}`);
  console.log(`   Total reaches: ${distinctReaches.size}`);
  console.log(`   Reach rate: ${distinctDials.size > 0 ? Math.round((distinctReaches.size / distinctDials.size) * 100) : 0}%`);
  console.log(`   Dials with "no_answer_vm": ${dispositionCounts['no_answer_vm'] || 0} (${((dispositionCounts['no_answer_vm'] || 0) / (allDials?.length || 1) * 100).toFixed(1)}%)`);
  console.log(`   Long-duration dials (>45s): ${longDials.length}`);
  console.log(`   Missing reach events for long calls: ${missingReaches}`);
  console.log(`\n💡 CONCLUSION:`);
  console.log(`   The agent is marking ${((dispositionCounts['no_answer_vm'] || 0) / (allDials?.length || 1) * 100).toFixed(1)}% of calls as "no_answer_vm" (voicemail),`);
  console.log(`   which is a "not reached" disposition. This is why the reach rate is so low.`);
  if (missingReaches > 0) {
    console.log(`   Additionally, ${missingReaches} calls with duration > 45s are missing reach events.`);
  }
}

checkJaquanDispositions()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
