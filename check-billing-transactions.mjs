/**
 * Quick check script to verify billing transactions
 */
import { supabaseAdmin } from './server/supabase.js';

async function checkBillingTransactions() {
  console.log('📊 Checking billing_transactions table...\n');
  
  // Count by type
  const { data: counts, error: countError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_type', { count: 'exact', head: true });
  
  const { data: byType } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_type')
    .limit(10000);
  
  const typeCounts = {};
  byType?.forEach(t => {
    typeCounts[t.transaction_type] = (typeCounts[t.transaction_type] || 0) + 1;
  });
  
  console.log('📈 Transaction counts by type:');
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });
  
  // Get total count
  const { count: totalCount } = await supabaseAdmin
    .from('billing_transactions')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total billing_transactions: ${totalCount}`);
  
  // Sample records
  const { data: samples } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, transaction_type, agent_email, amount_usd, transaction_date, source_table, source_id')
    .order('transaction_date', { ascending: false })
    .limit(5);
  
  console.log('\n📋 Sample transactions (most recent):');
  samples?.forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.transaction_type} - ${t.agent_email} - $${t.amount_usd} - ${t.transaction_date?.substring(0, 10)}`);
  });
}

checkBillingTransactions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });




