/**
 * Check for missed call billing transactions in Supabase
 * 
 * Run with: tsx server/check-missed-call-transactions.ts
 */

import { supabaseAdmin } from './supabase';

async function checkMissedCallTransactions() {
  console.log('\n🔍 CHECKING MISSED CALL BILLING TRANSACTIONS\n');
  console.log('='.repeat(80));
  
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }
  
  // Check for the specific transaction we just created
  const phoneNumber = '8137707009';
  const agentEmail = 'daeshawagnergonzalez@aoglobelife.com';
  
  console.log(`\n📋 Checking for missed call transactions...`);
  console.log(`   Phone: ${phoneNumber}`);
  console.log(`   Agent: ${agentEmail}`);
  console.log(`   Type: missed_call\n`);
  
  // Check recent missed call transactions for this phone
  const { data: phoneTxns, error: phoneError } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .eq('lead_phone', phoneNumber)
    .eq('transaction_type', 'missed_call')
    .order('transaction_date', { ascending: false })
    .limit(10);
  
  if (phoneError) {
    console.error(`❌ Error fetching transactions by phone: ${phoneError.message}`);
  } else {
    console.log(`\n📞 Transactions for phone ${phoneNumber}:`);
    if (phoneTxns && phoneTxns.length > 0) {
      phoneTxns.forEach((txn, idx) => {
        const meta = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
        console.log(`\n   ${idx + 1}. ${txn.transaction_id}`);
        console.log(`      Date: ${txn.transaction_date}`);
        console.log(`      Agent: ${txn.agent_email}`);
        console.log(`      Amount: $${txn.amount_usd}`);
        console.log(`      Wait: ${meta?.waiting_duration_formatted || 'N/A'}`);
        console.log(`      Description: ${txn.description}`);
      });
    } else {
      console.log(`   ⚠️  No transactions found for this phone number`);
    }
  }
  
  // Check recent missed call transactions for this agent
  const { data: agentTxns, error: agentError } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .eq('agent_email', agentEmail)
    .eq('transaction_type', 'missed_call')
    .order('transaction_date', { ascending: false })
    .limit(10);
  
  if (agentError) {
    console.error(`❌ Error fetching transactions by agent: ${agentError.message}`);
  } else {
    console.log(`\n\n👤 Transactions for agent ${agentEmail}:`);
    if (agentTxns && agentTxns.length > 0) {
      agentTxns.forEach((txn, idx) => {
        const meta = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
        console.log(`\n   ${idx + 1}. ${txn.transaction_id}`);
        console.log(`      Date: ${txn.transaction_date}`);
        console.log(`      Phone: ${txn.lead_phone}`);
        console.log(`      Amount: $${txn.amount_usd}`);
        console.log(`      Wait: ${meta?.waiting_duration_formatted || 'N/A'}`);
        console.log(`      Description: ${txn.description}`);
      });
    } else {
      console.log(`   ⚠️  No transactions found for this agent`);
    }
  }
  
  // Check ALL recent missed call transactions (last 24 hours)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: recentTxns, error: recentError } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .eq('transaction_type', 'missed_call')
    .gte('transaction_date', yesterday.toISOString())
    .order('transaction_date', { ascending: false })
    .limit(20);
  
  if (recentError) {
    console.error(`❌ Error fetching recent transactions: ${recentError.message}`);
  } else {
    console.log(`\n\n⏰ ALL missed call transactions (last 24 hours):`);
    if (recentTxns && recentTxns.length > 0) {
      console.log(`   Found ${recentTxns.length} transactions:\n`);
      recentTxns.forEach((txn, idx) => {
        const meta = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
        console.log(`   ${idx + 1}. ${txn.transaction_id}`);
        console.log(`      Date: ${txn.transaction_date}`);
        console.log(`      Agent: ${txn.agent_email}`);
        console.log(`      Phone: ${txn.lead_phone}`);
        console.log(`      Amount: $${txn.amount_usd}`);
        console.log(`      Wait: ${meta?.waiting_duration_formatted || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log(`   ⚠️  No missed call transactions found in the last 24 hours`);
    }
  }
  
  // Check if the webhook handler is actually creating transactions
  console.log(`\n\n🔍 Checking webhook processing...`);
  console.log(`   Looking for transactions created in the last 5 minutes...`);
  
  const fiveMinutesAgo = new Date();
  fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
  
  const { data: veryRecentTxns, error: veryRecentError } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .eq('transaction_type', 'missed_call')
    .gte('transaction_date', fiveMinutesAgo.toISOString())
    .order('transaction_date', { ascending: false });
  
  if (veryRecentError) {
    console.error(`❌ Error: ${veryRecentError.message}`);
  } else if (veryRecentTxns && veryRecentTxns.length > 0) {
    console.log(`   ✅ Found ${veryRecentTxns.length} very recent transactions:`);
    veryRecentTxns.forEach((txn, idx) => {
      console.log(`      ${idx + 1}. ${txn.transaction_id} - ${txn.agent_email} - ${txn.lead_phone}`);
    });
  } else {
    console.log(`   ⚠️  No transactions created in the last 5 minutes`);
    console.log(`   💡 This suggests the webhook may not be creating transactions`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

checkMissedCallTransactions()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });








