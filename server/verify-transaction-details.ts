/**
 * Verify the exact details of the missed call transaction
 */

import { supabaseAdmin } from './supabase';

async function verifyTransaction() {
  const transactionId = 'missed-call-8137707009-2025-12-19-00-20-15-MISSED';
  
  console.log('\n🔍 VERIFYING TRANSACTION DETAILS\n');
  console.log('='.repeat(80));
  console.log(`\nTransaction ID: ${transactionId}\n`);
  
  const { data: txn, error } = await supabaseAdmin
    .from('billing_transactions')
    .select('*')
    .eq('transaction_id', transactionId)
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`   Details: ${JSON.stringify(error, null, 2)}`);
  } else if (txn) {
    console.log('✅ Transaction found in database!\n');
    console.log('Full record:');
    console.log(JSON.stringify(txn, null, 2));
    
    console.log('\n\nKey fields:');
    console.log(`   transaction_id: ${txn.transaction_id}`);
    console.log(`   transaction_type: ${txn.transaction_type}`);
    console.log(`   agent_email: ${txn.agent_email}`);
    console.log(`   agent_associate_id: ${txn.agent_associate_id}`);
    console.log(`   lead_phone: ${txn.lead_phone}`);
    console.log(`   amount_usd: ${txn.amount_usd}`);
    console.log(`   credits_charged: ${txn.credits_charged}`);
    console.log(`   description: ${txn.description}`);
    console.log(`   transaction_date: ${txn.transaction_date}`);
    
    if (txn.metadata) {
      const meta = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata;
      console.log(`\n   Metadata:`);
      console.log(`      event: ${meta.event}`);
      console.log(`      waiting_duration_seconds: ${meta.waiting_duration_seconds}`);
      console.log(`      waiting_duration_formatted: ${meta.waiting_duration_formatted}`);
    }
  } else {
    console.log('❌ Transaction not found!');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

verifyTransaction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });








