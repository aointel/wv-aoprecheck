/**
 * Check hannahjames@aoglobelife.com transactions - they have 62 transactions with 0 credits
 * These should be CHARGES but credits_charged is 0
 */

import { supabaseAdmin } from './server/supabase';

async function checkHannahjamesTransactions() {
  console.log(`🔍 Checking hannahjames@aoglobelife.com transactions\n`);
  console.log('='.repeat(70));

  try {
    const email = 'hannahjames@aoglobelife.com';

    // Get all billing_transactions
    const { data: transactions, error } = await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('agent_email', email)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`📊 Found ${transactions?.length || 0} billing transactions\n`);

    if (!transactions || transactions.length === 0) {
      console.log('No transactions found');
      return;
    }

    // Group by transaction_type
    const byType = new Map<string, {
      count: number;
      totalCredits: number;
      transactions: any[];
    }>();

    transactions.forEach(t => {
      const type = t.transaction_type || 'unknown';
      const credits = Number(t.credits_charged) || 0;

      if (!byType.has(type)) {
        byType.set(type, {
          count: 0,
          totalCredits: 0,
          transactions: []
        });
      }

      const stats = byType.get(type)!;
      stats.count++;
      stats.totalCredits += credits;
      stats.transactions.push(t);
    });

    console.log(`\n📋 BREAKDOWN BY TRANSACTION TYPE:\n`);

    let totalExpected = 0;
    let totalActual = 0;

    byType.forEach((stats, type) => {
      // Determine expected credits per transaction type
      let expectedPerTransaction = 0;
      switch (type) {
        case 'connect':
          expectedPerTransaction = 8; // AOI Connect rate
          break;
        case 'missed_call':
          expectedPerTransaction = 4; // Missed call rate
          break;
        case 'recruit':
          expectedPerTransaction = 5; // Recruit rate
          break;
        case 'precheck':
          expectedPerTransaction = 3; // Precheck rate
          break;
        default:
          expectedPerTransaction = 0;
      }

      const expectedTotal = stats.count * expectedPerTransaction;
      const actualTotal = stats.totalCredits;
      const missing = expectedTotal - actualTotal;

      console.log(`\n${type.toUpperCase()}:`);
      console.log(`   Count: ${stats.count} transactions`);
      console.log(`   Expected credits per transaction: ${expectedPerTransaction}`);
      console.log(`   Expected total: ${expectedTotal} credits`);
      console.log(`   Actual total: ${actualTotal} credits`);
      console.log(`   ❌ MISSING: ${missing} credits`);

      totalExpected += expectedTotal;
      totalActual += actualTotal;
    });

    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total transactions: ${transactions.length}`);
    console.log(`   Expected credits (total): ${totalExpected}`);
    console.log(`   Actual credits charged: ${totalActual}`);
    console.log(`   ❌ TOTAL MISSING: ${totalExpected - totalActual} credits`);

    // Show sample transactions
    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n📋 SAMPLE TRANSACTIONS (first 10):\n`);

    transactions.slice(0, 10).forEach((t, idx) => {
      console.log(`${idx + 1}. ${t.transaction_type} | Date: ${t.transaction_date} | Credits: ${t.credits_charged} | Amount: $${t.amount_usd}`);
    });

    // Check user_credits
    const { data: userCredit } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    console.log(`\n${'='.repeat(70)}`);
    console.log(`\n💳 USER_CREDITS STATUS:`);
    if (userCredit) {
      console.log(`   Email: ${userCredit.email}`);
      console.log(`   Credits used: ${userCredit.credits_used}`);
      console.log(`   Credits remaining: ${userCredit.credits_remaining}`);
      console.log(`   Credits purchased: ${userCredit.credits_purchased}`);
    } else {
      console.log(`   ❌ NO user_credits RECORD FOUND`);
    }

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

checkHannahjamesTransactions()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
