// List all users who were billed for missed calls in January 2026
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listJanuaryBilledUsers() {
  try {
    console.log('📊 January 2026 Missed Call Billing Summary\n');
    console.log('='.repeat(100));

    // Get all January missed call transactions
    const januaryStart = '2026-01-01T00:00:00.000Z';
    const januaryEnd = '2026-01-31T23:59:59.999Z';

    const { data: transactions, error: txnError } = await supabase
      .from('billing_transactions')
      .select('agent_email, agent_associate_id, amount_usd, transaction_date')
      .eq('transaction_type', 'missed_call')
      .eq('status', 'completed')
      .gte('transaction_date', januaryStart)
      .lte('transaction_date', januaryEnd)
      .order('agent_email', { ascending: true });

    if (txnError) {
      console.error('❌ Error fetching transactions:', txnError);
      return;
    }

    // Group by user
    const userMap = new Map();
    transactions.forEach(txn => {
      const email = txn.agent_email?.toLowerCase()?.trim();
      if (!email) return;

      if (!userMap.has(email)) {
        userMap.set(email, {
          email: email,
          associateId: txn.agent_associate_id,
          count: 0,
          totalAmount: 0,
          transactions: []
        });
      }

      const user = userMap.get(email);
      user.count++;
      user.totalAmount += Number(txn.amount_usd) || 4.00;
      user.transactions.push(txn.transaction_date);
    });

    // Get current user_credits values
    const emails = Array.from(userMap.keys());
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('email, missed_calls, aoi_missed_calls, credits_used, credits_remaining')
      .in('email', emails);

    const creditsMap = new Map();
    if (credits) {
      credits.forEach(c => {
        creditsMap.set(c.email.toLowerCase(), c);
      });
    }

    // Sort by total amount (descending)
    const sortedUsers = Array.from(userMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);

    console.log(`\n📋 BILLED USERS (${sortedUsers.length} total):\n`);
    console.log('Email'.padEnd(45) + 'Associate ID'.padEnd(15) + 'Calls'.padEnd(8) + 'Amount'.padEnd(12) + 'In user_credits');
    console.log('-'.repeat(100));

    let grandTotalCalls = 0;
    let grandTotalAmount = 0;

    sortedUsers.forEach(user => {
      const credit = creditsMap.get(user.email);
      const inCredits = credit ? `$${credit.missed_calls.toFixed(2)}/${credit.aoi_missed_calls}` : 'NOT FOUND';
      
      console.log(
        user.email.padEnd(45) +
        String(user.associateId || 'N/A').padEnd(15) +
        String(user.count).padEnd(8) +
        `$${user.totalAmount.toFixed(2)}`.padEnd(12) +
        inCredits
      );

      grandTotalCalls += user.count;
      grandTotalAmount += user.totalAmount;
    });

    console.log('\n' + '='.repeat(100));
    console.log(`\n📊 TOTALS:`);
    console.log(`   Total Users Billed: ${sortedUsers.length}`);
    console.log(`   Total Missed Calls: ${grandTotalCalls}`);
    console.log(`   Total Amount: $${grandTotalAmount.toFixed(2)}`);

    // Show top 10
    console.log(`\n🏆 TOP 10 BY AMOUNT:\n`);
    sortedUsers.slice(0, 10).forEach((user, idx) => {
      const credit = creditsMap.get(user.email);
      console.log(`${idx + 1}. ${user.email}`);
      console.log(`   January: ${user.count} calls = $${user.totalAmount.toFixed(2)}`);
      if (credit) {
        console.log(`   In user_credits: $${credit.missed_calls.toFixed(2)} / ${credit.aoi_missed_calls} calls`);
        console.log(`   Credits Used: $${credit.credits_used.toFixed(2)}, Remaining: $${credit.credits_remaining.toFixed(2)}`);
      } else {
        console.log(`   ⚠️  NOT FOUND in user_credits`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

listJanuaryBilledUsers();
