/**
 * Script to check how many licenses (states) each agent has in the customers table
 * 
 * Usage: tsx server/scripts/check-agent-licenses.ts
 */

import { supabaseAdmin } from '../supabase';

// Agent emails to check (from Live Call Board)
const agentEmails = [
  'danielbeasley@aoglobelife.com',
  'lanebeasley@aoglobelife.com',
  'markarmistead@aoglobelife.com',
  'jaxonbellar@aoglobelife.com',
  'tyjeremorrow@aoglobelife.com',
  'williamtomazin@aoglobelife.com',
  'lakshitadawes@aoglobelife.com',
  'necodiluccia@aoglobelife.com',
  'makiyahgilford@aoglobelife.com',
  'anthonyhines@aoglobelife.com',
  'coopertyler@aoglobelife.com'
];

interface LicenseInfo {
  email: string;
  found: boolean;
  licenseCount: number;
  states: string[];
  firstName?: string;
  lastName?: string;
  agentName?: string;
  associateId?: number;
}

function parseArrayField(field: any): string[] {
  if (!field) return [];
  if (Array.isArray(field)) return field.filter(Boolean).map(String);
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      // If not JSON, treat as comma-separated
      return field.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

async function checkAgentLicenses(): Promise<void> {
  console.log('🔍 Checking licenses for agents...\n');
  console.log(`📋 Checking ${agentEmails.length} agents\n`);

  const results: LicenseInfo[] = [];

  for (const email of agentEmails) {
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      // Query customers table
      const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, first_name, last_name, agent_name, associate_id, states')
        .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
        .maybeSingle();

      if (error) {
        console.error(`❌ Error querying ${email}:`, error.message);
        results.push({
          email,
          found: false,
          licenseCount: 0,
          states: []
        });
        continue;
      }

      if (!customer) {
        console.log(`⚠️  ${email}: NOT FOUND in customers table`);
        results.push({
          email,
          found: false,
          licenseCount: 0,
          states: []
        });
        continue;
      }

      // Parse states array
      const states = parseArrayField(customer.states);
      const licenseCount = states.length;

      console.log(`✅ ${email}:`);
      console.log(`   Name: ${customer.first_name || ''} ${customer.last_name || ''} ${customer.agent_name || ''}`.trim());
      console.log(`   Associate ID: ${customer.associate_id || 'N/A'}`);
      console.log(`   Licenses: ${licenseCount} state(s)`);
      if (states.length > 0) {
        console.log(`   States: ${states.join(', ')}`);
      } else {
        console.log(`   States: NONE`);
      }
      console.log('');

      results.push({
        email,
        found: true,
        licenseCount,
        states,
        firstName: customer.first_name || undefined,
        lastName: customer.last_name || undefined,
        agentName: customer.agent_name || undefined,
        associateId: customer.associate_id || undefined
      });

    } catch (error: any) {
      console.error(`❌ Error processing ${email}:`, error.message);
      results.push({
        email,
        found: false,
        licenseCount: 0,
        states: []
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total agents checked: ${agentEmails.length}`);
  console.log(`Found in customers table: ${results.filter(r => r.found).length}`);
  console.log(`Not found: ${results.filter(r => !r.found).length}`);
  console.log('');

  // Sort by license count (descending)
  const sortedResults = [...results].sort((a, b) => b.licenseCount - a.licenseCount);

  console.log('📋 License Count by Agent:');
  console.log('-'.repeat(80));
  console.log(`${'Email'.padEnd(35)} | ${'Name'.padEnd(25)} | Licenses | States`);
  console.log('-'.repeat(80));

  sortedResults.forEach(result => {
    const name = `${result.firstName || ''} ${result.lastName || ''} ${result.agentName || ''}`.trim() || 'N/A';
    const emailDisplay = result.email.length > 33 ? result.email.substring(0, 30) + '...' : result.email;
    const nameDisplay = name.length > 23 ? name.substring(0, 20) + '...' : name;
    const statesDisplay = result.states.length > 0 ? result.states.join(', ') : 'NONE';
    
    console.log(`${emailDisplay.padEnd(35)} | ${nameDisplay.padEnd(25)} | ${result.licenseCount.toString().padStart(8)} | ${statesDisplay}`);
  });

  console.log('-'.repeat(80));
  console.log(`Total licenses across all agents: ${results.reduce((sum, r) => sum + r.licenseCount, 0)}`);
  console.log(`Average licenses per agent: ${(results.reduce((sum, r) => sum + r.licenseCount, 0) / results.length).toFixed(1)}`);
  console.log(`Agents with 0 licenses: ${results.filter(r => r.licenseCount === 0).length}`);
  console.log(`Agents with 1+ licenses: ${results.filter(r => r.licenseCount > 0).length}`);
}

// Run the script
checkAgentLicenses()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
