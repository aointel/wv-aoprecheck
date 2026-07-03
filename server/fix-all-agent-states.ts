/**
 * Fix Script: Fix all agents with incorrectly formatted states
 * 
 * This script finds all agents in the customers table where states are stored
 * as a comma-separated string instead of an array, and fixes them.
 * 
 * Run with: tsx server/fix-all-agent-states.ts [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be fixed without actually updating
 */

import { supabaseAdmin } from './supabase';

const DRY_RUN = process.argv.includes('--dry-run');

function parseArrayField(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      return [parsed].filter(Boolean);
    } catch {
      // If not JSON, treat as comma-separated string
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function needsFix(states: any): boolean {
  if (!states) return false;
  
  // If it's an array with exactly one element that contains commas, it needs fixing
  if (Array.isArray(states)) {
    if (states.length === 1 && typeof states[0] === 'string' && states[0].includes(',')) {
      return true;
    }
    // If it's an array of multiple elements, check if any contain commas (should be individual states)
    if (states.some(s => typeof s === 'string' && s.includes(','))) {
      return true;
    }
  }
  
  // If it's a string (not an array), it needs fixing
  if (typeof states === 'string' && states.trim() !== '') {
    return true;
  }
  
  return false;
}

function fixStates(states: any): string[] {
  if (!states) return [];
  
  let parsed = parseArrayField(states);
  
  // Handle case where states is stored as a single comma-separated string
  if (parsed.length === 1 && parsed[0].includes(',')) {
    parsed = parsed[0].split(',').map(s => s.trim()).filter(Boolean);
  }
  
  // Also handle case where array contains comma-separated strings
  const fixed: string[] = [];
  for (const item of parsed) {
    if (typeof item === 'string' && item.includes(',')) {
      // Split and add each state
      const split = item.split(',').map(s => s.trim()).filter(Boolean);
      fixed.push(...split);
    } else {
      fixed.push(item);
    }
  }
  
  // Remove duplicates and normalize
  return [...new Set(fixed.map(s => s.toUpperCase().trim()))].filter(Boolean);
}

async function fixAllAgentStates() {
  console.log(`\n🔧 FIXING ALL AGENT STATES\n`);
  console.log('='.repeat(80));
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  // Get all customers with pagination (Supabase row limits can silently cap large tables)
  console.log('📋 Fetching all customers (paginated)...');
  const customers: any[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let page = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data: batch, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('id, company_email, personal_email, associate_id, first_name, last_name, states, market')
      .or('company_email.not.is.null,personal_email.not.is.null')
      .range(from, to);

    if (fetchError) {
      console.error(`❌ Error fetching customers page ${page + 1}:`, fetchError);
      process.exit(1);
    }

    const rows = batch ?? [];
    if (rows.length === 0) break;

    customers.push(...rows);
    page += 1;

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (customers.length === 0) {
    console.log('⚠️ No customers found');
    process.exit(0);
  }
  
  console.log(`✅ Found ${customers.length} customers\n`);
  
  // Find customers that need fixing
  const needsFixing: any[] = [];
  
  for (const customer of customers) {
    const email = customer.company_email || customer.personal_email;
    if (!email) continue;
    
    if (needsFix(customer.states)) {
      const fixedStates = fixStates(customer.states);
      needsFixing.push({
        id: customer.id,
        email: email,
        associate_id: customer.associate_id,
        name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || email,
        currentStates: customer.states,
        fixedStates: fixedStates,
        market: customer.market
      });
    }
  }
  
  console.log(`📊 Found ${needsFixing.length} agents with incorrectly formatted states\n`);
  
  if (needsFixing.length === 0) {
    console.log('✅ All agents have correctly formatted states!');
    process.exit(0);
  }
  
  // Show what will be fixed
  console.log('📋 Agents that need fixing:');
  console.log('='.repeat(80));
  
  for (let i = 0; i < needsFixing.length; i++) {
    const agent = needsFixing[i];
    console.log(`\n${i + 1}. ${agent.name} (${agent.email})`);
    console.log(`   Associate ID: ${agent.associate_id || 'N/A'}`);
    console.log(`   Current: ${JSON.stringify(agent.currentStates)}`);
    console.log(`   Fixed:   ${JSON.stringify(agent.fixedStates)}`);
  }
  
  console.log(`\n` + '='.repeat(80));
  
  if (DRY_RUN) {
    console.log(`\n🔍 DRY RUN: Would fix ${needsFixing.length} agents`);
    console.log(`   Run without --dry-run to apply fixes`);
    process.exit(0);
  }
  
  // Fix them
  console.log(`\n🔧 Fixing ${needsFixing.length} agents...\n`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < needsFixing.length; i++) {
    const agent = needsFixing[i];
    const progress = `[${i + 1}/${needsFixing.length}]`;
    
    try {
      const { error: updateError } = await supabaseAdmin
        .from('customers')
        .update({
          states: agent.fixedStates
        })
        .eq('id', agent.id);
      
      if (updateError) {
        console.error(`${progress} ❌ Failed to fix ${agent.email}:`, updateError);
        errorCount++;
      } else {
        console.log(`${progress} ✅ Fixed ${agent.email}: ${JSON.stringify(agent.fixedStates)}`);
        fixedCount++;
      }
    } catch (error: any) {
      console.error(`${progress} ❌ Error fixing ${agent.email}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\n` + '='.repeat(80));
  console.log(`\n🎉 FIX COMPLETE:`);
  console.log(`   ✅ Fixed: ${fixedCount} agents`);
  console.log(`   ❌ Errors: ${errorCount} agents`);
  console.log(`   📊 Total: ${needsFixing.length} agents\n`);
  
  if (fixedCount > 0) {
    console.log(`✅ All fixed agents should now receive leads correctly via webhook!`);
  }
  
  console.log('='.repeat(80) + `\n`);
}

// Run the fix
fixAllAgentStates()
  .then(() => {
    console.log('✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });








