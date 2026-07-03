/**
 * DIAGNOSTIC: Check why hierarchies aren't working
 */

import { supabaseAdmin } from './server/supabase';
import { getTodayEST } from './server/scripts/calculate-dial-reach-booked-realtime';

async function diagnoseHierarchyIssue() {
  console.log('🔍 Diagnosing hierarchy issues...\n');
  
  // 1. Get agents from agent_hierarchy
  console.log('📊 Getting agents from agent_hierarchy...');
  const { data: hierarchyAgents, error: hierarchyError } = await supabaseAdmin
    .from('agent_hierarchy')
    .select('agent_email, agent_name, agent_associate_id, mga_name, rga_name')
    .not('agent_email', 'is', null)
    .neq('agent_email', '');
  
  if (hierarchyError) {
    console.error('❌ Error fetching agent_hierarchy:', hierarchyError);
    return;
  }
  
  console.log(`✅ Found ${hierarchyAgents?.length || 0} agents in agent_hierarchy\n`);
  
  // 2. Get connects from billing_transactions
  const { start, end } = getTodayEST();
  console.log('📊 Getting connects from billing_transactions...');
  const { data: connectTransactions, error: billingError } = await supabaseAdmin
    .from('billing_transactions')
    .select('agent_email, transaction_date')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', start.toISOString())
    .lt('transaction_date', end.toISOString())
    .not('agent_email', 'is', null)
    .neq('agent_email', '');
  
  if (billingError) {
    console.error('❌ Error fetching billing_transactions:', billingError);
    return;
  }
  
  console.log(`✅ Found ${connectTransactions?.length || 0} connects in billing_transactions\n`);
  
  // 3. Check email mismatches
  const hierarchyEmails = new Set(
    (hierarchyAgents || []).map(a => a.agent_email?.toLowerCase().trim()).filter(Boolean)
  );
  
  const billingEmails = new Set(
    (connectTransactions || []).map(tx => tx.agent_email?.toLowerCase().trim()).filter(Boolean)
  );
  
  const connectsWithoutHierarchy = Array.from(billingEmails).filter(
    email => !hierarchyEmails.has(email)
  );
  
  console.log('🔍 EMAIL MISMATCH ANALYSIS:\n');
  console.log(`   Hierarchy emails: ${hierarchyEmails.size}`);
  console.log(`   Billing emails: ${billingEmails.size}`);
  console.log(`   Connects without hierarchy: ${connectsWithoutHierarchy.length}\n`);
  
  if (connectsWithoutHierarchy.length > 0) {
    console.log('⚠️ AGENTS WITH CONNECTS BUT NOT IN HIERARCHY:\n');
    
    // Count connects per missing agent
    const missingAgentConnects = new Map<string, number>();
    for (const tx of connectTransactions || []) {
      const email = tx.agent_email?.toLowerCase().trim();
      if (email && connectsWithoutHierarchy.includes(email)) {
        missingAgentConnects.set(email, (missingAgentConnects.get(email) || 0) + 1);
      }
    }
    
    for (const [email, count] of Array.from(missingAgentConnects.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${email}: ${count} connects (NOT IN HIERARCHY)`);
    }
    
    console.log('');
  }
  
  // 4. Check for hierarchy entries without proper MGA/RGA
  console.log('🔍 HIERARCHY DATA QUALITY:\n');
  const agentsWithoutMga = (hierarchyAgents || []).filter(a => !a.mga_name);
  const agentsWithoutRga = (hierarchyAgents || []).filter(a => !a.rga_name);
  const agentsWithoutBoth = (hierarchyAgents || []).filter(a => !a.mga_name && !a.rga_name);
  
  console.log(`   Agents without MGA: ${agentsWithoutMga.length}`);
  console.log(`   Agents without RGA: ${agentsWithoutRga.length}`);
  console.log(`   Agents without both MGA and RGA: ${agentsWithoutBoth.length}\n`);
  
  if (agentsWithoutBoth.length > 0) {
    console.log('   Sample agents without MGA/RGA:');
    for (const agent of agentsWithoutBoth.slice(0, 10)) {
      console.log(`      ${agent.agent_email} (${agent.agent_name || 'N/A'})`);
    }
    if (agentsWithoutBoth.length > 10) {
      console.log(`      ... and ${agentsWithoutBoth.length - 10} more`);
    }
    console.log('');
  }
  
  // 5. Check for duplicate emails in hierarchy
  const emailCounts = new Map<string, number>();
  for (const agent of hierarchyAgents || []) {
    const email = agent.agent_email?.toLowerCase().trim();
    if (email) {
      emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }
  }
  
  const duplicateEmails = Array.from(emailCounts.entries()).filter(([_, count]) => count > 1);
  
  console.log('🔍 DUPLICATE EMAILS IN HIERARCHY:\n');
  if (duplicateEmails.length > 0) {
    console.log(`   Found ${duplicateEmails.length} duplicate emails:\n`);
    for (const [email, count] of duplicateEmails.slice(0, 10)) {
      console.log(`      ${email}: ${count} entries`);
    }
  } else {
    console.log('   ✅ No duplicate emails found');
  }
  console.log('');
  
  // 6. Check specific agent (like fouziehsaad)
  const testEmail = 'fouziehsaad@aoglobelife.com';
  console.log(`🔍 CHECKING SPECIFIC AGENT: ${testEmail}\n`);
  
  const inHierarchy = hierarchyEmails.has(testEmail.toLowerCase().trim());
  const hasConnects = billingEmails.has(testEmail.toLowerCase().trim());
  
  console.log(`   In agent_hierarchy: ${inHierarchy ? '✅ YES' : '❌ NO'}`);
  console.log(`   Has connects today: ${hasConnects ? '✅ YES' : '❌ NO'}`);
  
  if (inHierarchy) {
    const agent = (hierarchyAgents || []).find(a => 
      a.agent_email?.toLowerCase().trim() === testEmail.toLowerCase().trim()
    );
    if (agent) {
      console.log(`   MGA: ${agent.mga_name || 'N/A'}`);
      console.log(`   RGA: ${agent.rga_name || 'N/A'}`);
      console.log(`   Associate ID: ${agent.agent_associate_id || 'N/A'}`);
    }
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('\n💡 RECOMMENDATION:');
  if (connectsWithoutHierarchy.length > 0) {
    console.log('   ❌ PROBLEM: Agents with connects are NOT in agent_hierarchy');
    console.log('   🔧 Fix: Add missing agents to agent_hierarchy table');
  } else if (agentsWithoutBoth.length > 0) {
    console.log('   ⚠️ PROBLEM: Agents in hierarchy but missing MGA/RGA data');
    console.log('   🔧 Fix: Update agent_hierarchy with proper MGA/RGA assignments');
  } else {
    console.log('   The issue might be in how hierarchies are being matched or queried');
  }
}

diagnoseHierarchyIssue()
  .then(() => {
    console.log('\n✅ Diagnosis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
