// Preview what changes would be made to user_credits for missed calls
// Does NOT actually update - just shows what would change
import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://ycztjetxwpfgtrzeyytt.supabase.co';
const supabaseServiceKey = 'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function previewMissedCallsCreditsUpdate() {
  try {
    console.log('📊 Preview: Missed Calls Credits Update (Last 3 Weeks)\n');
    console.log('⚠️  THIS IS A PREVIEW - NO CHANGES WILL BE MADE\n');
    console.log('=' .repeat(80));

    // Calculate date range (3 weeks ago)
    const now = new Date();
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

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

    // Step 2: Filter out transactions within 30 minutes of each other (per user)
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

    console.log(`✅ Found ${filteredTransactions.length} unique missed calls (after filtering)\n`);

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

    // Step 4: Get current user_credits for all affected users
    console.log('📊 Step 2: Fetching current user_credits...');
    const userEmails = Array.from(userTotals.keys());
    
    const { data: currentCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('email, associate_id, name, missed_calls, aoi_missed_calls, credits_used, credits_remaining, credits_purchased')
      .in('email', userEmails);

    if (creditsError) {
      console.error('❌ Error fetching user_credits:', creditsError);
      return;
    }

    // Create a map of current credits by email
    const creditsByEmail = new Map();
    (currentCredits || []).forEach(cred => {
      creditsByEmail.set(cred.email?.toLowerCase(), cred);
    });

    // Step 5: Calculate what the changes would be
    console.log('📊 Step 3: Calculating proposed changes...\n');
    
    const changes = [];
    
    userTotals.forEach((userTotal, email) => {
      const current = creditsByEmail.get(email);
      const missedCallCount = userTotal.count;
      const missedCallAmount = userTotal.totalAmount;

      if (!current) {
        // User doesn't have a user_credits record yet
        changes.push({
          email: email,
          associateId: userTotal.associateId,
          name: 'NEW USER',
          current: {
            missed_calls: 0,
            aoi_missed_calls: 0,
            credits_used: 0,
            credits_remaining: 0
          },
          proposed: {
            missed_calls: missedCallAmount,
            aoi_missed_calls: missedCallCount,
            credits_used: missedCallAmount,
            credits_remaining: 0 // Would be negative if they have no credits
          },
          change: {
            missed_calls: missedCallAmount,
            aoi_missed_calls: missedCallCount,
            credits_used: missedCallAmount,
            credits_remaining: 0
          },
          missedCallCount: missedCallCount,
          missedCallAmount: missedCallAmount
        });
      } else {
        const currentMissedCalls = Number(current.missed_calls) || 0;
        const currentMissedCallCount = Number(current.aoi_missed_calls) || 0;
        const currentCreditsUsed = Number(current.credits_used) || 0;
        const currentCreditsRemaining = Number(current.credits_remaining) || 0;

        const newMissedCalls = currentMissedCalls + missedCallAmount;
        const newMissedCallCount = currentMissedCallCount + missedCallCount;
        const newCreditsUsed = currentCreditsUsed + missedCallAmount;
        const newCreditsRemaining = Math.max(0, currentCreditsRemaining - missedCallAmount);

        changes.push({
          email: email,
          associateId: current.associate_id || userTotal.associateId,
          name: current.name || email.split('@')[0],
          current: {
            missed_calls: currentMissedCalls,
            aoi_missed_calls: currentMissedCallCount,
            credits_used: currentCreditsUsed,
            credits_remaining: currentCreditsRemaining
          },
          proposed: {
            missed_calls: newMissedCalls,
            aoi_missed_calls: newMissedCallCount,
            credits_used: newCreditsUsed,
            credits_remaining: newCreditsRemaining
          },
          change: {
            missed_calls: missedCallAmount,
            aoi_missed_calls: missedCallCount,
            credits_used: missedCallAmount,
            credits_remaining: -missedCallAmount
          },
          missedCallCount: missedCallCount,
          missedCallAmount: missedCallAmount
        });
      }
    });

    // Sort by total amount (descending)
    changes.sort((a, b) => b.missedCallAmount - a.missedCallAmount);

    // Step 6: Display the preview
    console.log('📋 PREVIEW: Proposed Changes to user_credits');
    console.log('=' .repeat(80));
    console.log(`${'User'.padEnd(35)} ${'Missed Calls'.padStart(12)} ${'Amount $'.padStart(10)} ${'Current UC'.padStart(12)} ${'New UC'.padStart(12)} ${'Change UC'.padStart(12)}`);
    console.log('-'.repeat(80));

    let grandTotalCalls = 0;
    let grandTotalAmount = 0;
    let grandTotalCurrentCreditsUsed = 0;
    let grandTotalNewCreditsUsed = 0;

    changes.forEach((change, idx) => {
      grandTotalCalls += change.missedCallCount;
      grandTotalAmount += change.missedCallAmount;
      grandTotalCurrentCreditsUsed += change.current.credits_used;
      grandTotalNewCreditsUsed += change.proposed.credits_used;

      const displayName = change.name.length > 33 ? change.name.substring(0, 30) + '...' : change.name;
      
      console.log(
        `${(idx + 1).toString().padStart(3)}. ${displayName.padEnd(35)} ` +
        `${change.missedCallCount.toString().padStart(12)} ` +
        `$${change.missedCallAmount.toFixed(2).padStart(9)} ` +
        `$${change.current.credits_used.toFixed(2).padStart(11)} ` +
        `$${change.proposed.credits_used.toFixed(2).padStart(11)} ` +
        `$${change.change.credits_used.toFixed(2).padStart(11)}`
      );
    });

    console.log('-'.repeat(80));
    console.log(
      `${'TOTAL'.padEnd(48)} ` +
      `${grandTotalCalls.toString().padStart(12)} ` +
      `$${grandTotalAmount.toFixed(2).padStart(9)} ` +
      `$${grandTotalCurrentCreditsUsed.toFixed(2).padStart(11)} ` +
      `$${grandTotalNewCreditsUsed.toFixed(2).padStart(11)} ` +
      `$${(grandTotalNewCreditsUsed - grandTotalCurrentCreditsUsed).toFixed(2).padStart(11)}`
    );
    console.log('=' .repeat(80));

    // Step 7: Detailed breakdown for top users
    console.log('\n📊 Top 15 Users - Detailed Preview:');
    console.log('=' .repeat(80));

    changes.slice(0, 15).forEach((change, idx) => {
      console.log(`\n${idx + 1}. ${change.name} (${change.email})`);
      console.log(`   Associate ID: ${change.associateId || 'N/A'}`);
      console.log(`   Missed Calls to Add: ${change.missedCallCount} = $${change.missedCallAmount.toFixed(2)}`);
      console.log(`\n   Current user_credits:`);
      console.log(`      missed_calls:        $${change.current.missed_calls.toFixed(2)}`);
      console.log(`      aoi_missed_calls:    ${change.current.aoi_missed_calls}`);
      console.log(`      credits_used:        $${change.current.credits_used.toFixed(2)}`);
      console.log(`      credits_remaining:   $${change.current.credits_remaining.toFixed(2)}`);
      console.log(`\n   Proposed user_credits (AFTER UPDATE):`);
      console.log(`      missed_calls:        $${change.current.missed_calls.toFixed(2)} → $${change.proposed.missed_calls.toFixed(2)} (+$${change.change.missed_calls.toFixed(2)})`);
      console.log(`      aoi_missed_calls:    ${change.current.aoi_missed_calls} → ${change.proposed.aoi_missed_calls} (+${change.change.aoi_missed_calls})`);
      console.log(`      credits_used:        $${change.current.credits_used.toFixed(2)} → $${change.proposed.credits_used.toFixed(2)} (+$${change.change.credits_used.toFixed(2)})`);
      console.log(`      credits_remaining:   $${change.current.credits_remaining.toFixed(2)} → $${change.proposed.credits_remaining.toFixed(2)} (${change.change.credits_remaining >= 0 ? '+' : ''}$${change.change.credits_remaining.toFixed(2)})`);
    });

    // Step 8: Summary
    console.log('\n📊 Summary:');
    console.log('=' .repeat(80));
    console.log(`Total Users Affected: ${changes.length}`);
    console.log(`Total Missed Calls to Add: ${grandTotalCalls}`);
    console.log(`Total Amount to Add: $${grandTotalAmount.toFixed(2)}`);
    console.log(`\nCurrent Total credits_used: $${grandTotalCurrentCreditsUsed.toFixed(2)}`);
    console.log(`Proposed Total credits_used: $${grandTotalNewCreditsUsed.toFixed(2)}`);
    console.log(`Increase in credits_used: $${(grandTotalNewCreditsUsed - grandTotalCurrentCreditsUsed).toFixed(2)}`);
    
    // Count users who don't have user_credits records
    const usersWithoutCredits = changes.filter(c => c.name === 'NEW USER').length;
    if (usersWithoutCredits > 0) {
      console.log(`\n⚠️  ${usersWithoutCredits} users do NOT have user_credits records (would need to be created)`);
    }

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Preview complete - NO CHANGES WERE MADE\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

previewMissedCallsCreditsUpdate();

