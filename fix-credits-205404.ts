/**
 * Fix credits_used for associate_id 205404 based on billing_transactions
 */

import { supabaseAdmin } from './server/supabase';

async function fixCredits() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  const associateId = 205404;
  const email = 'carlosfarge@aoglobelife.com';

  console.log(`🔧 Fixing credits_used for associate_id ${associateId} (${email})\n`);

  // Get all billing transactions for this email
  const { data: transactions, error: txError } = await supabaseAdmin
    .from('billing_transactions')
    .select('transaction_id, agent_email, transaction_date, credits_charged, transaction_type')
    .eq('agent_email', email)
    .order('transaction_date', { ascending: false });

  if (txError) {
    console.error('❌ Error fetching transactions:', txError);
    process.exit(1);
  }

  console.log(`📊 Found ${transactions?.length || 0} billing transactions\n`);

  if (!transactions || transactions.length === 0) {
    console.log('❌ No transactions found');
    process.exit(0);
  }

  // Calculate total credits charged by transaction type
  let totalCreditsUsed = 0;
  let aoiConnectCreditsUsed = 0;

  transactions.forEach(t => {
    const credits = Number(t.credits_charged) || 0;
    totalCreditsUsed += credits;

    if (t.transaction_type === 'connect') {
      aoiConnectCreditsUsed += credits;
    }
  });

  console.log(`💰 Total credits charged: ${totalCreditsUsed}`);
  console.log(`   AO Connect: ${aoiConnectCreditsUsed}\n`);

  // Get customer info to get associate_id
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('associate_id, company_email, personal_email')
    .eq('associate_id', associateId)
    .maybeSingle();

  // Get current user_credits record
  const { data: userCredit, error: creditError } = await supabaseAdmin
    .from('user_credits')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (creditError) {
    console.error('❌ Error fetching user_credits:', creditError);
    process.exit(1);
  }

  if (!userCredit) {
    console.log(`⚠️ No user_credits record found for ${email}, creating one...`);
    
    const creditsPurchased = 0;
    const newCreditsRemaining = creditsPurchased - totalCreditsUsed;

    const { data: newRecord, error: createError } = await supabaseAdmin
      .from('user_credits')
      .insert({
        email: email,
        credits_used: totalCreditsUsed,
        credits_remaining: newCreditsRemaining,
        credits_purchased: creditsPurchased,
        associate_id: customer?.associate_id?.toString() || null,
        aoi_connect_credits_used: aoiConnectCreditsUsed,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating user_credits:', createError);
      process.exit(1);
    }

    console.log(`✅ Created user_credits record:`);
    console.log(`   credits_used: ${totalCreditsUsed}`);
    console.log(`   credits_remaining: ${newCreditsRemaining}`);
  } else {
    const creditsPurchased = Number(userCredit.credits_purchased) || 0;
    const currentCreditsUsed = Number(userCredit.credits_used) || 0;
    const currentCreditsRemaining = Number(userCredit.credits_remaining) || 0;

    console.log(`📊 Current user_credits:`);
    console.log(`   credits_purchased: ${creditsPurchased}`);
    console.log(`   credits_used: ${currentCreditsUsed}`);
    console.log(`   credits_remaining: ${currentCreditsRemaining}`);
    console.log(`   Expected credits_used: ${totalCreditsUsed}`);

    const newCreditsRemaining = creditsPurchased - totalCreditsUsed;

    console.log(`\n🔄 Updating user_credits:`);
    console.log(`   New credits_used: ${totalCreditsUsed}`);
    console.log(`   New credits_remaining: ${newCreditsRemaining}`);

    // Build update object (credits_remaining is a generated column, so don't update it)
    const updateData: any = {
      credits_used: totalCreditsUsed,
      updated_at: new Date().toISOString()
    };

    if (customer?.associate_id) {
      updateData.associate_id = customer.associate_id.toString();
    }

    if (aoiConnectCreditsUsed > 0) {
      updateData.aoi_connect_credits_used = aoiConnectCreditsUsed;
    }

    const { error: updateError } = await supabaseAdmin
      .from('user_credits')
      .update(updateData)
      .eq('email', email);

    if (updateError) {
      console.error('❌ Error updating user_credits:', updateError);
      process.exit(1);
    }

    // Verify the update
    const { data: verified, error: verifyError } = await supabaseAdmin
      .from('user_credits')
      .select('email, credits_used, credits_remaining, credits_purchased')
      .eq('email', email)
      .single();

    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError);
    } else {
      console.log(`\n✅ Updated user_credits (verified):`);
      console.log(`   credits_used: ${verified.credits_used} (was ${currentCreditsUsed})`);
      console.log(`   credits_remaining: ${verified.credits_remaining} (was ${currentCreditsRemaining})`);
      console.log(`   credits_purchased: ${verified.credits_purchased}`);
    }
  }

  console.log(`\n✅ Done!`);
}

fixCredits().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
