/**
 * Simulate what would happen if we process all CSV records through the webhook
 * 
 * This will:
 * 1. List all agents from the CSV
 * 2. Check which transactions already exist in the database
 * 3. Show what would be created vs what already exists
 * 
 * Run with: tsx server/simulate-webhook-processing.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from './supabase';

interface MissedCallRecord {
  date: string;
  time: string;
  event: string;
  phone: string;
  agent: string;
  params: string;
}

interface UniqueMissedCall {
  agentId: string;
  phone: string;
  firstOccurrence: string;
  count: number;
}

interface AgentBilling {
  agentId: string;
  agentEmail: string | null;
  agentName: string | null;
  uniquePhones: string[];
  totalCalls: number;
  billableAmount: number;
  transactionsToCreate: number;
  transactionsAlreadyExist: number;
}

function parseCSV(filePath: string): MissedCallRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const dataLines = lines.slice(1);
  
  const records: MissedCallRecord[] = [];
  
  for (const line of dataLines) {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());
    
    if (parts.length >= 5) {
      records.push({
        date: parts[0] || '',
        time: parts[1] || '',
        event: parts[2] || '',
        phone: parts[3] || '',
        agent: parts[4] || '',
        params: parts[5] || ''
      });
    }
  }
  
  return records;
}

async function lookupAgentEmail(associateId: string): Promise<{ email: string | null; name: string | null }> {
  if (!supabaseAdmin) {
    return { email: null, name: null };
  }
  
  const agentIdInt = parseInt(associateId);
  if (isNaN(agentIdInt)) {
    return { email: null, name: null };
  }
  
  const { data: producer } = await supabaseAdmin
    .from('producerlist')
    .select('company_email')
    .eq('associate_id', agentIdInt)
    .maybeSingle();
  
  if (producer?.company_email) {
    return { email: producer.company_email, name: null };
  }
  
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('company_email, personal_email, first_name, last_name')
    .eq('associate_id', agentIdInt)
    .maybeSingle();
  
  if (customer?.company_email) {
    return { 
      email: customer.company_email, 
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null 
    };
  }
  
  if (customer?.personal_email) {
    return { 
      email: customer.personal_email, 
      name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || null 
    };
  }
  
  return { email: null, name: null };
}

async function checkExistingTransaction(agentEmail: string, phone: string, date: string): Promise<boolean> {
  if (!supabaseAdmin || !agentEmail) {
    return false;
  }
  
  // Check if transaction exists for this agent+phone on this date
  const dateStr = date.split(' ')[0]; // Get just the date part
  const { data: existing } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id')
    .eq('agent_email', agentEmail)
    .eq('lead_phone', phone)
    .eq('transaction_type', 'missed_call')
    .gte('transaction_date', `${dateStr}T00:00:00`)
    .lt('transaction_date', `${dateStr}T23:59:59`)
    .limit(1)
    .maybeSingle();
  
  return !!existing;
}

async function simulateWebhookProcessing() {
  console.log('\n🔍 SIMULATING WEBHOOK PROCESSING FOR CSV DATA\n');
  console.log('='.repeat(80));
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }
  
  const csvPath = path.join(process.cwd(), 'dist', 'fxdghdfgh.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  console.log(`\n📁 Reading CSV: ${csvPath}\n`);
  
  const records = parseCSV(csvPath);
  console.log(`✅ Parsed ${records.length} records from CSV`);
  
  const missedCalls = records.filter(r => r.event === 'MISSED' && r.phone && r.agent);
  console.log(`✅ Found ${missedCalls.length} MISSED call records\n`);
  
  // Group by unique agent+phone combinations
  const uniqueMap = new Map<string, UniqueMissedCall>();
  
  for (const call of missedCalls) {
    const key = `${call.agent}|${call.phone}`;
    
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        agentId: call.agent,
        phone: call.phone,
        firstOccurrence: `${call.date} ${call.time}`,
        count: 0
      });
    }
    
    uniqueMap.get(key)!.count++;
  }
  
  console.log(`✅ Found ${uniqueMap.size} unique agent+phone combinations\n`);
  
  // Group by agent and look up emails
  const agentBillingMap = new Map<string, AgentBilling>();
  
  console.log('🔍 Looking up agent emails and checking existing transactions...\n');
  
  for (const [key, uniqueCall] of uniqueMap.entries()) {
    const agentId = uniqueCall.agentId;
    
    if (!agentBillingMap.has(agentId)) {
      const agentInfo = await lookupAgentEmail(agentId);
      
      agentBillingMap.set(agentId, {
        agentId: agentId,
        agentEmail: agentInfo.email,
        agentName: agentInfo.name,
        uniquePhones: [],
        totalCalls: 0,
        billableAmount: 0,
        transactionsToCreate: 0,
        transactionsAlreadyExist: 0
      });
    }
    
    const agentBilling = agentBillingMap.get(agentId)!;
    agentBilling.uniquePhones.push(uniqueCall.phone);
    agentBilling.totalCalls += uniqueCall.count;
    
    // Check if transaction already exists
    if (agentBilling.agentEmail) {
      const exists = await checkExistingTransaction(
        agentBilling.agentEmail,
        uniqueCall.phone,
        uniqueCall.firstOccurrence
      );
      
      if (exists) {
        agentBilling.transactionsAlreadyExist++;
      } else {
        agentBilling.transactionsToCreate++;
      }
    }
  }
  
  // Calculate billable amounts
  for (const agentBilling of agentBillingMap.values()) {
    agentBilling.billableAmount = agentBilling.uniquePhones.length * 4.00;
  }
  
  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('📋 ALL AGENTS - WEBHOOK PROCESSING SIMULATION\n');
  console.log('='.repeat(80));
  
  const sortedAgents = Array.from(agentBillingMap.values())
    .sort((a, b) => b.billableAmount - a.billableAmount);
  
  let totalBillable = 0;
  let totalToCreate = 0;
  let totalAlreadyExist = 0;
  let agentsWithEmail = 0;
  let agentsWithoutEmail = 0;
  
  console.log(`\n${'#'.padEnd(4)} | ${'Agent ID'.padEnd(12)} | ${'Email'.padEnd(40)} | ${'Unique Phones'.padEnd(15)} | ${'To Create'.padEnd(10)} | ${'Exist'.padEnd(8)} | ${'Amount'.padEnd(10)}`);
  console.log('-'.repeat(120));
  
  sortedAgents.forEach((agent, idx) => {
    const email = agent.agentEmail || '❌ NOT FOUND';
    
    if (agent.agentEmail) {
      agentsWithEmail++;
    } else {
      agentsWithoutEmail++;
    }
    
    totalBillable += agent.billableAmount;
    totalToCreate += agent.transactionsToCreate;
    totalAlreadyExist += agent.transactionsAlreadyExist;
    
    console.log(
      `${String(idx + 1).padEnd(4)} | ${String(agent.agentId).padEnd(12)} | ${email.padEnd(40)} | ${String(agent.uniquePhones.length).padEnd(15)} | ${String(agent.transactionsToCreate).padEnd(10)} | ${String(agent.transactionsAlreadyExist).padEnd(8)} | $${agent.billableAmount.toFixed(2).padEnd(9)}`
    );
  });
  
  console.log('-'.repeat(120));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Agents: ${sortedAgents.length}`);
  console.log(`   Agents with Email: ${agentsWithEmail}`);
  console.log(`   Agents without Email: ${agentsWithoutEmail}`);
  console.log(`   Total Unique Phone Numbers: ${uniqueMap.size}`);
  console.log(`   Total Billable Amount: $${totalBillable.toFixed(2)}`);
  console.log(`\n💳 WEBHOOK PROCESSING:`);
  console.log(`   Transactions to CREATE: ${totalToCreate} ($${(totalToCreate * 4.00).toFixed(2)})`);
  console.log(`   Transactions ALREADY EXIST: ${totalAlreadyExist} ($${(totalAlreadyExist * 4.00).toFixed(2)})`);
  console.log(`   New Revenue: $${(totalToCreate * 4.00).toFixed(2)}`);
  
  // Show agents that would create new transactions
  const agentsWithNewTxns = sortedAgents.filter(a => a.transactionsToCreate > 0);
  if (agentsWithNewTxns.length > 0) {
    console.log(`\n✅ AGENTS WITH NEW TRANSACTIONS TO CREATE (${agentsWithNewTxns.length}):`);
    agentsWithNewTxns.forEach((agent, idx) => {
      console.log(`   ${idx + 1}. Agent ${agent.agentId} (${agent.agentEmail || 'NO EMAIL'}): ${agent.transactionsToCreate} new transactions = $${(agent.transactionsToCreate * 4.00).toFixed(2)}`);
    });
  }
  
  // Show agents with all transactions already existing
  const agentsAllExist = sortedAgents.filter(a => a.transactionsToCreate === 0 && a.transactionsAlreadyExist > 0);
  if (agentsAllExist.length > 0) {
    console.log(`\n⏭️  AGENTS WITH ALL TRANSACTIONS ALREADY EXISTING (${agentsAllExist.length}):`);
    agentsAllExist.forEach((agent, idx) => {
      console.log(`   ${idx + 1}. Agent ${agent.agentId} (${agent.agentEmail || 'NO EMAIL'}): ${agent.transactionsAlreadyExist} already exist`);
    });
  }
  
  // Show agents without email (can't create transactions)
  const agentsNoEmail = sortedAgents.filter(a => !a.agentEmail);
  if (agentsNoEmail.length > 0) {
    console.log(`\n❌ AGENTS WITHOUT EMAIL - CANNOT CREATE TRANSACTIONS (${agentsNoEmail.length}):`);
    agentsNoEmail.forEach((agent, idx) => {
      console.log(`   ${idx + 1}. Agent ${agent.agentId}: ${agent.uniquePhones.length} unique phones = $${agent.billableAmount.toFixed(2)} (NO EMAIL)`);
    });
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

simulateWebhookProcessing()
  .then(() => {
    console.log('✅ Simulation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Simulation failed:', error);
    process.exit(1);
  });








