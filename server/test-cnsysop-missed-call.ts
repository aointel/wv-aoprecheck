/**
 * Test script to create a missed call for cnsysop and verify billing/notification
 */

import { supabaseAdmin } from './supabase';
import { processMissedCallBilling } from './missed-call-billing-from-csv';
import { format, subHours } from 'date-fns';

async function testCnsysopMissedCall() {
  console.log('🧪 Testing missed call billing for cnsysop@aoglobelife.com\n');

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin not available');
    process.exit(1);
  }

  try {
    // Step 1: Get cnsysop's associate_id
    console.log('📋 Step 1: Looking up cnsysop@aoglobelife.com...');
    
    const { data: cnsysop } = await supabaseAdmin
      .from('user_credits')
      .select('email, associate_id, name')
      .eq('email', 'cnsysop@aoglobelife.com')
      .maybeSingle();

    if (!cnsysop || !cnsysop.associate_id) {
      console.error('❌ Could not find cnsysop in user_credits table');
      
      // Try customers table
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, associate_id, first_name, last_name')
        .eq('company_email', 'cnsysop@aoglobelife.com')
        .maybeSingle();

      if (!customer || !customer.associate_id) {
        console.error('❌ Could not find cnsysop in customers table either');
        process.exit(1);
      }

      console.log(`   ✅ Found cnsysop in customers: associate_id = ${customer.associate_id}`);
      console.log(`   Name: ${customer.first_name} ${customer.last_name}\n`);
      
      // Use customer associate_id
      var associateId = customer.associate_id.toString();
    } else {
      console.log(`   ✅ Found cnsysop: associate_id = ${cnsysop.associate_id}`);
      console.log(`   Name: ${cnsysop.name}\n`);
      var associateId = cnsysop.associate_id.toString();
    }

    // Step 2: Create a test BLASTER event (missed call) in vdp_calls_BLASTPICK
    console.log('📞 Step 2: Creating test missed call (BLASTER event)...');
    
    const testPhone = `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`; // Random 10-digit number
    const testTime = subHours(new Date(), 1); // 1 hour ago
    
    console.log(`   Test phone: ${testPhone}`);
    console.log(`   Test time: ${testTime.toISOString()}`);
    console.log(`   Agent ID: ${associateId}\n`);

    // Check if a PICK_UP event exists for this phone today (we don't want one - that's the point)
    const todayStart = new Date(testTime);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(testTime);
    todayEnd.setHours(23, 59, 59, 999);

    const { data: existingPickups } = await supabaseAdmin
      .from('vdp_calls_BLASTPICK')
      .select('id')
      .eq('event', 'PICK_UP')
      .eq('phone', testPhone)
      .gte('time', todayStart.toISOString())
      .lte('time', todayEnd.toISOString())
      .limit(1);

    if (existingPickups && existingPickups.length > 0) {
      console.log(`   ⚠️ Warning: Found existing PICK_UP for ${testPhone} today - this won't be a missed call`);
      console.log(`   Using different phone number...\n`);
      // Use a different phone
      testPhone = `+1${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    }

    // Insert BLASTER event (no PICK_UP = missed call)
    // Only include columns that actually exist in the table
    const { error: insertError } = await supabaseAdmin
      .from('vdp_calls_BLASTPICK')
      .insert({
        event: 'BLASTER',
        phone: testPhone,
        agent: associateId,
        time: testTime.toISOString(),
        // Don't include params - column doesn't exist
      });

    if (insertError) {
      console.error('❌ Failed to insert test BLASTER event:', insertError);
      console.error('   Error details:', insertError.message);
      process.exit(1);
    }

    console.log('   ✅ Test BLASTER event created\n');

    // Step 3: Run the missed call billing processor
    console.log('🔄 Step 3: Processing missed call billing...\n');
    
    // Process just today's date to speed things up
    const todayStr = format(testTime, 'yyyy-MM-dd');
    await processMissedCallBilling(todayStr);

    console.log('\n✅ Step 3 complete\n');

    // Step 4: Check if billing transaction was created
    console.log('💰 Step 4: Checking for billing transaction...');
    
    const transactionId = `missed-call-${testPhone}-${format(testTime, 'yyyy-MM-dd')}-${format(testTime, 'HH-mm-ss')}`.replace(/[^a-zA-Z0-9-]/g, '-');
    
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('billing_transactions')
      .select('*')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (txError) {
      console.error('❌ Error checking transaction:', txError);
    } else if (transaction) {
      console.log('   ✅ Billing transaction created!');
      console.log(`   Transaction ID: ${transaction.transaction_id}`);
      console.log(`   Amount: $${transaction.amount_usd}`);
      console.log(`   Agent: ${transaction.agent_email}`);
      console.log(`   Date: ${transaction.transaction_date}\n`);
    } else {
      console.log('   ⚠️ No billing transaction found with exact transaction_id');
      console.log('   Checking for any missed call transactions for cnsysop today...\n');
      
      const { data: recentTransactions } = await supabaseAdmin
        .from('billing_transactions')
        .select('*')
        .eq('transaction_type', 'missed_call')
        .eq('agent_email', 'cnsysop@aoglobelife.com')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentTransactions && recentTransactions.length > 0) {
        console.log(`   ✅ Found ${recentTransactions.length} missed call transaction(s) for cnsysop today:`);
        recentTransactions.forEach((tx, idx) => {
          console.log(`   ${idx + 1}. ${tx.transaction_id} - $${tx.amount_usd} - ${tx.transaction_date}`);
        });
        console.log('');
      } else {
        console.log('   ❌ No missed call transactions found for cnsysop today\n');
      }
    }

    // Step 5: Check if notification was created
    console.log('🔔 Step 5: Checking for notification...');
    
    const { data: notifications, error: notifError } = await supabaseAdmin
      .from('agent_notifications')
      .select('*')
      .eq('agent_email', 'cnsysop@aoglobelife.com')
      .eq('notification_type', 'billing_transaction')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (notifError) {
      console.error('❌ Error checking notifications:', notifError);
    } else if (notifications && notifications.length > 0) {
      console.log(`   ✅ Found ${notifications.length} billing notification(s) for cnsysop today:`);
      notifications.forEach((notif, idx) => {
        console.log(`   ${idx + 1}. ${notif.title}`);
        console.log(`      Message: ${notif.message}`);
        console.log(`      Read: ${notif.read}`);
        console.log(`      Created: ${notif.created_at}\n`);
      });
    } else {
      console.log('   ⚠️ No billing notifications found for cnsysop today\n');
    }

    // Cleanup: Delete the test BLASTER event (optional)
    console.log('🧹 Step 6: Cleaning up test data...');
    const { error: deleteError } = await supabaseAdmin
      .from('vdp_calls_BLASTPICK')
      .delete()
      .eq('event', 'BLASTER')
      .eq('phone', testPhone)
      .eq('time', testTime.toISOString());

    if (deleteError) {
      console.warn('   ⚠️ Could not delete test BLASTER event:', deleteError.message);
    } else {
      console.log('   ✅ Test BLASTER event deleted\n');
    }

    console.log('✅ Test completed!\n');
    console.log('📝 Summary:');
    console.log(`   - Test phone: ${testPhone}`);
    console.log(`   - Agent: cnsysop@aoglobelife.com (associate_id: ${associateId})`);
    console.log(`   - Check your dashboard for the missed call notification!\n`);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error);
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run test
testCnsysopMissedCall()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });

