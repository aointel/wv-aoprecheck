// Test script to verify missed calls are being applied to user_credits
import { createClient } from '@supabase/supabase-js';

// Supabase credentials from hardcoded-config
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testMissedCallsBilling() {
  try {
    console.log('🧪 Testing Missed Calls Billing Application to user_credits\n');
    console.log('=' .repeat(70));

    // Step 1: Check for recent missed call billing transactions
    console.log('\n📊 Step 1: Checking recent missed call billing transactions...');
    const { data: recentTransactions, error: txnError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('transaction_type', 'missed_call')
      .order('transaction_date', { ascending: false })
      .limit(10);

    if (txnError) {
      console.error('❌ Error fetching billing transactions:', txnError);
    } else {
      console.log(`✅ Found ${recentTransactions?.length || 0} recent missed call transactions`);
      if (recentTransactions && recentTransactions.length > 0) {
        console.log('\n📋 Recent Missed Call Transactions:');
        recentTransactions.forEach((txn, idx) => {
          console.log(`  ${idx + 1}. ${txn.agent_email} - $${txn.amount_usd} - ${new Date(txn.transaction_date).toLocaleString()}`);
        });
      }
    }

    // Step 2: Check user_credits for missed_calls amounts
    console.log('\n📊 Step 2: Checking user_credits for missed_calls...');
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('email, associate_id, name, missed_calls, aoi_missed_calls, credits_purchased, credits_remaining, credits_used, updated_at')
      .gt('missed_calls', 0)
      .order('missed_calls', { ascending: false })
      .limit(20);

    if (creditsError) {
      console.error('❌ Error fetching user_credits:', creditsError);
    } else {
      console.log(`✅ Found ${userCredits?.length || 0} users with missed_calls > 0`);
      if (userCredits && userCredits.length > 0) {
        console.log('\n📋 Users with Missed Call Charges:');
        let totalMissedCalls = 0;
        userCredits.forEach((user, idx) => {
          const missedCalls = Number(user.missed_calls) || 0;
          const missedCallCount = Number(user.aoi_missed_calls) || 0;
          totalMissedCalls += missedCalls;
          console.log(`  ${idx + 1}. ${user.email || 'N/A'}`);
          console.log(`     Associate ID: ${user.associate_id || 'N/A'}`);
          console.log(`     Missed Calls Count: ${missedCallCount}`);
          console.log(`     Missed Calls Amount: $${missedCalls.toFixed(2)}`);
          console.log(`     Credits Purchased: $${(Number(user.credits_purchased) || 0).toFixed(2)}`);
          console.log(`     Credits Remaining: $${(Number(user.credits_remaining) || 0).toFixed(2)}`);
          console.log(`     Credits Used: $${(Number(user.credits_used) || 0).toFixed(2)}`);
          console.log(`     Last Updated: ${new Date(user.updated_at).toLocaleString()}`);
          console.log('');
        });
        console.log(`💰 Total Missed Call Charges: $${totalMissedCalls.toFixed(2)}`);
      } else {
        console.log('⚠️  No users found with missed_calls > 0');
      }
    }

    // Step 3: Verify consistency between billing_transactions and user_credits
    console.log('\n📊 Step 3: Verifying consistency between billing_transactions and user_credits...');
    
    if (recentTransactions && recentTransactions.length > 0 && userCredits && userCredits.length > 0) {
      const emailToCredits = new Map();
      userCredits.forEach(user => {
        emailToCredits.set(user.email?.toLowerCase(), {
          missed_calls: Number(user.missed_calls) || 0,
          aoi_missed_calls: Number(user.aoi_missed_calls) || 0
        });
      });

      const emailToTransactions = new Map();
      recentTransactions.forEach(txn => {
        const email = txn.agent_email?.toLowerCase();
        if (email) {
          if (!emailToTransactions.has(email)) {
            emailToTransactions.set(email, []);
          }
          emailToTransactions.get(email).push({
            amount: Number(txn.amount_usd) || 0,
            date: txn.transaction_date
          });
        }
      });

      console.log('\n🔍 Consistency Check:');
      let consistent = 0;
      let inconsistent = 0;

      emailToCredits.forEach((credits, email) => {
        const transactions = emailToTransactions.get(email) || [];
        const totalFromTransactions = transactions.reduce((sum, txn) => sum + txn.amount, 0);
        const expectedAmount = credits.aoi_missed_calls * 4.00; // $4 per missed call

        if (Math.abs(credits.missed_calls - totalFromTransactions) < 0.01) {
          console.log(`  ✅ ${email}: Consistent ($${credits.missed_calls.toFixed(2)} in credits, $${totalFromTransactions.toFixed(2)} in transactions)`);
          consistent++;
        } else {
          console.log(`  ⚠️  ${email}: INCONSISTENT`);
          console.log(`     Credits: $${credits.missed_calls.toFixed(2)}`);
          console.log(`     Transactions: $${totalFromTransactions.toFixed(2)}`);
          console.log(`     Expected (${credits.aoi_missed_calls} calls × $4): $${expectedAmount.toFixed(2)}`);
          inconsistent++;
        }
      });

      console.log(`\n📊 Consistency Summary: ${consistent} consistent, ${inconsistent} inconsistent`);
    }

    // Step 4: Check for any missed calls in the last 24 hours
    console.log('\n📊 Step 4: Checking for missed calls in the last 24 hours...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentMissedCalls, error: recentError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('transaction_type', 'missed_call')
      .gte('transaction_date', yesterday.toISOString())
      .order('transaction_date', { ascending: false });

    if (recentError) {
      console.error('❌ Error fetching recent missed calls:', recentError);
    } else {
      console.log(`✅ Found ${recentMissedCalls?.length || 0} missed call transactions in the last 24 hours`);
      if (recentMissedCalls && recentMissedCalls.length > 0) {
        const totalAmount = recentMissedCalls.reduce((sum, txn) => sum + (Number(txn.amount_usd) || 0), 0);
        console.log(`💰 Total amount: $${totalAmount.toFixed(2)}`);
        
        // Group by agent
        const byAgent = new Map();
        recentMissedCalls.forEach(txn => {
          const email = txn.agent_email?.toLowerCase();
          if (email) {
            if (!byAgent.has(email)) {
              byAgent.set(email, { count: 0, amount: 0 });
            }
            const agent = byAgent.get(email);
            agent.count++;
            agent.amount += Number(txn.amount_usd) || 0;
          }
        });

        console.log('\n📋 Missed Calls by Agent (Last 24 Hours):');
        Array.from(byAgent.entries())
          .sort((a, b) => b[1].amount - a[1].amount)
          .slice(0, 10)
          .forEach(([email, data]) => {
            console.log(`  ${email}: ${data.count} calls = $${data.amount.toFixed(2)}`);
          });
      }
    }

    console.log('\n' + '=' .repeat(70));
    console.log('✅ Test complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testMissedCallsBilling();

