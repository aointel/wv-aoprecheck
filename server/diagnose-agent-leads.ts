/**
 * Diagnostic Script: Why is an agent not getting leads?
 * 
 * Checks all factors that prevent an agent from receiving leads:
 * 1. Agent profile in customers table
 * 2. Agent permissions (markets/states)
 * 3. Agent active status (agent_live_call_status)
 * 4. Current lead count
 * 5. Available unassigned leads matching agent's permissions
 * 
 * Run with: tsx server/diagnose-agent-leads.ts <agent-email>
 * Example: tsx server/diagnose-agent-leads.ts wallacejohnson@aoglobelife.com
 */

import { supabaseAdmin } from './supabase';
import { masterleadClient } from "./local-masterlead-client";
import { countCallableLeads } from './timezone-helper';

const AGENT_EMAIL = process.argv[2] || 'wallacejohnson@aoglobelife.com';

async function diagnoseAgentLeads() {
  console.log(`\n🔍 DIAGNOSING LEAD ASSIGNMENT FOR: ${AGENT_EMAIL}\n`);
  console.log('='.repeat(80));
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  // 1. Check if agent exists in customers table
  console.log('\n📋 STEP 1: Checking agent profile in customers table...');
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('company_email', AGENT_EMAIL)
    .maybeSingle();
  
  if (customerError) {
    console.error(`❌ Error querying customers table:`, customerError);
  } else if (!customer) {
    console.error(`❌ AGENT NOT FOUND in customers table!`);
    console.log(`   This is the PRIMARY reason leads aren't being assigned.`);
    console.log(`   The lead assignment system requires agents to be in the customers table.`);
    
    // Check if agent exists in other tables
    console.log(`\n   Checking other tables...`);
    const { data: producer } = await supabaseAdmin
      .from('producerlist')
      .select('*')
      .eq('company_email', AGENT_EMAIL)
      .maybeSingle();
    
    if (producer) {
      console.log(`   ✅ Found in producerlist table (associate_id: ${producer.associate_id})`);
      console.log(`      Name: ${producer.first_name || ''} ${producer.last_name || ''}`);
    }
    
    const { data: agentProfile } = await supabaseAdmin
      .from('agent_profiles')
      .select('*')
      .eq('email', AGENT_EMAIL)
      .maybeSingle();
    
    if (agentProfile) {
      console.log(`   ✅ Found in agent_profiles table`);
      console.log(`      Name: ${agentProfile.first_name || ''} ${agentProfile.last_name || ''}`);
      console.log(`      Associate ID: ${agentProfile.associate_id || agentProfile.agent_id || 'N/A'}`);
    }
    
    // Check user_credits table
    const { data: userCredit } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('email', AGENT_EMAIL)
      .maybeSingle();
    
    if (userCredit) {
      console.log(`   ✅ Found in user_credits table`);
      console.log(`      Name: ${userCredit.name || 'N/A'}`);
      console.log(`      Associate ID: ${userCredit.associate_id || 'N/A'}`);
    }
    
    console.log(`\n   💡 SOLUTION: Create a record in the customers table for ${AGENT_EMAIL}`);
    console.log(`   Run: tsx server/fix-agent-customer-record.ts ${AGENT_EMAIL}`);
    process.exit(1);
  } else {
    console.log(`✅ Agent found in customers table`);
    console.log(`   Associate ID: ${customer.associate_id || 'N/A'}`);
    console.log(`   Name: ${customer.first_name || ''} ${customer.last_name || ''}`);
  }
  
  // 2. Check agent permissions (markets and states)
  console.log(`\n📋 STEP 2: Checking agent permissions (markets/states)...`);
  const markets = Array.isArray(customer?.market) ? customer.market : (customer?.market ? [customer.market] : []);
  let states = customer?.states || [];
  
  // Handle states if it's a string instead of array
  if (typeof states === 'string') {
    states = states.split(',').map(s => s.trim()).filter(s => s);
  } else if (!Array.isArray(states)) {
    states = [];
  }
  
  console.log(`   Markets: ${markets.length > 0 ? markets.join(', ') : 'NONE (empty array)'}`);
  console.log(`   States: ${states.length > 0 ? states.join(', ') : 'NONE (empty array)'}`);
  
  if (markets.length === 0 && states.length === 0) {
    console.log(`   ⚠️ WARNING: Agent has NO market or state permissions configured!`);
    console.log(`   The assignment system requires at least one market or state to assign leads.`);
  } else if (markets.length === 0) {
    console.log(`   ⚠️ WARNING: Agent has NO market permissions (but has states)`);
  } else if (states.length === 0) {
    console.log(`   ⚠️ WARNING: Agent has NO state permissions (but has markets)`);
  } else {
    console.log(`   ✅ Agent has permissions configured`);
  }
  
  // 3. Check agent active status (agent_live_call_status)
  console.log(`\n📋 STEP 3: Checking agent active status (agent_live_call_status)...`);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const { data: liveStatus, error: statusError } = await supabaseAdmin
    .from('agent_live_call_status')
    .select('*')
    .eq('agent_email', AGENT_EMAIL)
    .order('call_started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (statusError) {
    console.error(`   ❌ Error querying agent_live_call_status:`, statusError);
  } else if (!liveStatus) {
    console.log(`   ⚠️ Agent has NO record in agent_live_call_status`);
    console.log(`   This means the agent is not currently active (not on a call).`);
    console.log(`   The assignment system only assigns leads to agents who are actively calling.`);
    console.log(`   💡 SOLUTION: Agent needs to start making calls to appear as active.`);
  } else {
    const callStartTime = new Date(liveStatus.call_started_at);
    const isRecent = callStartTime >= fiveMinutesAgo;
    
    console.log(`   Status: ${liveStatus.status}`);
    console.log(`   Last call started: ${callStartTime.toISOString()}`);
    console.log(`   Is recent (within 5 min): ${isRecent ? '✅ YES' : '❌ NO'}`);
    
    if (liveStatus.status !== 'in_call') {
      console.log(`   ⚠️ WARNING: Agent status is '${liveStatus.status}', not 'in_call'`);
      console.log(`   The assignment system only assigns to agents with status='in_call'`);
    } else if (!isRecent) {
      console.log(`   ⚠️ WARNING: Last call was more than 5 minutes ago`);
      console.log(`   The assignment system only considers agents active if they called within the last 5 minutes.`);
    } else {
      console.log(`   ✅ Agent is currently active and eligible for lead assignment`);
    }
  }
  
  // 4. Check current lead count
  console.log(`\n📋 STEP 4: Checking agent's current lead count...`);
  try {
    const callableCount = await countCallableLeads(supabaseAdmin, AGENT_EMAIL);
    console.log(`   Callable leads: ${callableCount}`);
    
    // Also get total assigned leads
    const { count: totalAssigned } = await masterleadClient.from('masterlead')
      .select('*', { count: 'exact', head: true })
      .eq('cn_email', AGENT_EMAIL)
      .eq('dnc', false);
    
    console.log(`   Total assigned leads: ${totalAssigned || 0}`);
    
    if (callableCount >= 150) {
      console.log(`   ❌ PROBLEM: Agent has ${callableCount} callable leads (>= 150 limit)`);
      console.log(`   The assignment system will NOT assign more leads if agent has 150+ leads.`);
    } else if (callableCount >= 100) {
      console.log(`   ⚠️ WARNING: Agent has ${callableCount} callable leads (approaching 150 limit)`);
    } else {
      console.log(`   ✅ Agent has room for more leads (${callableCount} < 150)`);
    }
  } catch (error) {
    console.error(`   ❌ Error counting leads:`, error);
  }
  
  // 5. Check available unassigned leads matching agent's permissions
  console.log(`\n📋 STEP 5: Checking available unassigned leads matching agent's permissions...`);
  
  // Get unassigned hotleads
  const { data: unassignedLeads, error: leadsError } = await masterleadClient.from('masterlead')
    .select('id, first_name, last_name, taalk_market, taalk_state, state, priority_score, created_at')
    .eq('is_hot_lead', true)
    .is('cn_email', null)
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (leadsError) {
    console.error(`   ❌ Error fetching unassigned leads:`, leadsError);
  } else if (!unassignedLeads || unassignedLeads.length === 0) {
    console.log(`   ⚠️ No unassigned hotleads available`);
    console.log(`   This could be why the agent isn't getting leads - there are none to assign.`);
  } else {
    console.log(`   Found ${unassignedLeads.length} unassigned hotleads`);
    
    // Filter leads that match agent's permissions
    const matchingLeads = unassignedLeads.filter(lead => {
      const leadMarket = (lead.taalk_market || '').trim();
      const leadState = (lead.taalk_state || lead.state || '').trim();
      
      // Check market match
      const hasMarket = markets.length === 0 || markets.includes(leadMarket) || leadMarket === '';
      
      // Check state match (case-insensitive)
      const hasState = states.length === 0 || 
                       states.some(s => s.trim().toUpperCase() === leadState.toUpperCase()) || 
                       leadState === '';
      
      return hasMarket && hasState;
    });
    
    console.log(`   Matching leads (based on markets/states): ${matchingLeads.length}`);
    
    if (matchingLeads.length === 0) {
      console.log(`   ❌ PROBLEM: No unassigned leads match agent's permissions!`);
      console.log(`   Agent's markets: [${markets.join(', ') || 'ANY'}]`);
      console.log(`   Agent's states: [${states.join(', ') || 'ANY'}]`);
      console.log(`\n   Sample of available leads (first 10):`);
      unassignedLeads.slice(0, 10).forEach(lead => {
        console.log(`      - ${lead.first_name} ${lead.last_name}: Market="${lead.taalk_market || 'N/A'}", State="${lead.taalk_state || lead.state || 'N/A'}"`);
      });
    } else {
      console.log(`   ✅ Found ${matchingLeads.length} leads that match agent's permissions`);
      console.log(`   Sample matching leads (first 5):`);
      matchingLeads.slice(0, 5).forEach(lead => {
        console.log(`      - ${lead.first_name} ${lead.last_name}: Market="${lead.taalk_market || 'N/A'}", State="${lead.taalk_state || lead.state || 'N/A'}"`);
      });
    }
  }
  
  // 6. Summary and recommendations
  console.log(`\n📋 STEP 6: SUMMARY AND RECOMMENDATIONS`);
  console.log('='.repeat(80));
  
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  if (!customer) {
    issues.push('Agent not found in customers table');
    recommendations.push('Create a record in customers table with markets and states arrays');
  } else {
    if (markets.length === 0 && states.length === 0) {
      issues.push('No market or state permissions configured');
      recommendations.push('Add markets and/or states arrays to customer record');
    }
    
    if (!liveStatus || liveStatus.status !== 'in_call') {
      issues.push('Agent not currently active (not in agent_live_call_status with status=in_call)');
      recommendations.push('Agent needs to start making calls to appear as active');
    } else if (liveStatus.call_started_at && new Date(liveStatus.call_started_at) < fiveMinutesAgo) {
      issues.push('Agent last call was more than 5 minutes ago');
      recommendations.push('Agent needs to make a call within the last 5 minutes to be considered active');
    }
    
    try {
      const callableCount = await countCallableLeads(supabaseAdmin, AGENT_EMAIL);
      if (callableCount >= 150) {
        issues.push(`Agent has ${callableCount} leads (at 150 limit)`);
        recommendations.push('Agent needs to work through existing leads or have some unassigned');
      }
    } catch (error) {
      // Skip if error
    }
  }
  
  if (issues.length === 0) {
    console.log(`\n✅ NO ISSUES FOUND - Agent should be receiving leads!`);
    console.log(`   If leads still aren't being assigned, check:`);
    console.log(`   1. Are there unassigned hotleads available?`);
    console.log(`   2. Do those leads match the agent's market/state permissions?`);
    console.log(`   3. Is the auto-assign scheduler running? (check server logs)`);
  } else {
    console.log(`\n❌ ISSUES FOUND:`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    
    console.log(`\n💡 RECOMMENDATIONS:`);
    recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
  }
  
  console.log(`\n` + '='.repeat(80) + `\n`);
}

// Run the diagnostic
diagnoseAgentLeads()
  .then(() => {
    console.log('✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  });








