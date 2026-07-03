/**
 * DIAGNOSTIC: Why are reaches not being logged?
 * 
 * This script analyzes agent_dial_metrics to find:
 * 1. Agents with dials but no reaches
 * 2. What dispositions are being used
 * 3. Whether duration is being sent correctly
 */

import { supabaseAdmin } from './server/supabase';

async function diagnoseReachIssue() {
  console.log('🔍 Diagnosing reach logging issue...\n');
  
  // Get today's date range in EST
  const now = new Date();
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const estDateParts = estFormatter.formatToParts(now);
  const year = estDateParts.find(p => p.type === 'year')!.value;
  const month = estDateParts.find(p => p.type === 'month')!.value;
  const day = estDateParts.find(p => p.type === 'day')!.value;
  
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  let isDST = false;
  if (monthNum > 3 && monthNum < 11) {
    isDST = true;
  } else if (monthNum === 3 && dayNum >= 10) {
    isDST = true;
  } else if (monthNum === 11 && dayNum < 3) {
    isDST = true;
  }
  
  const offsetHours = isDST ? -4 : -5;
  const offsetStr = offsetHours < 0 
    ? `-${Math.abs(offsetHours).toString().padStart(2, '0')}:00`
    : `+${offsetHours.toString().padStart(2, '0')}:00`;
  
  const start = new Date(`${year}-${month}-${day}T00:00:00${offsetStr}`);
  const end = new Date(`${year}-${month}-${day}T23:59:59.999${offsetStr}`);
  
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // Get all dial events from today
  const { data: dialEvents, error: dialError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, agent_name, lead_phone, disposition, call_duration, event_timestamp')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .eq('event_type', 'dial')
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '');
  
  if (dialError) {
    console.error('❌ Error fetching dial events:', dialError);
    return;
  }
  
  // Get all reach events from today
  const { data: reachEvents, error: reachError } = await supabaseAdmin
    .from('agent_dial_metrics')
    .select('agent_email, lead_phone, event_timestamp')
    .gte('event_timestamp', start.toISOString())
    .lt('event_timestamp', end.toISOString())
    .eq('event_type', 'reach')
    .not('lead_phone', 'is', null)
    .neq('lead_phone', '');
  
  if (reachError) {
    console.error('❌ Error fetching reach events:', reachError);
    return;
  }
  
  console.log(`📊 Found ${dialEvents?.length || 0} dial events`);
  console.log(`📊 Found ${reachEvents?.length || 0} reach events\n`);
  
  // Group by agent
  const agentStats = new Map<string, {
    agentName?: string;
    dials: typeof dialEvents;
    reaches: typeof reachEvents;
    dispositions: Map<string, number>;
    durations: number[];
  }>();
  
  for (const dial of dialEvents || []) {
    const email = (dial.agent_email || '').toLowerCase().trim();
    if (!email) continue;
    
    if (!agentStats.has(email)) {
      agentStats.set(email, {
        agentName: dial.agent_name,
        dials: [],
        reaches: [],
        dispositions: new Map(),
        durations: []
      });
    }
    
    const stats = agentStats.get(email)!;
    stats.dials.push(dial);
    
    const disp = (dial.disposition || 'null').toLowerCase();
    stats.dispositions.set(disp, (stats.dispositions.get(disp) || 0) + 1);
    
    if (dial.call_duration) {
      stats.durations.push(dial.call_duration);
    }
  }
  
  // Add reach events
  for (const reach of reachEvents || []) {
    const email = (reach.agent_email || '').toLowerCase().trim();
    if (!email) continue;
    
    if (!agentStats.has(email)) {
      agentStats.set(email, {
        dials: [],
        reaches: [],
        dispositions: new Map(),
        durations: []
      });
    }
    
    agentStats.get(email)!.reaches.push(reach);
  }
  
  // Find agents with dials but no reaches
  console.log('🔍 AGENTS WITH DIALS BUT NO REACHES:\n');
  console.log('='.repeat(100));
  
  const problemAgents: Array<{
    email: string;
    name?: string;
    dialCount: number;
    reachCount: number;
    dispositions: Map<string, number>;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
  }> = [];
  
  for (const [email, stats] of agentStats.entries()) {
    if (stats.dials.length > 0 && stats.reaches.length === 0) {
      const dialCount = stats.dials.length;
      const reachCount = stats.reaches.length;
      
      const durations = stats.durations.filter(d => d > 0);
      const avgDuration = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;
      const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
      const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
      
      problemAgents.push({
        email,
        name: stats.agentName,
        dialCount,
        reachCount,
        dispositions: stats.dispositions,
        avgDuration,
        minDuration,
        maxDuration
      });
    }
  }
  
  // Sort by dial count (highest first)
  problemAgents.sort((a, b) => b.dialCount - a.dialCount);
  
  for (const agent of problemAgents) {
    console.log(`\n👤 ${agent.name || 'Unknown'} (${agent.email})`);
    console.log(`   Dials: ${agent.dialCount}, Reaches: ${agent.reachCount}`);
    console.log(`   Duration: avg=${agent.avgDuration.toFixed(1)}s, min=${agent.minDuration}s, max=${agent.maxDuration}s`);
    console.log(`   Dispositions:`);
    
    // Sort dispositions by count
    const sortedDisps = Array.from(agent.dispositions.entries())
      .sort((a, b) => b[1] - a[1]);
    
    for (const [disp, count] of sortedDisps) {
      const percentage = ((count / agent.dialCount) * 100).toFixed(1);
      console.log(`      - ${disp}: ${count} (${percentage}%)`);
    }
  }
  
  console.log('\n' + '='.repeat(100));
  console.log(`\n📊 SUMMARY: ${problemAgents.length} agents with dials but no reaches`);
  console.log(`   Total dials: ${problemAgents.reduce((sum, a) => sum + a.dialCount, 0)}`);
  console.log(`   Total reaches: ${problemAgents.reduce((sum, a) => sum + a.reachCount, 0)}`);
  
  // Check for common issues
  console.log('\n🔍 COMMON ISSUES DETECTED:\n');
  
  const allDispositions = new Map<string, number>();
  for (const agent of problemAgents) {
    for (const [disp, count] of agent.dispositions.entries()) {
      allDispositions.set(disp, (allDispositions.get(disp) || 0) + count);
    }
  }
  
  const notReachedDisps = ['no_answer', 'busy', 'failed', 'voicemail', 'bad_number', 
    'no_answer_vm', 'no_answer_voicemail', 'wrong_number', 'wrong number'];
  
  let notReachedCount = 0;
  for (const disp of notReachedDisps) {
    notReachedCount += allDispositions.get(disp) || 0;
  }
  
  const totalDials = problemAgents.reduce((sum, a) => sum + a.dialCount, 0);
  const notReachedPercentage = totalDials > 0 ? (notReachedCount / totalDials * 100).toFixed(1) : '0';
  
  console.log(`   Dispositions that NEVER count as reached: ${notReachedCount} (${notReachedPercentage}%)`);
  console.log(`   These include: no_answer, voicemail, wrong_number, etc.`);
  
  // Check if there are dials with duration > 0 but disposition not in notReached list
  let potentialReaches = 0;
  for (const agent of problemAgents) {
    for (const dial of agent.dispositions.entries()) {
      const [disp, count] = dial;
      if (!notReachedDisps.includes(disp.toLowerCase())) {
        potentialReaches += count;
      }
    }
  }
  
  console.log(`   Dials with dispositions that COULD be reached: ${potentialReaches} (${((potentialReaches / totalDials) * 100).toFixed(1)}%)`);
  console.log(`   These should have logged reach events if duration > 0`);
}

diagnoseReachIssue()
  .then(() => {
    console.log('\n✅ Diagnosis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
