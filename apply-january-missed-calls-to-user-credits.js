// Apply January 2026 missed calls from billing_transactions to user_credits table
// This script ensures all January missed call transactions are properly reflected in user_credits
import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyJanuaryMissedCallsToUserCredits() {
  try {
    console.log('📊 Applying January 2026 Missed Calls to user_credits\n');
    console.log('='.repeat(80));

    // January 2026 date range
    const januaryStart = '2026-01-01T00:00:00.000Z';
    const januaryEnd = '2026-01-31T23:59:59.999Z';

    console.log(`📅 Date Range: January 1, 2026 to January 31, 2026\n`);

    // Step 1: Get all missed call transactions from January 2026
    console.log('📊 Step 1: Fetching missed call transactions from January 2026...');
    const { data: allTransactions, error: fetchError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('transaction_type', 'missed_call')
      .eq('status', 'completed')
      .gte('transaction_date', januaryStart)
      .lte('transaction_date', januaryEnd)
      .order('transaction_date', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching transactions:', fetchError);
      return;
    }

    if (!allTransactions || allTransactions.length === 0) {
      console.log('⚠️  No missed call transactions found for January 2026');
      return;
    }

    console.log(`✅ Found ${allTransactions.length} total missed call transactions in January\n`);

    // Step 2: Group by user and calculate totals (NO filtering - each transaction should be counted)
    console.log('📊 Step 2: Grouping transactions by user...');
    
    const userTotals = new Map();

    allTransactions.forEach(txn => {
      const email = txn.agent_email?.toLowerCase()?.trim();
      if (!email) {
        console.warn(`⚠️  Skipping transaction ${txn.transaction_id} - no agent_email`);
        return;
      }

      if (!userTotals.has(email)) {
        userTotals.set(email, {
          email: email,
          associateId: txn.agent_associate_id || null,
          count: 0,
          totalAmount: 0,
          transactions: []
        });
      }

      const user = userTotals.get(email);
      user.count++;
      user.totalAmount += Number(txn.amount_usd) || 4.00; // Default to $4.00 if missing
      user.transactions.push(txn.transaction_id);
    });

    console.log(`✅ Found ${userTotals.size} unique users with missed calls\n`);

    // Step 3: Get current user_credits and calculate what SHOULD be there
    console.log('📊 Step 3: Checking current user_credits and calculating updates...\n');

    const results = [];
    let successCount = 0;
    let failedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    for (const [email, userTotal] of userTotals.entries()) {
      try {
        // Get current user_credits
        const { data: currentCredits, error: fetchError } = await supabase
          .from('user_credits')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        const missedCallCount = userTotal.count;
        const missedCallAmount = userTotal.totalAmount;

        if (fetchError && fetchError.code === 'PGRST116') {
          // User doesn't have user_credits record - create one
          console.log(`📝 Creating new user_credits record for ${email}...`);
          
          const { error: createError } = await supabase
            .from('user_credits')
            .insert({
              email: email,
              associate_id: userTotal.associateId,
              missed_calls: missedCallAmount,
              aoi_missed_calls: missedCallCount,
              credits_used: missedCallAmount,
              credits_purchased: 0,
              updated_at: new Date().toISOString()
            });

          if (createError) {
            console.error(`❌ Failed to create user_credits for ${email}:`, createError);
            results.push({
              email: email,
              success: false,
              error: createError.message,
              action: 'create'
            });
            failedCount++;
          } else {
            console.log(`✅ Created user_credits for ${email}: ${missedCallCount} calls = $${missedCallAmount.toFixed(2)}`);
            results.push({
              email: email,
              success: true,
              missedCallCount: missedCallCount,
              missedCallAmount: missedCallAmount,
              action: 'created'
            });
            successCount++;
            createdCount++;
          }
        } else if (fetchError) {
          console.error(`❌ Error fetching user_credits for ${email}:`, fetchError);
          results.push({
            email: email,
            success: false,
            error: fetchError.message,
            action: 'fetch'
          });
          failedCount++;
        } else if (!currentCredits) {
          // User doesn't have user_credits record - create one
          console.log(`📝 Creating new user_credits record for ${email}...`);
          
          const { error: createError } = await supabase
            .from('user_credits')
            .insert({
              email: email,
              associate_id: userTotal.associateId,
              missed_calls: missedCallAmount,
              aoi_missed_calls: missedCallCount,
              credits_used: missedCallAmount,
              credits_purchased: 0,
              updated_at: new Date().toISOString()
            });

          if (createError) {
            console.error(`❌ Failed to create user_credits for ${email}:`, createError);
            results.push({
              email: email,
              success: false,
              error: createError.message,
              action: 'create'
            });
            failedCount++;
          } else {
            console.log(`✅ Created user_credits for ${email}: ${missedCallCount} calls = $${missedCallAmount.toFixed(2)}`);
            results.push({
              email: email,
              success: true,
              missedCallCount: missedCallCount,
              missedCallAmount: missedCallAmount,
              action: 'created'
            });
            successCount++;
            createdCount++;
          }
        } else {
          // User exists - check if we need to update
          const currentMissedCalls = Number(currentCredits.missed_calls) || 0;
          const currentMissedCallCount = Number(currentCredits.aoi_missed_calls) || 0;
          const currentCreditsUsed = Number(currentCredits.credits_used) || 0;

          // Calculate what the values SHOULD be based on January transactions
          // We need to be careful: if some were already applied, we don't want to double-count
          // Strategy: Check if current values are LESS than what they should be, and only add the difference
          
          // For now, let's be conservative: if current values are already >= what we expect from January,
          // skip the update (assumes they were already applied)
          const expectedMissedCalls = missedCallAmount;
          const expectedMissedCallCount = missedCallCount;
          
          if (currentMissedCalls >= expectedMissedCalls && currentMissedCallCount >= expectedMissedCallCount) {
            console.log(`⏭️  Skipping ${email} - values already up to date (current: $${currentMissedCalls.toFixed(2)}/${currentMissedCallCount}, expected: $${expectedMissedCalls.toFixed(2)}/${expectedMissedCallCount})`);
            skippedCount++;
            continue;
          }

          // Calculate the difference (what needs to be added)
          const missedCallsDiff = Math.max(0, expectedMissedCalls - currentMissedCalls);
          const missedCallCountDiff = Math.max(0, expectedMissedCallCount - currentMissedCallCount);
          const creditsUsedDiff = missedCallsDiff; // Same as missed calls amount

          if (missedCallsDiff === 0 && missedCallCountDiff === 0) {
            console.log(`⏭️  Skipping ${email} - no difference to apply`);
            skippedCount++;
            continue;
          }

          const newMissedCalls = currentMissedCalls + missedCallsDiff;
          const newMissedCallCount = currentMissedCallCount + missedCallCountDiff;
          const newCreditsUsed = currentCreditsUsed + creditsUsedDiff;

          console.log(`📝 Updating ${email}:`);
          console.log(`   Adding: ${missedCallCountDiff} calls = $${missedCallsDiff.toFixed(2)}`);
          console.log(`   missed_calls: $${currentMissedCalls.toFixed(2)} → $${newMissedCalls.toFixed(2)}`);
          console.log(`   aoi_missed_calls: ${currentMissedCallCount} → ${newMissedCallCount}`);
          console.log(`   credits_used: $${currentCreditsUsed.toFixed(2)} → $${newCreditsUsed.toFixed(2)}`);

          const { error: updateError } = await supabase
            .from('user_credits')
            .update({
              missed_calls: newMissedCalls,
              aoi_missed_calls: newMissedCallCount,
              credits_used: newCreditsUsed,
              updated_at: new Date().toISOString()
            })
            .eq('email', email);

          if (updateError) {
            console.error(`❌ Failed to update user_credits for ${email}:`, updateError);
            results.push({
              email: email,
              success: false,
              error: updateError.message,
              action: 'update'
            });
            failedCount++;
          } else {
            // Fetch updated record to get the auto-calculated credits_remaining
            const { data: updatedRecord } = await supabase
              .from('user_credits')
              .select('credits_remaining')
              .eq('email', email)
              .single();
            
            const newCreditsRemaining = updatedRecord?.credits_remaining || 0;
            
            console.log(`✅ Updated ${email} - credits_remaining: $${newCreditsRemaining.toFixed(2)} (auto-calculated)`);
            results.push({
              email: email,
              success: true,
              missedCallCount: missedCallCountDiff,
              missedCallAmount: missedCallsDiff,
              action: 'updated',
              before: {
                missed_calls: currentMissedCalls,
                aoi_missed_calls: currentMissedCallCount,
                credits_used: currentCreditsUsed
              },
              after: {
                missed_calls: newMissedCalls,
                aoi_missed_calls: newMissedCallCount,
                credits_used: newCreditsUsed,
                credits_remaining: newCreditsRemaining
              }
            });
            successCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Unexpected error processing ${email}:`, error);
        results.push({
          email: email,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          action: 'error'
        });
        failedCount++;
      }
    }

    // Step 4: Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(80));
    console.log(`Total January Transactions: ${allTransactions.length}`);
    console.log(`Total Users: ${userTotals.size}`);
    console.log(`✅ Successful Updates: ${successCount}`);
    console.log(`📝 Created New Records: ${createdCount}`);
    console.log(`⏭️  Skipped (Already Applied): ${skippedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    
    const totalAmount = Array.from(userTotals.values()).reduce((sum, u) => sum + u.totalAmount, 0);
    const totalCalls = Array.from(userTotals.values()).reduce((sum, u) => sum + u.count, 0);
    
    console.log(`\n💰 Total January Missed Calls: ${totalCalls}`);
    console.log(`💰 Total January Amount: $${totalAmount.toFixed(2)}`);

    // Calculate how much was actually applied in this run
    const appliedAmount = results
      .filter(r => r.success && r.action !== 'created')
      .reduce((sum, r) => sum + (r.missedCallAmount || 0), 0);
    const appliedCalls = results
      .filter(r => r.success && r.action !== 'created')
      .reduce((sum, r) => sum + (r.missedCallCount || 0), 0);
    
    const createdAmount = results
      .filter(r => r.success && r.action === 'created')
      .reduce((sum, r) => sum + (r.missedCallAmount || 0), 0);
    const createdCalls = results
      .filter(r => r.success && r.action === 'created')
      .reduce((sum, r) => sum + (r.missedCallCount || 0), 0);

    console.log(`\n💰 Applied This Run:`);
    console.log(`   Updated: ${appliedCalls} calls = $${appliedAmount.toFixed(2)}`);
    console.log(`   Created: ${createdCalls} calls = $${createdAmount.toFixed(2)}`);
    console.log(`   Total Applied: ${appliedCalls + createdCalls} calls = $${(appliedAmount + createdAmount).toFixed(2)}`);

    if (failedCount > 0) {
      console.log('\n❌ Failed Updates:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   ${r.email}: ${r.error || 'Unknown error'}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ January missed calls update complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyJanuaryMissedCallsToUserCredits();
