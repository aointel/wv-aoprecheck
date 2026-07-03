/**
 * Process missed calls CSV and generate billing report
 * 
 * Rules:
 * - Each agent should only be billed once per phone number
 * - $4.00 per unique agent+phone combination
 * 
 * Run with: tsx server/process-missed-calls-csv.ts
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
}

function parseCSV(filePath: string): MissedCallRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const records: MissedCallRecord[] = [];
  
  for (const line of dataLines) {
    // CSV parsing - handle quoted fields
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
    parts.push(current.trim()); // Add last part
    
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
  
  // Try producerlist first
  const { data: producer } = await supabaseAdmin
    .from('producerlist')
    .select('company_email')
    .eq('associate_id', agentIdInt)
    .maybeSingle();
  
  if (producer?.company_email) {
    return { email: producer.company_email, name: null };
  }
  
  // Try customers table
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

async function processMissedCallsCSV() {
  console.log('\n📊 PROCESSING MISSED CALLS CSV FOR BILLING\n');
  console.log('='.repeat(80));
  
  const csvPath = path.join(process.cwd(), 'dist', 'fxdghdfgh.csv');
  
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }
  
  console.log(`\n📁 Reading CSV: ${csvPath}\n`);
  
  // Parse CSV
  const records = parseCSV(csvPath);
  console.log(`✅ Parsed ${records.length} records from CSV`);
  
  // Filter only MISSED events
  const missedCalls = records.filter(r => r.event === 'MISSED' && r.phone && r.agent);
  console.log(`✅ Found ${missedCalls.length} MISSED call records`);
  
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
  
  console.log('🔍 Looking up agent emails...\n');
  
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
        billableAmount: 0
      });
    }
    
    const agentBilling = agentBillingMap.get(agentId)!;
    agentBilling.uniquePhones.push(uniqueCall.phone);
    agentBilling.totalCalls += uniqueCall.count;
  }
  
  // Calculate billable amounts ($4.00 per unique phone)
  for (const agentBilling of agentBillingMap.values()) {
    agentBilling.billableAmount = agentBilling.uniquePhones.length * 4.00;
  }
  
  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('📋 BILLING REPORT - MISSED CALLS\n');
  console.log('='.repeat(80));
  
  // Sort by billable amount (descending)
  const sortedAgents = Array.from(agentBillingMap.values())
    .sort((a, b) => b.billableAmount - a.billableAmount);
  
  let totalBillable = 0;
  let agentsWithEmail = 0;
  let agentsWithoutEmail = 0;
  
  console.log(`\n${'Agent ID'.padEnd(12)} | ${'Email'.padEnd(40)} | ${'Name'.padEnd(30)} | ${'Unique Phones'.padEnd(15)} | ${'Total Calls'.padEnd(12)} | ${'Amount'.padEnd(10)}`);
  console.log('-'.repeat(130));
  
  for (const agent of sortedAgents) {
    const email = agent.agentEmail || '❌ NOT FOUND';
    const name = agent.agentName || 'N/A';
    
    if (agent.agentEmail) {
      agentsWithEmail++;
    } else {
      agentsWithoutEmail++;
    }
    
    totalBillable += agent.billableAmount;
    
    console.log(
      `${String(agent.agentId).padEnd(12)} | ${email.padEnd(40)} | ${name.padEnd(30)} | ${String(agent.uniquePhones.length).padEnd(15)} | ${String(agent.totalCalls).padEnd(12)} | $${agent.billableAmount.toFixed(2).padEnd(9)}`
    );
  }
  
  console.log('-'.repeat(130));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total Agents: ${sortedAgents.length}`);
  console.log(`   Agents with Email: ${agentsWithEmail}`);
  console.log(`   Agents without Email: ${agentsWithoutEmail}`);
  console.log(`   Total Unique Phone Numbers: ${uniqueMap.size}`);
  console.log(`   Total Billable Amount: $${totalBillable.toFixed(2)}`);
  
  // Show agents without email
  if (agentsWithoutEmail > 0) {
    console.log(`\n⚠️  AGENTS WITHOUT EMAIL (${agentsWithoutEmail}):`);
    sortedAgents
      .filter(a => !a.agentEmail)
      .forEach(agent => {
        console.log(`   - Agent ID ${agent.agentId}: ${agent.uniquePhones.length} unique phones = $${agent.billableAmount.toFixed(2)}`);
      });
  }
  
  // Show top 10 by amount
  console.log(`\n💰 TOP 10 AGENTS BY BILLABLE AMOUNT:`);
  sortedAgents.slice(0, 10).forEach((agent, idx) => {
    console.log(`   ${idx + 1}. Agent ${agent.agentId} (${agent.agentEmail || 'NO EMAIL'}): $${agent.billableAmount.toFixed(2)} (${agent.uniquePhones.length} unique phones)`);
  });
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Export to JSON for further processing
  const reportData = {
    generatedAt: new Date().toISOString(),
    totalAgents: sortedAgents.length,
    totalUniquePhones: uniqueMap.size,
    totalBillableAmount: totalBillable,
    agentsWithEmail,
    agentsWithoutEmail,
    agents: sortedAgents.map(agent => ({
      agentId: agent.agentId,
      agentEmail: agent.agentEmail,
      agentName: agent.agentName,
      uniquePhones: agent.uniquePhones.length,
      totalCalls: agent.totalCalls,
      billableAmount: agent.billableAmount
    }))
  };
  
  const reportPath = path.join(process.cwd(), 'dist', 'missed-calls-billing-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`✅ Report saved to: ${reportPath}\n`);
}

processMissedCallsCSV()
  .then(() => {
    console.log('✅ Processing complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  });








