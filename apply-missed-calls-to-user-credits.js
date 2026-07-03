// Apply missed calls from last 3 weeks to user_credits table
import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMissedCallsToUserCredits() {
  try {
    console.log('📊 Applying Missed Calls to user_credits (Last 3 Weeks)\n');
    console.log('=' .repeat(80));

    // Calculate date range (3 weeks ago)
    const now = new Date();
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    console.log(`📅 Date Range: ${threeWeeksAgo.toLocaleDateString()} to ${now.toLocaleDateString()}\n`);

    // Step 1: Get all missed call transactions from the last 3 weeks
    console.log('📊 Step 1: Fetching missed call transactions...');
    const { data: allTransactions, error: fetchError } = await supabase
      .from('billing_transactions')
      .select('*')
      .eq('transaction_type', 'missed_call')
      .gte('transaction_date', threeWeeksAgo.toISOString())
      .order('transaction_date', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching transactions:', fetchError);
      return;
    }

    if (!allTransactions || allTransactions.length === 0) {
      console.log('⚠️  No missed call transactions found');
      return;
    }

    console.log(`✅ Found ${allTransactions.length} total missed call transactions\n`);

    // Step 2: Filter out transactions within 30 minutes of each other (per user)
    console.log('📊 Step 2: Filtering out missed calls within 30 minutes of each other...');
    
    const filteredTransactions = [];
    const userLastTransactionTime = new Map();

    for (const txn of allTransactions) {
      const email = txn.agent_email?.toLowerCase();
      if (!email) continue;

      const txnTime = new Date(txn.transaction_date);
      const lastTime = userLastTransactionTime.get(email);

      if (!lastTime || (txnTime.getTime() - lastTime.getTime()) > 30 * 60 * 1000) {
        filteredTransactions.push(txn);
        userLastTransactionTime.set(email, txnTime);
      }
    }

    const excludedCount = allTransactions.length - filteredTransactions.length;
    console.log(`✅ Filtered: ${filteredTransactions.length} unique missed calls (excluded ${excludedCount} within 30 min)\n`);

    // Step 3: Group by user and calculate totals
    const userTotals = new Map();

    filteredTransactions.forEach(txn => {
      const email = txn.agent_email?.toLowerCase();
      if (!email) return;

      if (!userTotals.has(email)) {
        userTotals.set(email, {
          email: email,
          associateId: txn.agent_associate_id || null,
          count: 0,
          totalAmount: 0
        });
      }

      const user = userTotals.get(email);
      user.count++;
      user.totalAmount += Number(txn.amount_usd) || 0;
    });

    console.log(`📊 Step 3: Updating user_credits for ${userTotals.size} users...\n`);

    // Step 4: Update user_credits for each user
    const results = [];
    let successCount = 0;
    let failedCount = 0;
    let createdCount = 0;

    for (const [email, userTotal] of userTotals.entries()) {
      try {
        // Get current user_credits
        const { data: currentCredits, error: fetchError } = await supabase
          .from('user_credits')
          .select('*')
          .eq('email', email)
          .single();

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
        } else {
          // User exists - update their credits
          const currentMissedCalls = Number(currentCredits.missed_calls) || 0;
          const currentMissedCallCount = Number(currentCredits.aoi_missed_calls) || 0;
          const currentCreditsUsed = Number(currentCredits.credits_used) || 0;
          const currentCreditsRemaining = Number(currentCredits.credits_remaining) || 0;

          const newMissedCalls = currentMissedCalls + missedCallAmount;
          const newMissedCallCount = currentMissedCallCount + missedCallCount;
          const newCreditsUsed = currentCreditsUsed + missedCallAmount;
          // credits_remaining is a generated column - will be auto-calculated by the database

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
            
            console.log(`✅ Updated ${email}: ${missedCallCount} calls = $${missedCallAmount.toFixed(2)}`);
            console.log(`   missed_calls: $${currentMissedCalls.toFixed(2)} → $${newMissedCalls.toFixed(2)}`);
            console.log(`   aoi_missed_calls: ${currentMissedCallCount} → ${newMissedCallCount}`);
            console.log(`   credits_used: $${currentCreditsUsed.toFixed(2)} → $${newCreditsUsed.toFixed(2)}`);
            console.log(`   credits_remaining: $${currentCreditsRemaining.toFixed(2)} → $${newCreditsRemaining.toFixed(2)} (auto-calculated)`);
            results.push({
              email: email,
              success: true,
              missedCallCount: missedCallCount,
              missedCallAmount: missedCallAmount,
              action: 'updated',
              before: {
                missed_calls: currentMissedCalls,
                aoi_missed_calls: currentMissedCallCount,
                credits_used: currentCreditsUsed,
                credits_remaining: currentCreditsRemaining
              },
              after: {
                missed_calls: newMissedCalls,
                aoi_missed_calls: newMissedCallCount,
                credits_used: newCreditsUsed,
                credits_remaining: updatedRecord?.credits_remaining || 0
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

    // Step 5: Summary
    console.log('\n' + '=' .repeat(80));
    console.log('📊 SUMMARY:');
    console.log('=' .repeat(80));
    console.log(`Total Users Processed: ${userTotals.size}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`📝 Created New Records: ${createdCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    
    const totalAmount = Array.from(userTotals.values()).reduce((sum, u) => sum + u.totalAmount, 0);
    const totalCalls = Array.from(userTotals.values()).reduce((sum, u) => sum + u.count, 0);
    
    console.log(`\n💰 Total Missed Calls Applied: ${totalCalls}`);
    console.log(`💰 Total Amount Applied: $${totalAmount.toFixed(2)}`);

    if (failedCount > 0) {
      console.log('\n❌ Failed Updates:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   ${r.email}: ${r.error || 'Unknown error'}`);
      });
    }

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Update complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyMissedCallsToUserCredits();

