/**
 * Test script for missed call billing
 * 
 * Tests the missed call billing system by:
 * 1. Querying for missed calls from database
 * 2. Attempting to create billing transactions
 * 3. Verifying transactions are created correctly
 */

import { processMissedCallBilling } from './missed-call-billing-from-csv';
import { supabaseAdmin } from './supabase';

async function testMissedCallBilling() {
  console.log('🧪 Starting missed call billing test...\n');

  try {
    // Step 1: Check if billing_transactions table allows 'missed_call' type
    console.log('📋 Step 1: Checking billing_transactions schema...');
    
    if (!supabaseAdmin) {
      throw new Error('❌ Supabase admin client not available');
    }

    // Try to check if we can insert a test transaction (will fail if constraint doesn't allow it)
    const testTransactionId = `test-missed-call-${Date.now()}`;
    const { error: testInsertError } = await supabaseAdmin
      .from('billing_transactions')
      .insert({
        transaction_id: testTransactionId,
        transaction_type: 'missed_call',
        agent_email: 'test@test.com',
        transaction_date: new Date().toISOString(),
        amount_usd: 4.00,
        credits_charged: 4,
        description: 'Test transaction - will be deleted'
      });

    if (testInsertError) {
      if (testInsertError.code === '23514' || testInsertError.message?.includes('check constraint')) {
        console.error('❌ FAILED: billing_transactions table does NOT allow transaction_type = "missed_call"');
        console.error('   Error:', testInsertError.message);
        console.error('\n   SOLUTION: Run the SQL script: server/add-missed-call-transaction-type.sql');
        console.error('   This will add "missed_call" to the allowed transaction types.\n');
        process.exit(1);
      } else {
        console.error('❌ Unexpected error:', testInsertError);
        throw testInsertError;
      }
    } else {
      console.log('✅ Schema check passed - "missed_call" is allowed\n');
      
      // Delete test transaction
      await supabaseAdmin
        .from('billing_transactions')
        .delete()
        .eq('transaction_id', testTransactionId);
    }

    // Step 2: Count existing missed call transactions
    console.log('📊 Step 2: Checking existing missed call transactions...');
    const { data: existingTransactions, error: countError } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, agent_email, amount_usd, transaction_date')
      .eq('transaction_type', 'missed_call')
      .order('created_at', { ascending: false })
      .limit(10);

    if (countError) {
      console.warn('⚠️ Could not query existing transactions:', countError.message);
    } else {
      console.log(`   Found ${existingTransactions?.length || 0} recent missed call transactions\n`);
    }

    // Step 3: Run the missed call billing processor
    console.log('🔄 Step 3: Processing missed calls from database...');
    console.log('   (This may take a moment...)\n');
    
    await processMissedCallBilling();
    
    console.log('\n✅ Step 3 complete: Processing finished\n');

    // Step 4: Verify new transactions were created
    console.log('✅ Step 4: Verifying new transactions...');
    const { data: newTransactions, error: verifyError } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_id, agent_email, amount_usd, transaction_date, lead_phone, agent_name')
      .eq('transaction_type', 'missed_call')
      .order('created_at', { ascending: false })
      .limit(20);

    if (verifyError) {
      console.error('❌ Could not verify transactions:', verifyError);
    } else {
      console.log(`\n📊 Results:`);
      console.log(`   Total missed call transactions in database: ${newTransactions?.length || 0}`);
      
      if (newTransactions && newTransactions.length > 0) {
        console.log(`\n   Recent transactions:`);
        newTransactions.slice(0, 5).forEach((tx, idx) => {
          console.log(`   ${idx + 1}. ${tx.agent_email} - $${tx.amount_usd} - ${tx.lead_phone || 'N/A'} - ${tx.transaction_date}`);
        });
      }
    }

    console.log('\n✅ Test completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run test
testMissedCallBilling()
  .then(() => {
    console.log('✅ Test script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script error:', error);
    process.exit(1);
  });

