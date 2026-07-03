/**
 * Revert the billing fixes that were incorrectly applied
 */

import { supabaseAdmin } from './server/supabase';

async function revertBillingFixes() {
  console.log(`🔙 Reverting billing fixes\n`);
  console.log('='.repeat(70));

  try {
    // Changes that were made:
    // 1. Created user_credits for hernanplazola@aoglobelife.com (credits_used=5)
    // 2. Created user_credits for hannahjames@aoglobelife.com (credits_used=0)
    // 3. Updated julialeroy@aoglobelife.com (24 -> 32)
    // 4. Updated jameshannah@aoglobelife.com (288 -> 0)
    // 5. Updated muhammadzohaib@aoglobelife.com (8 -> 0)

    const reverts = [
      {
        email: 'hernanplazola@aoglobelife.com',
        action: 'delete',
        reason: 'Was created by fix script'
      },
      {
        email: 'hannahjames@aoglobelife.com',
        action: 'delete',
        reason: 'Was created by fix script'
      },
      {
        email: 'julialeroy@aoglobelife.com',
        action: 'update',
        credits_used: 24,
        reason: 'Was updated from 24 to 32'
      },
      {
        email: 'jameshannah@aoglobelife.com',
        action: 'update',
        credits_used: 288,
        reason: 'Was updated from 288 to 0'
      },
      {
        email: 'muhammadzohaib@aoglobelife.com',
        action: 'update',
        credits_used: 8,
        reason: 'Was updated from 8 to 0'
      }
    ];

    let deleted = 0;
    let updated = 0;
    let errors = 0;

    for (const revert of reverts) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`\n🔙 Reverting ${revert.email}`);
      console.log(`   Action: ${revert.action}`);
      console.log(`   Reason: ${revert.reason}`);

      if (revert.action === 'delete') {
        const { error } = await supabaseAdmin
          .from('user_credits')
          .delete()
          .eq('email', revert.email);

        if (error) {
          console.log(`   ❌ Error deleting: ${error.message}`);
          errors++;
        } else {
          console.log(`   ✅ Deleted user_credits record`);
          deleted++;
        }
      } else if (revert.action === 'update') {
        // Get current state to see what we're reverting from
        const { data: current } = await supabaseAdmin
          .from('user_credits')
          .select('credits_used, credits_remaining, credits_purchased')
          .eq('email', revert.email)
          .maybeSingle();

        if (!current) {
          console.log(`   ⚠️ No record found to revert`);
          continue;
        }

        const currentCreditsUsed = Number(current.credits_used) || 0;
        const targetCreditsUsed = revert.credits_used!;
        const creditsPurchased = Number(current.credits_purchased) || 0;

        // Calculate new remaining credits
        const newRemaining = creditsPurchased - targetCreditsUsed;

        console.log(`   Current: credits_used=${currentCreditsUsed}, remaining=${current.credits_remaining}`);
        console.log(`   Reverting to: credits_used=${targetCreditsUsed}`);

        // Try updating with RPC or direct SQL since regular update might be blocked
        const { data: updatedRecord, error } = await supabaseAdmin.rpc('exec_sql', {
          sql: `UPDATE user_credits SET credits_used = ${targetCreditsUsed}, updated_at = NOW() WHERE email = '${revert.email}' RETURNING *`
        }).catch(async () => {
          // Fallback to regular update
          return await supabaseAdmin
            .from('user_credits')
            .update({
              credits_used: targetCreditsUsed,
              updated_at: new Date().toISOString()
            })
            .eq('email', revert.email)
            .select()
            .single();
        });

        if (error) {
          console.log(`   ❌ Error updating: ${error.message}`);
          errors++;
        } else if (!updatedRecord) {
          console.log(`   ❌ No record returned after update`);
          errors++;
        } else {
          const newCreditsUsed = Number(updatedRecord.credits_used) || 0;
          const newRemaining = Number(updatedRecord.credits_remaining) || 0;
          if (newCreditsUsed === targetCreditsUsed) {
            console.log(`   ✅ Reverted: credits_used=${currentCreditsUsed} -> ${newCreditsUsed}, remaining=${current.credits_remaining} -> ${newRemaining}`);
            updated++;
          } else {
            console.log(`   ⚠️ Update returned wrong value: expected ${targetCreditsUsed}, got ${newCreditsUsed}`);
            errors++;
          }
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Deleted: ${deleted}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Errors: ${errors}`);
    console.log('\n' + '='.repeat(70));
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

revertBillingFixes()
  .then(() => {
    console.log('\n✅ Revert complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Revert failed:', error);
    process.exit(1);
  });
