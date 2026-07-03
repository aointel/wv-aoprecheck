/**
 * Bill jesserusso@aoglobelife.com for ALL billing transactions
 * Syncs all 368 transactions (2,280 credits) to user_credits
 */

import { supabaseAdmin } from './server/supabase';

async function billJesserussoAllTransactions() {
  const email = 'jesserusso@aoglobelife.com';
  console.log(`💳 Billing ${email} for ALL transactions\n`);
  console.log('='.repeat(70));

  try {
    // Step 1: Get all billing_transactions
    const { data: transactions, error: txnError } = await supabaseAdmin
      .from('billing_transactions')
      .select('transaction_type, credits_charged, amount_usd')
      .eq('agent_email', email);

    if (txnError) {
      console.error('❌ Error fetching billing_transactions:', txnError);
      return;
    }

    if (!transactions || transactions.length === 0) {
      console.log('⚠️ No billing transactions found');
      return;
    }

    console.log(`📊 Found ${transactions.length} billing transactions`);

    // Step 2: Calculate totals
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

    // Step 3: Get current user_credits
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

    console.log(`\n📊 Current user_credits:`);
    console.log(`   Credits purchased: ${creditsPurchased}`);
    console.log(`   Credits used: ${currentCreditsUsed}`);
    console.log(`   Credits remaining: ${userCredit.credits_remaining}`);

    // Step 4: Update user_credits (credits_remaining is generated, so we only update credits_used)
    console.log(`\n🔄 Updating user_credits:`);
    console.log(`   Setting credits_used: ${totalCreditsUsed}`);
    console.log(`   Setting aoi_connect_credits_used: ${aoiConnectCreditsUsed}`);

    const updateData: any = {
      credits_used: totalCreditsUsed,
      aoi_connect_credits_used: aoiConnectCreditsUsed,
      updated_at: new Date().toISOString()
    };

    if (recruitCreditsUsed > 0) {
      updateData.aoi_recruit_credits_used = recruitCreditsUsed;
    }
    if (precheckCreditsUsed > 0) {
      updateData.aoi_precheck_credits_used = precheckCreditsUsed;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update(updateData)
      .eq('email', email)
      .select()
      .single();

    if (updateError) {
      console.error(`❌ Error updating user_credits:`, updateError);
      return;
    }

    console.log(`\n✅ Successfully billed ${email} for ALL transactions!`);
    console.log(`   Credits used: ${currentCreditsUsed} -> ${totalCreditsUsed}`);
    console.log(`   Credits remaining: ${userCredit.credits_remaining} -> ${updated.credits_remaining}`);
    console.log(`   Total transactions billed: ${transactions.length}`);

    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

billJesserussoAllTransactions()
  .then(() => {
    console.log('\n✅ Billing complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Billing failed:', error);
    process.exit(1);
  });
