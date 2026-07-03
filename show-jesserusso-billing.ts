/**
 * Show all billing transactions for jesserusso@aoglobelife.com
 */

import { supabaseAdmin } from './server/supabase';

async function showAllBillingTransactions() {
  const email = 'jesserusso@aoglobelife.com';
  console.log(`📊 All billing transactions for ${email}\n`);
  console.log('='.repeat(70));

  try {
    // Get ALL billing transactions (no limit)
    const { data: transactions, error } = await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('agent_email', email)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`✅ Found ${transactions?.length || 0} total billing transactions\n`);

    // Group by transaction type
    const byType: Record<string, { count: number; totalCredits: number; totalAmount: number }> = {};
    transactions?.forEach(t => {
      const type = t.transaction_type || 'unknown';
      if (!byType[type]) {
        byType[type] = { count: 0, totalCredits: 0, totalAmount: 0 };
      }
      byType[type].count++;
      byType[type].totalCredits += Number(t.credits_charged) || 0;
      byType[type].totalAmount += Number(t.amount_usd) || 0;
    });

    console.log('📊 Summary by transaction type:');
    Object.entries(byType).forEach(([type, stats]) => {
      console.log(`   ${type}: ${stats.count} transactions | ${stats.totalCredits} credits | $${stats.totalAmount.toFixed(2)}`);
    });

    const totalCredits = transactions?.reduce((sum, t) => sum + (Number(t.credits_charged) || 0), 0) || 0;
    const totalAmount = transactions?.reduce((sum, t) => sum + (Number(t.amount_usd) || 0), 0) || 0;

    console.log(`\n💰 TOTAL: ${transactions?.length || 0} transactions | ${totalCredits} credits | $${totalAmount.toFixed(2)}`);

    console.log(`\n📋 All transactions (showing first 100):`);
    transactions?.slice(0, 100).forEach((t, i) => {
      console.log(`${(i + 1).toString().padStart(3)}. ${t.transaction_type?.padEnd(12)} | $${String(t.amount_usd).padStart(6)} | ${String(t.credits_charged).padStart(3)} credits | ${t.transaction_date} | ${t.lead_name || 'N/A'}`);
    });

    if ((transactions?.length || 0) > 100) {
      console.log(`\n... and ${(transactions?.length || 0) - 100} more transactions`);
    }

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

showAllBillingTransactions()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
