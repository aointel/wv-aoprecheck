// Test script to debug missed calls matching on Live Call Board
// Uses the exact same query logic as routes-live-call-board-simplified.ts

import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Copy of getTodayEST from calculate-dial-reach-booked-realtime.ts
function getTodayEST() {
  const now = new Date();
  
  // Get current date in EST/EDT
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const estDateParts = estFormatter.formatToParts(now);
  const year = estDateParts.find(p => p.type === 'year').value;
  const month = estDateParts.find(p => p.type === 'month').value;
  const day = estDateParts.find(p => p.type === 'day').value;
  
  // Determine if we're in DST (rough: March-November, but check actual date)
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  
  // DST typically: 2nd Sunday in March to 1st Sunday in November
  // Simplified: March 10 - November 3 (covers most cases)
  let isDST = false;
  if (monthNum > 3 && monthNum < 11) {
    isDST = true;
  } else if (monthNum === 3 && dayNum >= 10) {
    isDST = true;
  } else if (monthNum === 11 && dayNum < 3) {
    isDST = true;
  }
  
  const offsetHours = isDST ? -4 : -5; // EDT = UTC-4, EST = UTC-5
  
  // Create date strings for EST/EDT midnight and start of next day
  const estStartStr = `${year}-${month}-${day}T00:00:00`;
  
  // Calculate tomorrow's date in EST
  const tomorrow = new Date(`${year}-${month}-${day}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowYear = tomorrow.getFullYear();
  const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const tomorrowDay = String(tomorrow.getDate()).padStart(2, '0');
  const estEndStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}T00:00:00`;
  
  // Create Date objects in EST/EDT, then convert to UTC
  const offsetStr = offsetHours < 0 
    ? `-${Math.abs(offsetHours).toString().padStart(2, '0')}:00`
    : `+${offsetHours.toString().padStart(2, '0')}:00`;
  
  const start = new Date(`${estStartStr}${offsetStr}`);
  const end = new Date(`${estEndStr}${offsetStr}`);
  
  return { start, end };
}

// Copy of getDateRangeForTimePeriod for 'realtime'
function getDateRangeForTimePeriod(timePeriod) {
  if (timePeriod === 'realtime' || timePeriod === 'day') {
    return getTodayEST();
  }
  // For now, just return today for simplicity
  return getTodayEST();
}

async function testMissedCalls() {
  try {
    console.log('🔍 Testing Missed Calls Query (Same as Live Call Board)\n');
    console.log('='.repeat(80));

    // Use same date range logic as Live Call Board
    const timePeriod = 'realtime'; // Default time period
    const { start: dateStart, end: dateEnd } = getDateRangeForTimePeriod(
      timePeriod,
      undefined,
      undefined
    );

    console.log(`📅 Date Range (${timePeriod}):`);
    console.log(`   Start: ${dateStart.toISOString()}`);
    console.log(`   End: ${dateEnd.toISOString()}`);
    console.log('');

    // Test specific agent
    const testAgentEmail = 'lanebeasley@aoglobelife.com';
    console.log(`🎯 Testing for agent: ${testAgentEmail}`);
    console.log('');

    // Step 1: Query missed calls using EXACT same logic as Live Call Board
    console.log('📊 Step 1: Fetching missed calls from billing_transactions...');
    const missedCallsData = [];
    let missedCallsOffset = 0;
    const missedCallsBatchSize = 1000;
    let hasMoreMissedCalls = true;

    while (hasMoreMissedCalls) {
      const { data: missedCallsBatch, error: missedCallsError } = await supabase
        .from('billing_transactions')
        .select('agent_email, transaction_date, transaction_id, amount_usd')
        .eq('transaction_type', 'missed_call')
        .gte('transaction_date', dateStart.toISOString())
        .lt('transaction_date', dateEnd.toISOString())
        .not('agent_email', 'is', null)
        .neq('agent_email', '')
        .order('transaction_date', { ascending: false })
        .range(missedCallsOffset, missedCallsOffset + missedCallsBatchSize - 1);

      if (missedCallsError) {
        console.error('❌ Error fetching billing_transactions for missed calls:', missedCallsError);
        hasMoreMissedCalls = false;
        break;
      }

      if (missedCallsBatch && missedCallsBatch.length > 0) {
        missedCallsData.push(...missedCallsBatch);
        missedCallsOffset += missedCallsBatchSize;

        if (missedCallsBatch.length < missedCallsBatchSize) {
          hasMoreMissedCalls = false;
        }
      } else {
        hasMoreMissedCalls = false;
      }
    }

    console.log(`✅ Found ${missedCallsData.length} total missed calls in date range`);
    console.log('');

    // Step 2: Count missed calls per email (same logic as Live Call Board)
    console.log('📊 Step 2: Counting missed calls per email...');
    const missedCallsMap = new Map();
    missedCallsData.forEach((row) => {
      if (row.agent_email) {
        const email = String(row.agent_email).toLowerCase().trim();
        missedCallsMap.set(email, (missedCallsMap.get(email) || 0) + 1);
      }
    });

    console.log(`✅ Total unique agents with missed calls: ${missedCallsMap.size}`);
    console.log('');

    // Step 3: Check specific agent
    console.log('📊 Step 3: Checking specific agent...');
    const normalizedTestEmail = testAgentEmail.toLowerCase().trim();
    const testAgentCount = missedCallsMap.get(normalizedTestEmail) || 0;

    console.log(`   Agent Email: ${testAgentEmail}`);
    console.log(`   Normalized: ${normalizedTestEmail}`);
    console.log(`   Count in Map: ${testAgentCount}`);
    console.log(`   Map Has Key: ${missedCallsMap.has(normalizedTestEmail)}`);
    console.log('');

    // Step 4: Find all transactions for this agent
    const agentTransactions = missedCallsData.filter((row) => {
      if (!row.agent_email) return false;
      const email = String(row.agent_email).toLowerCase().trim();
      return email === normalizedTestEmail || email.includes('lanebeasley');
    });

    console.log(`📊 Step 4: Found ${agentTransactions.length} transactions for lanebeasley:`);
    if (agentTransactions.length > 0) {
      agentTransactions.forEach((txn, idx) => {
        console.log(`   ${idx + 1}. ${txn.transaction_id}`);
        console.log(`      Email: ${txn.agent_email} (normalized: ${String(txn.agent_email).toLowerCase().trim()})`);
        console.log(`      Date: ${txn.transaction_date}`);
        console.log(`      Amount: $${txn.amount_usd}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  No transactions found!');
      console.log('');
    }

    // Step 5: Check if transaction date is within range
    console.log('📊 Step 5: Checking date range matching...');
    const testTransactionDate = '2026-01-24T18:06:44.027Z'; // From user's data
    const testDate = new Date(testTransactionDate);
    console.log(`   Test Transaction Date: ${testDate.toISOString()}`);
    console.log(`   Date Start: ${dateStart.toISOString()}`);
    console.log(`   Date End: ${dateEnd.toISOString()}`);
    console.log(`   Is >= Start: ${testDate >= dateStart}`);
    console.log(`   Is < End: ${testDate < dateEnd}`);
    console.log(`   Is In Range: ${testDate >= dateStart && testDate < dateEnd}`);
    console.log('');

    // Step 6: Show all map keys containing 'lanebeasley'
    console.log('📊 Step 6: All map keys containing "lanebeasley":');
    const matchingKeys = Array.from(missedCallsMap.keys()).filter((k) =>
      k.includes('lanebeasley')
    );
    if (matchingKeys.length > 0) {
      matchingKeys.forEach((key) => {
        console.log(`   - "${key}": ${missedCallsMap.get(key)} missed calls`);
      });
    } else {
      console.log('   ⚠️  No keys found containing "lanebeasley"');
    }
    console.log('');

    // Step 7: Show sample of all missed calls (first 10)
    console.log('📊 Step 7: Sample of missed calls (first 10 agents):');
    const sampleEntries = Array.from(missedCallsMap.entries()).slice(0, 10);
    sampleEntries.forEach(([email, count]) => {
      console.log(`   ${email}: ${count} missed calls`);
    });
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ Test complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testMissedCalls()
  .then(() => {
    console.log('✅ Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
