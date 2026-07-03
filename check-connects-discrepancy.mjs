import { createClient } from '@supabase/supabase-js';

// Hardcoded values from server/hardcoded-config.ts
const SUPABASE_URL = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkConnectsDiscrepancy() {
  console.log('🔍 Checking connects discrepancy...\n');

  // Get today's date range in EST
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  todayStart.setMinutes(todayStart.getMinutes() - todayStart.getTimezoneOffset());
  
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  console.log(`📅 Date range: ${todayStart.toISOString()} to ${todayEnd.toISOString()}\n`);

  // Get connects from billing_transactions
  const { data: billingConnects, error: billingError } = await supabase
    .from('billing_transactions')
    .select('agent_email, transaction_id, transaction_date')
    .eq('transaction_type', 'connect')
    .gte('transaction_date', todayStart.toISOString())
    .lt('transaction_date', todayEnd.toISOString())
    .not('agent_email', 'is', null);

  if (billingError) {
    console.error('❌ Error fetching billing_transactions:', billingError);
    return;
  }

  // Count by agent
  const billingCounts = new Map();
  (billingConnects || []).forEach(transaction => {
    const email = String(transaction.agent_email).toLowerCase().trim();
    billingCounts.set(email, (billingCounts.get(email) || 0) + 1);
  });

  console.log(`💰 BILLING_TRANSACTIONS:`);
  console.log(`   Total connect transactions today: ${billingConnects?.length || 0}`);
  console.log(`   Unique agents with connects: ${billingCounts.size}`);
  console.log(`\n   Top 10 agents by connects:`);
  const sortedBilling = Array.from(billingCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sortedBilling.forEach(([email, count]) => {
    console.log(`     ${email}: ${count} connects`);
  });

  // Get connects from live_call_boardt
  const { data: boardData, error: boardError } = await supabase
    .from('live_call_boardt')
    .select('agent_email, today_connects')
    .gt('today_connects', 0);

  if (boardError) {
    console.error('❌ Error fetching live_call_boardt:', boardError);
    return;
  }

  const boardCounts = new Map();
  (boardData || []).forEach(row => {
    const email = String(row.agent_email).toLowerCase().trim();
    boardCounts.set(email, row.today_connects || 0);
  });

  console.log(`\n📊 LIVE_CALL_BOARDT:`);
  console.log(`   Total agents with connects > 0: ${boardData?.length || 0}`);
  console.log(`   Total connects shown: ${Array.from(boardCounts.values()).reduce((a, b) => a + b, 0)}`);
  console.log(`\n   Top 10 agents by connects:`);
  const sortedBoard = Array.from(boardCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sortedBoard.forEach(([email, count]) => {
    console.log(`     ${email}: ${count} connects`);
  });

  // Compare
  console.log(`\n🔍 COMPARISON:`);
  
  const allAgents = new Set([...billingCounts.keys(), ...boardCounts.keys()]);
  const missingFromBoard = [];
  const mismatched = [];
  const missingFromBilling = [];

  allAgents.forEach(email => {
    const billingCount = billingCounts.get(email) || 0;
    const boardCount = boardCounts.get(email) || 0;

    if (billingCount > 0 && boardCount === 0) {
      missingFromBoard.push({ email, billingCount });
    } else if (billingCount !== boardCount) {
      mismatched.push({ email, billingCount, boardCount });
    } else if (boardCount > 0 && billingCount === 0) {
      missingFromBilling.push({ email, boardCount });
    }
  });

  if (missingFromBoard.length > 0) {
    console.log(`\n❌ AGENTS WITH CONNECTS IN BILLING BUT NOT ON BOARD (${missingFromBoard.length}):`);
    missingFromBoard.slice(0, 20).forEach(({ email, billingCount }) => {
      console.log(`     ${email}: ${billingCount} connects in billing, 0 on board`);
    });
    if (missingFromBoard.length > 20) {
      console.log(`     ... and ${missingFromBoard.length - 20} more`);
    }
  }

  if (mismatched.length > 0) {
    console.log(`\n⚠️  AGENTS WITH MISMATCHED COUNTS (${mismatched.length}):`);
    mismatched.slice(0, 20).forEach(({ email, billingCount, boardCount }) => {
      console.log(`     ${email}: ${billingCount} in billing, ${boardCount} on board (diff: ${billingCount - boardCount})`);
    });
    if (mismatched.length > 20) {
      console.log(`     ... and ${mismatched.length - 20} more`);
    }
  }

  if (missingFromBilling.length > 0) {
    console.log(`\n⚠️  AGENTS WITH CONNECTS ON BOARD BUT NOT IN BILLING (${missingFromBilling.length}):`);
    missingFromBilling.slice(0, 10).forEach(({ email, boardCount }) => {
      console.log(`     ${email}: ${boardCount} on board, 0 in billing`);
    });
  }

  const totalBillingConnects = Array.from(billingCounts.values()).reduce((a, b) => a + b, 0);
  const totalBoardConnects = Array.from(boardCounts.values()).reduce((a, b) => a + b, 0);

  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total connects in billing_transactions: ${totalBillingConnects}`);
  console.log(`   Total connects on live_call_boardt: ${totalBoardConnects}`);
  console.log(`   Difference: ${totalBillingConnects - totalBoardConnects}`);
  console.log(`   Missing from board: ${missingFromBoard.length} agents`);
  console.log(`   Mismatched counts: ${mismatched.length} agents`);
}

checkConnectsDiscrepancy().catch(console.error);
