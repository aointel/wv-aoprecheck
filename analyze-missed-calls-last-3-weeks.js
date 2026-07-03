// Analyze missed calls from billing_transactions for the last 3 weeks
// Excludes missed calls that occur within 30 minutes of each other
import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function analyzeMissedCalls() {
  try {
    console.log('📊 Analyzing Missed Calls from Last 3 Weeks\n');
    console.log('=' .repeat(70));

    // Calculate date range (3 weeks ago)
    const now = new Date();
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21); // 3 weeks = 21 days

    console.log(`📅 Date Range: ${threeWeeksAgo.toLocaleDateString()} to ${now.toLocaleDateString()}\n`);

    // Step 1: Get all missed call transactions from the last 3 weeks
    console.log('📊 Step 1: Fetching missed call transactions...');
    const { data: allTransactions, error: fetchError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('transaction_type', 'missed_call')
      .gte('transaction_date', threeWeeksAgo.toISOString())
      .order('transaction_date', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching transactions:', fetchError);
      return;
    }

    console.log(`✅ Found ${allTransactions?.length || 0} total missed call transactions\n`);

    if (!allTransactions || allTransactions.length === 0) {
      console.log('⚠️  No missed call transactions found in the last 3 weeks');
      return;
    }

    // Step 2: Filter out transactions within 30 minutes of each other (per user)
    console.log('📊 Step 2: Filtering out missed calls within 30 minutes of each other...');
    
    const filteredTransactions = [];
    const userLastTransactionTime = new Map(); // Track last transaction time per user

    for (const txn of allTransactions) {
      const email = txn.agent_email?.toLowerCase();
      if (!email) continue;

      const txnTime = new Date(txn.transaction_date);
      const lastTime = userLastTransactionTime.get(email);

      // If no previous transaction for this user, or more than 30 minutes have passed
      if (!lastTime || (txnTime.getTime() - lastTime.getTime()) > 30 * 60 * 1000) {
        filteredTransactions.push(txn);
        userLastTransactionTime.set(email, txnTime);
      } else {
        const minutesDiff = Math.round((txnTime.getTime() - lastTime.getTime()) / (1000 * 60));
        console.log(`   ⏭️  Excluding ${email}: ${minutesDiff} minutes after previous call`);
      }
    }

    const excludedCount = (allTransactions.length || 0) - filteredTransactions.length;
    console.log(`✅ Filtered: ${filteredTransactions.length} unique missed calls (excluded ${excludedCount} within 30 min)\n`);

    // Step 3: Group by user and calculate totals
    console.log('📊 Step 3: Calculating totals per user...\n');
    
    const userTotals = new Map();

    filteredTransactions.forEach(txn => {
      const email = txn.agent_email?.toLowerCase();
      if (!email) return;

      if (!userTotals.has(email)) {
        userTotals.set(email, {
          email: email,
          associateId: txn.agent_associate_id || 'N/A',
          agentName: txn.agent_name || 'N/A',
          count: 0,
          totalAmount: 0,
          transactions: []
        });
      }

      const user = userTotals.get(email);
      user.count++;
      user.totalAmount += Number(txn.amount_usd) || 0;
      user.transactions.push({
        date: txn.transaction_date,
        amount: Number(txn.amount_usd) || 0,
        phone: txn.lead_phone || 'N/A'
      });
    });

    // Step 4: Sort by total amount (descending) and display
    const sortedUsers = Array.from(userTotals.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);

    console.log('📋 Missed Calls Summary (Last 3 Weeks, Excluding <30min duplicates):');
    console.log('=' .repeat(70));
    console.log(`${'User'.padEnd(40)} ${'Count'.padStart(6)} ${'Total $'.padStart(10)}`);
    console.log('-'.repeat(70));

    let grandTotalCount = 0;
    let grandTotalAmount = 0;

    sortedUsers.forEach((user, idx) => {
      grandTotalCount += user.count;
      grandTotalAmount += user.totalAmount;
      
      const displayName = user.agentName !== 'N/A' ? user.agentName : user.email.split('@')[0];
      const nameDisplay = displayName.length > 38 ? displayName.substring(0, 35) + '...' : displayName;
      
      console.log(`${(idx + 1).toString().padStart(3)}. ${nameDisplay.padEnd(40)} ${user.count.toString().padStart(6)} $${user.totalAmount.toFixed(2).padStart(9)}`);
    });

    console.log('-'.repeat(70));
    console.log(`${'TOTAL'.padEnd(44)} ${grandTotalCount.toString().padStart(6)} $${grandTotalAmount.toFixed(2).padStart(9)}`);
    console.log('=' .repeat(70));

    // Step 5: Detailed breakdown for top 10 users
    console.log('\n📊 Top 10 Users - Detailed Breakdown:');
    console.log('=' .repeat(70));

    sortedUsers.slice(0, 10).forEach((user, idx) => {
      console.log(`\n${idx + 1}. ${user.agentName !== 'N/A' ? user.agentName : user.email}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Associate ID: ${user.associateId}`);
      console.log(`   Total Missed Calls: ${user.count}`);
      console.log(`   Total Amount: $${user.totalAmount.toFixed(2)}`);
      console.log(`   Average per Call: $${(user.totalAmount / user.count).toFixed(2)}`);
      
      // Show date range of their missed calls
      const dates = user.transactions.map(t => new Date(t.date)).sort((a, b) => a - b);
      if (dates.length > 0) {
        console.log(`   Date Range: ${dates[0].toLocaleDateString()} to ${dates[dates.length - 1].toLocaleDateString()}`);
      }

      // Show breakdown by date
      const byDate = new Map();
      user.transactions.forEach(txn => {
        const dateStr = new Date(txn.date).toLocaleDateString();
        if (!byDate.has(dateStr)) {
          byDate.set(dateStr, { count: 0, amount: 0 });
        }
        const day = byDate.get(dateStr);
        day.count++;
        day.amount += txn.amount;
      });

      console.log(`   Breakdown by Date:`);
      Array.from(byDate.entries())
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .forEach(([date, data]) => {
          console.log(`      ${date}: ${data.count} calls = $${data.amount.toFixed(2)}`);
        });
    });

    // Step 6: Summary statistics
    console.log('\n📊 Summary Statistics:');
    console.log('=' .repeat(70));
    console.log(`Total Users Affected: ${sortedUsers.length}`);
    console.log(`Total Missed Calls (after filtering): ${grandTotalCount}`);
    console.log(`Total Amount: $${grandTotalAmount.toFixed(2)}`);
    console.log(`Average per User: $${(grandTotalAmount / sortedUsers.length).toFixed(2)}`);
    console.log(`Average per Call: $${(grandTotalAmount / grandTotalCount).toFixed(2)}`);
    
    if (excludedCount > 0) {
      console.log(`\n⚠️  Note: ${excludedCount} missed calls were excluded (occurred within 30 minutes of previous call)`);
    }

    console.log('\n' + '=' .repeat(70));
    console.log('✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

analyzeMissedCalls();

