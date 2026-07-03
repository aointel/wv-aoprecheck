/**
 * DIAGNOSTIC: Why are connects incorrect?
 * 
 * This script compares:
 * 1. Connects from billing_transactions (current source)
 * 2. Connects from vdp_calls (actual source of truth)
 * 
 * To identify the discrepancy.
 */

import { supabaseAdmin } from './server/supabase';

async function diagnoseConnectsIssue() {
  console.log('🔍 Diagnosing connects data issue...\n');
  
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
  
  // 1. Get connects from billing_transactions (current source)
  console.log('📊 Getting connects from billing_transactions...');
  const { data: billingConnects, error: billingError } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email, transaction_date, source_id, source_table')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '');
  
  if (billingError) {
    console.error('❌ Error fetching billing connects:', billingError);
    return;
  }
  
  console.log(`✅ Found ${billingConnects?.length || 0} connects in billing_transactions\n`);
  
  // 2. Get connects from vdp_calls (source of truth)
  // Connects are identified by PICK_UP events (not END - END is when call ends)
  console.log('📊 Getting connects from vdp_calls (PICK_UP events)...');
  const { data: vdpPickups, error: vdpPickupError } = await supabaseAdmin
    .from('vdp_calls')
    .select('id, company_email, agent, event, updated_at, time, date')
    .or('event.eq.PICK_UP,event.eq.pick_up,event.eq.PICKUP,event.ilike.PICK_UP')
    .gte('updated_at', start.toISOString())
    .lt('updated_at', end.toISOString())
    .not('company_email', 'is', null)
    .neq('company_email', '');
  
  if (vdpPickupError) {
    console.error('❌ Error fetching vdp_calls PICK_UP:', vdpPickupError);
  } else {
    console.log(`✅ Found ${vdpPickups?.length || 0} vdp_calls with PICK_UP event\n`);
  }
  
  // Also check vdp_connects table (processed connects)
  console.log('📊 Getting connects from vdp_connects table...');
  const { data: vdpConnects, error: vdpConnectsError } = await supabaseAdmin
    .from('vdp_connects')
    .select('agent_id, phone, connect_date, pickup_time')
    .gte('connect_date', `${year}-${month}-${day}`)
    .not('agent_id', 'is', null);
  
  if (vdpConnectsError) {
    console.error('❌ Error fetching vdp_connects:', vdpConnectsError);
  } else {
    console.log(`✅ Found ${vdpConnects?.length || 0} connects in vdp_connects table\n`);
  }
  
  // Use vdpPickups for comparison
  const vdpCalls = vdpPickups || [];
  
  // Count by agent email
  const billingConnectsByAgent = new Map<string, number>();
  const vdpConnectsByAgent = new Map<string, number>();
  
  // Count billing_transactions
  for (const tx of billingConnects || []) {
    const email = tx.agent_email?.toLowerCase().trim();
    if (email) {
      billingConnectsByAgent.set(email, (billingConnectsByAgent.get(email) || 0) + 1);
    }
  }
  
  // Count vdp_calls (PICK_UP events)
  for (const call of vdpCalls || []) {
    const email = call.company_email?.toLowerCase().trim();
    if (email) {
      vdpConnectsByAgent.set(email, (vdpConnectsByAgent.get(email) || 0) + 1);
    }
  }
  
  // Also count from vdp_connects table if available
  // Need to map agent_id to email
  if (vdpConnects && vdpConnects.length > 0) {
    console.log('📊 Mapping vdp_connects agent_id to email...');
    const agentIdToEmail = new Map<string, string>();
    
    // Get all unique agent_ids
    const agentIds = [...new Set(vdpConnects.map(c => c.agent_id).filter(Boolean))];
    
    // Look up emails from customers table by associate_id
    for (const agentId of agentIds) {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, associate_id')
        .eq('associate_id', parseInt(agentId))
        .maybeSingle();
      
      if (customer?.company_email) {
        agentIdToEmail.set(agentId, customer.company_email.toLowerCase().trim());
      }
    }
    
    // Count connects by email
    for (const connect of vdpConnects) {
      const email = agentIdToEmail.get(connect.agent_id || '');
      if (email) {
        vdpConnectsByAgent.set(email, (vdpConnectsByAgent.get(email) || 0) + 1);
      }
    }
    
    console.log(`✅ Mapped ${agentIdToEmail.size} agent IDs to emails\n`);
  }
  
  // Compare
  console.log('🔍 COMPARISON:\n');
  console.log('='.repeat(100));
  
  const allAgents = new Set([
    ...Array.from(billingConnectsByAgent.keys()),
    ...Array.from(vdpConnectsByAgent.keys())
  ]);
  
  const discrepancies: Array<{
    email: string;
    billing: number;
    vdp: number;
    diff: number;
  }> = [];
  
  for (const email of allAgents) {
    const billing = billingConnectsByAgent.get(email) || 0;
    const vdp = vdpConnectsByAgent.get(email) || 0;
    const diff = vdp - billing;
    
    if (diff !== 0) {
      discrepancies.push({ email, billing, vdp, diff });
    }
  }
  
  // Sort by difference (largest discrepancy first)
  discrepancies.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  
  console.log(`\n📊 Total agents with connects: ${allAgents.size}`);
  console.log(`   - From billing_transactions: ${billingConnectsByAgent.size}`);
  console.log(`   - From vdp_calls: ${vdpConnectsByAgent.size}`);
  console.log(`   - Discrepancies: ${discrepancies.length}\n`);
  
  if (discrepancies.length > 0) {
    console.log('⚠️ AGENTS WITH DISCREPANCIES:\n');
    for (const agent of discrepancies.slice(0, 20)) {
      const sign = agent.diff > 0 ? '+' : '';
      console.log(`   ${agent.email}`);
      console.log(`      Billing: ${agent.billing}, VDP: ${agent.vdp}, Diff: ${sign}${agent.diff}`);
    }
    
    if (discrepancies.length > 20) {
      console.log(`   ... and ${discrepancies.length - 20} more`);
    }
  } else {
    console.log('✅ No discrepancies found - all agents match!');
  }
  
  // Check for vdp_calls without billing_transactions
  console.log('\n🔍 VDP CALLS WITHOUT BILLING TRANSACTIONS:\n');
  const vdpCallIds = new Set((vdpCalls || []).map(c => c.id));
  const billedVdpIds = new Set((billingConnects || [])
    .filter(tx => tx.source_table === 'vdp_calls')
    .map(tx => tx.source_id));
  
  const unbilledVdpCalls = (vdpCalls || []).filter(call => !billedVdpIds.has(call.id));
  
  console.log(`   Total vdp_calls: ${vdpCalls?.length || 0}`);
  console.log(`   Billed vdp_calls: ${billedVdpIds.size}`);
  console.log(`   Unbilled vdp_calls: ${unbilledVdpCalls.length}\n`);
  
  if (unbilledVdpCalls.length > 0) {
    console.log('   Sample unbilled calls:');
    for (const call of unbilledVdpCalls.slice(0, 10)) {
      console.log(`      - ID: ${call.id}, Agent: ${call.company_email || call.agent}, Event: ${call.event}, Updated: ${call.updated_at}`);
    }
    if (unbilledVdpCalls.length > 10) {
      console.log(`      ... and ${unbilledVdpCalls.length - 10} more`);
    }
  }
  
  // Check for billing_transactions without vdp_calls
  console.log('\n🔍 BILLING TRANSACTIONS WITHOUT VDP_CALLS:\n');
  const billingFromVdp = (billingConnects || []).filter(tx => tx.source_table === 'vdp_calls');
  const orphanedBilling = billingFromVdp.filter(tx => !vdpCallIds.has(tx.source_id));
  
  console.log(`   Total billing_transactions from vdp_calls: ${billingFromVdp.length}`);
  console.log(`   Orphaned (vdp_call doesn't exist): ${orphanedBilling.length}\n`);
  
  if (orphanedBilling.length > 0) {
    console.log('   Sample orphaned billing transactions:');
    for (const tx of orphanedBilling.slice(0, 10)) {
      console.log(`      - Agent: ${tx.agent_email}, Source ID: ${tx.source_id}, Date: ${tx.transaction_date}`);
    }
    if (orphanedBilling.length > 10) {
      console.log(`      ... and ${orphanedBilling.length - 10} more`);
    }
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('\n💡 RECOMMENDATION:');
  console.log('   Connects should be counted from vdp_calls directly, not billing_transactions.');
  console.log('   The billing_transactions table may be missing connects or have agent_email mismatches.');
}

diagnoseConnectsIssue()
  .then(() => {
    console.log('\n✅ Diagnosis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
