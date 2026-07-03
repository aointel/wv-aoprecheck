/**
 * DIAGNOSTIC: Check why connects aren't showing on leaderboard
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function checkLeaderboardConnects() {
  console.log('🔍 Checking why connects aren\'t showing on leaderboard...\n');
  
  const { start, end } = getTodayEST();
  console.log(`📅 Today's date range (EST): ${start.toISOString()} to ${end.toISOString()}\n`);
  
  // 1. Get connects from vdp_calls (what leaderboard is using)
  console.log('📊 Getting connects from vdp_calls (leaderboard source)...');
  const { data: vdpCalls, error: vdpError } = await supabaseAdmin
    .from('vdp_calls')
    .select('company_email, event, updated_at, time')
    .or('event.eq.END,event.eq.end')
    .gte('updated_at', start.toISOString())
    .lt('updated_at', end.toISOString())
    .not('company_email', 'is', null)
    .neq('company_email', '');
  
  if (vdpError) {
    console.error('❌ Error fetching vdp_calls:', vdpError);
  } else {
    console.log(`✅ Found ${vdpCalls?.length || 0} vdp_calls with event=END\n`);
  }
  
  // 2. Get connects from billing_transactions (alternative source)
  console.log('📊 Getting connects from billing_transactions...');
  const { data: billingConnects, error: billingError } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email, transaction_date, source_table, source_id')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '');
  
  if (billingError) {
    console.error('❌ Error fetching billing_transactions:', billingError);
  } else {
    console.log(`✅ Found ${billingConnects?.length || 0} connects in billing_transactions\n`);
  }
  
  // 3. Get ALL vdp_calls (not just END events) - maybe connects should be ALL calls?
  console.log('📊 Getting ALL vdp_calls (any event)...');
  const { data: allVdpCalls, error: allVdpError } = await supabaseAdmin
    .from('vdp_calls')
    .select('company_email, event, updated_at')
    .gte('updated_at', start.toISOString())
    .lt('updated_at', end.toISOString())
    .not('company_email', 'is', null)
    .neq('company_email', '');
  
  if (allVdpError) {
    console.error('❌ Error fetching all vdp_calls:', allVdpError);
  } else {
    console.log(`✅ Found ${allVdpCalls?.length || 0} total vdp_calls (all events)\n`);
  }
  
  // Count by agent email
  const connectsByAgentVdp = new Map<string, number>();
  const connectsByAgentBilling = new Map<string, number>();
  const connectsByAgentAllVdp = new Map<string, number>();
  
  // Count from vdp_calls (END events)
  for (const call of vdpCalls || []) {
    const email = call.company_email?.toLowerCase().trim();
    if (email) {
      connectsByAgentVdp.set(email, (connectsByAgentVdp.get(email) || 0) + 1);
    }
  }
  
  // Count from billing_transactions
  for (const tx of billingConnects || []) {
    const email = tx.agent_email?.toLowerCase().trim();
    if (email) {
      connectsByAgentBilling.set(email, (connectsByAgentBilling.get(email) || 0) + 1);
    }
  }
  
  // Count from ALL vdp_calls
  for (const call of allVdpCalls || []) {
    const email = call.company_email?.toLowerCase().trim();
    if (email) {
      connectsByAgentAllVdp.set(email, (connectsByAgentAllVdp.get(email) || 0) + 1);
    }
  }
  
  // Get all agents from agent_hierarchy
  console.log('📊 Getting agents from agent_hierarchy...');
  const { data: agents, error: agentsError } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email, agent_name')
    .not('agent_email', 'is', null);
  
  if (agentsError) {
    console.error('❌ Error fetching agents:', agentsError);
    return;
  }
  
  console.log(`✅ Found ${agents?.length || 0} agents\n`);
  
  // Compare
  console.log('🔍 COMPARISON:\n');
  console.log('='.repeat(100));
  
  const allAgents = new Set(agents?.map(a => a.agent_email?.toLowerCase().trim()).filter(Boolean) || []);
  
  const discrepancies: Array<{
    email: string;
    name?: string;
    vdpEnd: number;
    billing: number;
    allVdp: number;
  }> = [];
  
  for (const agent of agents || []) {
    const email = agent.agent_email?.toLowerCase().trim();
    if (!email) continue;
    
    const vdpEnd = connectsByAgentVdp.get(email) || 0;
    const billing = connectsByAgentBilling.get(email) || 0;
    const allVdp = connectsByAgentAllVdp.get(email) || 0;
    
    if (billing > vdpEnd || allVdp > vdpEnd) {
      discrepancies.push({
        email,
        name: agent.agent_name || undefined,
        vdpEnd,
        billing,
        allVdp
      });
    }
  }
  
  // Sort by difference (largest discrepancy first)
  discrepancies.sort((a, b) => Math.max(b.billing, b.allVdp) - Math.max(a.billing, a.allVdp));
  
  console.log(`\n📊 Total agents: ${allAgents.size}`);
  console.log(`   - With connects (vdp END events): ${connectsByAgentVdp.size}`);
  console.log(`   - With connects (billing_transactions): ${connectsByAgentBilling.size}`);
  console.log(`   - With connects (ALL vdp_calls): ${connectsByAgentAllVdp.size}`);
  console.log(`   - Discrepancies: ${discrepancies.length}\n`);
  
  if (discrepancies.length > 0) {
    console.log('⚠️ AGENTS WITH MISSING CONNECTS ON LEADERBOARD:\n');
    for (const agent of discrepancies.slice(0, 20)) {
      const maxConnects = Math.max(agent.billing, agent.allVdp);
      const missing = maxConnects - agent.vdpEnd;
      console.log(`   ${agent.name || agent.email}`);
      console.log(`      VDP END (leaderboard): ${agent.vdpEnd}`);
      console.log(`      Billing: ${agent.billing}, ALL VDP: ${agent.allVdp}`);
      console.log(`      ⚠️ Missing ${missing} connects on leaderboard!`);
      console.log('');
    }
    
    if (discrepancies.length > 20) {
      console.log(`   ... and ${discrepancies.length - 20} more`);
    }
  } else {
    console.log('✅ No discrepancies found - all agents match!');
  }
  
  // Show event distribution
  console.log('\n📊 VDP_CALLS EVENT DISTRIBUTION:\n');
  const eventCounts = new Map<string, number>();
  for (const call of allVdpCalls || []) {
    const event = call.event || 'null';
    eventCounts.set(event, (eventCounts.get(event) || 0) + 1);
  }
  
  for (const [event, count] of Array.from(eventCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${event}: ${count}`);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('\n💡 RECOMMENDATION:');
  if (connectsByAgentAllVdp.size > connectsByAgentVdp.size) {
    console.log('   ❌ Leaderboard is ONLY counting vdp_calls with event=END');
    console.log('   ✅ Should count ALL vdp_calls (connects are all incoming calls, not just END events)');
    console.log('   🔧 Fix: Change leaderboard to count ALL vdp_calls, not just END events');
  } else {
    console.log('   The issue might be different - check agent_email matching or date range');
  }
}

checkLeaderboardConnects()
  .then(() => {
    console.log('\n✅ Check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
