/**
 * Check Billing Summary from billing_transactions
 * Verifies that billing data is being pulled correctly from billing_transactions table
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Supabase credentials from hardcoded config
let supabaseUrl, supabaseServiceKey;
try {
  const configPath = join(__dirname, 'server', 'hardcoded-config.ts');
  const configContent = readFileSync(configPath, 'utf-8');
  
  // Extract SUPABASE_URL and SUPABASE_SERVICE_KEY
  const urlMatch = configContent.match(/SUPABASE_URL['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
  const keyMatch = configContent.match(/SUPABASE_SERVICE_KEY['"]?\s*[:=]\s*['"]([^'"]+)['"]/);
  
  if (urlMatch && keyMatch) {
    supabaseUrl = urlMatch[1];
    supabaseServiceKey = keyMatch[1];
  } else {
    throw new Error('Could not extract credentials from config file');
  }
} catch (error) {
  console.error('❌ Error reading config:', error.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Get current rolling week (Thursday to Wednesday PST)
 */
function getCurrentRollingWeek() {
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8
  const pstNow = new Date(now.getTime() + (now.getTimezoneOffset() + pstOffset) * 60 * 1000);
  
  // Find most recent Thursday
  let weekStart = new Date(pstNow);
  const dayOfWeek = weekStart.getDay(); // 0 = Sunday, 4 = Thursday
  const daysSinceThursday = (dayOfWeek + 3) % 7; // Days since last Thursday
  if (daysSinceThursday > 0) {
    weekStart = new Date(weekStart.getTime() - daysSinceThursday * 24 * 60 * 60 * 1000);
  }
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Wednesday
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date as ISO string for query
 */
function formatDateISO(date) {
  return date.toISOString();
}

async function checkBillingSummary() {
  console.log('🔍 Checking Billing Summary from billing_transactions...\n');
  
  const { weekStart, weekEnd } = getCurrentRollingWeek();
  const weekStartStr = formatDate(weekStart);
  const weekEndStr = formatDate(weekEnd);
  const weekStartISO = formatDateISO(weekStart);
  const weekEndISO = formatDateISO(weekEnd);
  
  console.log(`📅 Week: ${weekStartStr} (Thursday) to ${weekEndStr} (Wednesday) PST`);
  console.log(`📅 ISO Range: ${weekStartISO} to ${weekEndISO}\n`);
  
  // Query all billing transactions for the week
  console.log('📊 Querying billing_transactions...');
  const { data: transactions, error: transactionsError } = await supabase
    .from('billing_transactions')
    .select('transaction_type, transaction_date, amount_usd, metadata, status')
    .gte('transaction_date', weekStartISO)
    .lte('transaction_date', weekEndISO)
    .eq('status', 'completed')
    .order('transaction_date', { ascending: true });
  
  if (transactionsError) {
    console.error('❌ Error querying billing_transactions:', transactionsError);
    return;
  }
  
  console.log(`✅ Found ${transactions?.length || 0} completed billing transactions\n`);
  
  // Group by transaction type and market
  const byType = {
    connect: [],
    precheck: [],
    recruit: [],
    missed_call: [],
    other: []
  };
  
  const byMarket = {
    'Veteran': { connect: 0, missed: 0, total: 0 },
    'Globe Market': { connect: 0, missed: 0, total: 0 },
    'aorecruit': { connect: 0, missed: 0, total: 0 },
    'Other': { connect: 0, missed: 0, total: 0 }
  };
  
  const byDate = new Map();
  
  if (transactions) {
    for (const tx of transactions) {
      // Group by type
      if (byType[tx.transaction_type]) {
        byType[tx.transaction_type].push(tx);
      } else {
        byType.other.push(tx);
      }
      
      // Get date
      const dateObj = new Date(tx.transaction_date);
      const dateStr = formatDate(dateObj);
      
      // Get market from metadata
      const metadata = tx.metadata || {};
      const market = metadata.market || 'Veteran';
      
      // Initialize date map
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, {
          connect: { Veteran: 0, 'Globe Market': 0, aorecruit: 0, Other: 0 },
          precheck: 0,
          recruit: 0,
          missed_call: 0,
          total: 0
        });
      }
      
      const dayData = byDate.get(dateStr);
      dayData.total++;
      
      // Count by type and market
      if (tx.transaction_type === 'connect') {
        const marketKey = byMarket[market] ? market : 'Other';
        byMarket[marketKey].connect++;
        byMarket[marketKey].total++;
        dayData.connect[marketKey] = (dayData.connect[marketKey] || 0) + 1;
      } else if (tx.transaction_type === 'precheck') {
        dayData.precheck++;
      } else if (tx.transaction_type === 'recruit') {
        dayData.recruit++;
      } else if (tx.transaction_type === 'missed_call') {
        const marketKey = byMarket[market] ? market : 'Other';
        byMarket[marketKey].missed++;
        byMarket[marketKey].total++;
        dayData.missed_call++;
      }
    }
  }
  
  // Print summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 BILLING SUMMARY BY TRANSACTION TYPE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Connect:        ${byType.connect.length} transactions`);
  console.log(`Pre-Check:      ${byType.precheck.length} transactions`);
  console.log(`Recruit:        ${byType.recruit.length} transactions`);
  console.log(`Missed Calls:   ${byType.missed_call.length} transactions`);
  console.log(`Other:          ${byType.other.length} transactions`);
  console.log(`TOTAL:          ${transactions?.length || 0} transactions\n`);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 BILLING SUMMARY BY MARKET');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const [market, data] of Object.entries(byMarket)) {
    if (data.total > 0) {
      console.log(`${market.padEnd(15)} Connects: ${String(data.connect).padStart(4)} | Missed: ${String(data.missed).padStart(4)} | Total: ${String(data.total).padStart(4)}`);
    }
  }
  console.log();
  
  // Calculate totals for billing summary
  const veteranBilled = byMarket['Veteran'].connect;
  const globeBilled = byMarket['Globe Market'].connect;
  const aorecruitBilled = byMarket['aorecruit'].connect;
  const precheckBilled = byType.precheck.length;
  const missedCalls = byType.missed_call.length;
  
  const veteranBilling = veteranBilled * 8;
  const globeBilling = globeBilled * 8;
  const aorecruitBilling = aorecruitBilled * 5;
  const precheckBilling = precheckBilled * 5;
  const missedCallsBilling = missedCalls * 4;
  
  const totalBilling = veteranBilling + globeBilling + aorecruitBilling + precheckBilling + missedCallsBilling;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('💰 BILLING SUMMARY TOTALS (What should show in dashboard)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total: $${totalBilling.toFixed(2)}\n`);
  console.log(`Veteran:        $${veteranBilling.toFixed(2)} (${veteranBilled} billed @ $8)`);
  console.log(`Globe Market:   $${globeBilling.toFixed(2)} (${globeBilled} billed @ $8)`);
  console.log(`AO Recruit:     $${aorecruitBilling.toFixed(2)} (${aorecruitBilled} billed @ $5)`);
  console.log(`Pre-Check:      $${precheckBilling.toFixed(2)} (${precheckBilled} billed @ $5)`);
  console.log(`Missed Calls:   $${missedCallsBilling.toFixed(2)} (${missedCalls} missed @ $4)\n`);
  
  // Print daily breakdown
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📅 DAILY BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════════');
  const sortedDates = Array.from(byDate.keys()).sort();
  for (const dateStr of sortedDates) {
    const dayData = byDate.get(dateStr);
    console.log(`\n${dateStr}:`);
    console.log(`  Total Transactions: ${dayData.total}`);
    console.log(`  Connects:`);
    for (const [market, count] of Object.entries(dayData.connect)) {
      if (count > 0) {
        console.log(`    ${market}: ${count}`);
      }
    }
    if (dayData.precheck > 0) {
      console.log(`  Pre-Check: ${dayData.precheck}`);
    }
    if (dayData.recruit > 0) {
      console.log(`  Recruit: ${dayData.recruit}`);
    }
    if (dayData.missed_call > 0) {
      console.log(`  Missed Calls: ${dayData.missed_call}`);
    }
  }
  
  console.log('\n✅ Billing summary check complete!');
}

// Run the check
checkBillingSummary().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

