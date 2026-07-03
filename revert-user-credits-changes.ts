/**
 * Revert recent changes to user_credits table
 * This will check for records that were recently updated and attempt to restore them
 */

import { supabaseAdmin } from './server/supabase';

async function revertUserCreditsChanges() {
  console.log(`🔙 Reverting recent user_credits changes\n`);
  console.log('='.repeat(70));

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    process.exit(1);
  }

  try {
    // Get all user_credits records updated in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    console.log(`📊 Checking for user_credits updated since ${oneHourAgo}...\n`);

    const { data: recentCredits, error: fetchError } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .gte('updated_at', oneHourAgo)
      .order('updated_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching recent credits:', fetchError);
      return;
    }

    if (!recentCredits || recentCredits.length === 0) {
      console.log('ℹ️ No user_credits records updated in the last hour');
      console.log('   If changes were made earlier, please specify which emails to revert');
      return;
    }

    console.log(`❌ Found ${recentCredits.length} user_credits records updated recently:\n`);

    // For each updated record, we need to recalculate credits_used from billing_transactions
    // and see if it differs from current value
    let totalReverted = 0;
    let totalErrors = 0;

    for (const credit of recentCredits) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`\n🔍 Processing: ${credit.email}`);
      console.log(`   Current credits_used: ${credit.credits_used}`);
      console.log(`   Updated at: ${credit.updated_at}`);

      // Find billing transactions for this email
      const { data: transactions, error: txError } = await supabaseAdmin
        .from('billing_transactions')
        .select('*')
        .eq('agent_email', credit.email);

      if (txError) {
        console.error(`   ❌ Error fetching billing transactions: ${txError.message}`);
        totalErrors++;
        continue;
      }

      if (!transactions || transactions.length === 0) {
        console.log(`   ℹ️ No billing transactions found - setting credits_used to 0`);
        
        const { error: updateError } = await supabaseAdmin
          .from('user_credits')
          .update({ credits_used: 0 })
          .eq('email', credit.email);

        if (updateError) {
          console.error(`   ❌ Error reverting: ${updateError.message}`);
          totalErrors++;
        } else {
          console.log(`   ✅ Reverted: ${credit.credits_used} → 0`);
          totalReverted++;
        }
        continue;
      }

      // Calculate what credits_used SHOULD be (SUM of credits_charged)
      const correctCreditsUsed = transactions.reduce((sum, tx) => {
        return sum + (Number(tx.credits_charged) || 0);
      }, 0);

      if (credit.credits_used === correctCreditsUsed) {
        console.log(`   ✅ Credits are correct (${correctCreditsUsed} transactions)`);
        continue;
      }

      console.log(`   📊 Found ${transactions.length} billing transactions`);
      console.log(`   💰 Should be: ${correctCreditsUsed}, Currently: ${credit.credits_used}`);

      // Revert to correct value
      const { error: updateError } = await supabaseAdmin
        .from('user_credits')
        .update({ credits_used: correctCreditsUsed })
        .eq('email', credit.email);

      if (updateError) {
        console.error(`   ❌ Error reverting: ${updateError.message}`);
        totalErrors++;
      } else {
        console.log(`   ✅ Reverted: ${credit.credits_used} → ${correctCreditsUsed}`);
        totalReverted++;
      }
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Records checked: ${recentCredits.length}`);
    console.log(`   Records reverted: ${totalReverted}`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`\n${'='.repeat(70)}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

revertUserCreditsChanges()
  .then(() => {
    console.log('\n✅ Revert complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Revert failed:', error);
    process.exit(1);
  });
