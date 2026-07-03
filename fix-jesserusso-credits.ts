/**
 * Fix jesserusso@aoglobelife.com credits
 * Syncs billing_transactions to user_credits
 */

import { supabaseAdmin } from './server/supabase';

async function fixJesserussoCredits() {
  const email = 'jesserusso@aoglobelife.com';
  console.log(`🔧 Fixing credits for ${email}\n`);
  console.log('='.repeat(70));

  try {
    // Step 1: Get customer info
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('associate_id, company_email, personal_email')
      .or(`company_email.eq.${email},personal_email.eq.${email}`)
      .maybeSingle();

    if (!customer) {
      console.error(`❌ Customer not found for ${email}`);
      return;
    }

    console.log(`✅ Found customer: associate_id=${customer.associate_id}`);

    // Step 2: Get all billing_transactions
    const { data: transactions } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_type, credits_charged, amount_usd, transaction_date')
      .eq('agent_email', email)
      .order('transaction_date', { ascending: true });

    if (!transactions || transactions.length === 0) {
      console.log(`⚠️ No billing transactions found`);
      return;
    }

    console.log(`\n📊 Found ${transactions.length} billing transactions`);

    // Step 3: Calculate total credits used
    let totalCreditsUsed = 0;
    let aoiConnectCreditsUsed = 0;
    let missedCallCreditsUsed = 0;
    let recruitCreditsUsed = 0;
    let precheckCreditsUsed = 0;

    transactions.forEach(t => {
      const credits = Number(t.credits_charged) || 0;
      totalCreditsUsed += credits;

      switch (t.transaction_type) {
        case 'connect':
          aoiConnectCreditsUsed += credits;
          break;
        case 'missed_call':
          missedCallCreditsUsed += credits;
          break;
        case 'recruit':
          recruitCreditsUsed += credits;
          break;
        case 'precheck':
          precheckCreditsUsed += credits;
          break;
      }
    });

    console.log(`\n💰 Credit breakdown:`);
    console.log(`   Total credits used: ${totalCreditsUsed}`);
    console.log(`   AO Connect: ${aoiConnectCreditsUsed}`);
    console.log(`   Missed Calls: ${missedCallCreditsUsed}`);
    console.log(`   Recruit: ${recruitCreditsUsed}`);
    console.log(`   PreCheck: ${precheckCreditsUsed}`);

    // Step 4: Get current user_credits
    const { data: userCredit } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!userCredit) {
      console.error(`❌ user_credits record not found for ${email}`);
      return;
    }

    const creditsPurchased = Number(userCredit.credits_purchased) || 0;
    const currentCreditsUsed = Number(userCredit.credits_used) || 0;
    const currentCreditsRemaining = Number(userCredit.credits_remaining) || 0;

    console.log(`\n📊 Current user_credits:`);
    console.log(`   Credits purchased: ${creditsPurchased}`);
    console.log(`   Credits used: ${currentCreditsUsed}`);
    console.log(`   Credits remaining: ${currentCreditsRemaining}`);
    console.log(`   Associate ID: ${userCredit.associate_id || 'NULL (THIS IS THE PROBLEM!)'}`);

    // Step 5: Update user_credits
    const newCreditsUsed = totalCreditsUsed;
    const newCreditsRemaining = creditsPurchased - newCreditsUsed;

    console.log(`\n🔄 Updating user_credits:`);
    console.log(`   New credits_used: ${newCreditsUsed}`);
    console.log(`   New credits_remaining: ${newCreditsRemaining}`);
    console.log(`   Setting associate_id: ${customer.associate_id}`);

    // Build update object with only columns that exist
    const updateData: any = {
      credits_used: newCreditsUsed,
      credits_remaining: newCreditsRemaining,
      associate_id: customer.associate_id, // FIX: Set associate_id so sync works
      updated_at: new Date().toISOString()
    };

    // Add service-specific columns if they exist (check what columns are actually in the table)
    if (aoiConnectCreditsUsed > 0) {
      updateData.aoi_connect_credits_used = aoiConnectCreditsUsed;
    }
    if (recruitCreditsUsed > 0) {
      updateData.aoi_recruit_credits_used = recruitCreditsUsed;
    }
    if (precheckCreditsUsed > 0) {
      updateData.aoi_precheck_credits_used = precheckCreditsUsed;
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update(updateData)
      .eq('email', email);

    if (updateError) {
      console.error(`❌ Error updating user_credits:`, updateError);
      return;
    }

    console.log(`\n✅ Successfully updated user_credits for ${email}`);
    console.log(`   Credits used: ${currentCreditsUsed} -> ${newCreditsUsed}`);
    console.log(`   Credits remaining: ${currentCreditsRemaining} -> ${newCreditsRemaining}`);
    console.log(`   Associate ID: ${userCredit.associate_id || 'NULL'} -> ${customer.associate_id}`);

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run the fix
fixJesserussoCredits()
  .then(() => {
    console.log('\n✅ Credit fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Credit fix failed:', error);
    process.exit(1);
  });
